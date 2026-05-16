import { css } from '@emotion/react';
import { DeleteMetadataModal } from '@jetstream/feature/deploy';
import { PermissionAnalysisHistoryModal } from '@jetstream/feature/manage-permissions';
import { logger } from '@jetstream/shared/client-logger';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { convertDateToLocale, formatNumber, setItemInLocalStorage } from '@jetstream/shared/ui-utils';
import { getErrorMessage, gzipDecode, isCustomFieldApiName } from '@jetstream/shared/utils';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  DataTable,
  DataTableSelectedContext,
  DataTree,
  DropDown,
  Grid,
  GridCol,
  Icon,
  KeyboardShortcut,
  Modal,
  Popover,
  ProgressIndicator,
  ReadOnlyFormElement,
  SalesforceLogin,
  ScopedNotification,
  SelectFormatter,
  setColumnFromType,
  Tabs,
  Toast,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
  fireToast,
  salesforceLoginAndRedirect,
} from '@jetstream/ui';
import { RequireMetadataApiBanner, fromJetstreamEvents, jobsState } from '@jetstream/ui-core';
import { applicationCookieState, selectSkipFrontdoorAuth, selectedOrgState } from '@jetstream/ui/app-state';
import { dexieDb } from '@jetstream/ui/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import groupBy from 'lodash/groupBy';
import { useAtom, useAtomValue } from 'jotai';
import type { AsyncJob, AsyncJobNew, FieldUsageAnalysisJob, FieldUsageFullResult, SalesforceOrgUi } from '@jetstream/types';
import { Fragment, FunctionComponent, type Key, MouseEvent, type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { SELECT_COLUMN_KEY, SelectColumn, type RenderGroupCellProps, type SortColumn } from 'react-data-grid';
import { Link, useHref, useSearchParams } from 'react-router-dom';
import { fieldUsageRowsToCustomFieldDeleteMetadata, fieldUsageRowEligibleForDestructiveDelete } from './field-usage-destructive-delete';
import { isAnalysisJobActive } from './shared/analysis-job-runtime-state';
import {
  countWhereUsedByUiCategory,
  fieldHasWhereUsedDeps,
  getFieldUsageTypeLabel,
  getWhereUsedDepsForFieldKey,
  parseFieldUsageJobResult,
  type FieldUsageJobResultParsed,
  type WhereUsedDependencyRowParsed,
} from './field-usage-result-parse';
import { getWhereUsedOpenInSalesforcePath } from './where-used-open-in-salesforce';

const FIELD_USAGE_TABLE_ACTION_DELETE_METADATA = 'field-usage-delete-metadata';

const HEIGHT_BUFFER = 170;

/** True for local Vite dev; false in production builds — used to avoid exposing raw job payloads in prod. */
const SHOW_RAW_JOB_JSON_UI = import.meta.env.DEV;

/** Custom fields at or below this fill rate appear on the **Low usage** tab. */
const LOW_USAGE_PCT_THRESHOLD = 5;

/** One-line explainer for the Low usage tab (threshold lives in {@link LOW_USAGE_PCT_THRESHOLD}). */
function getFieldUsageLowUsageIntroCopy(pctThreshold: number): string {
  return `Unmanaged Custom Fields at or below ${pctThreshold}% population in the rows scanned for this job. Packaged Custom Fields with a namespace prefix are not listed here.`;
}

const TREE_GROUP_BY = ['objectApiName'] as const;

/** Tall enough for two-line Object/Field cell + padded "Where Used" control (react-data-grid clips overflow). */
const TREE_ROW_HEIGHT_LEAF_PX = 56;
/** Single-line truncated object summary (see {@link renderFieldUsageObjectGroupCell}). */
const TREE_ROW_HEIGHT_GROUP_PX = 48;

/** Same reference every render — new arrays/functions here break TreeDataGrid measurement and can cause an update loop. */
const FIELD_USAGE_DATA_TREE_GROUP_BY: readonly string[] = TREE_GROUP_BY;

const FIELD_USAGE_TREE_INITIAL_SORT_BY_FIELD: SortColumn[] = [{ columnKey: 'fieldApiName', direction: 'ASC' }];

const FIELD_USAGE_TREE_INITIAL_SORT_BY_PCT: SortColumn[] = [{ columnKey: 'pct', direction: 'ASC' }];

function fieldUsageDataTreeRowHeight({ type }: { type: string }): number {
  if (type === 'GROUP') {
    return TREE_ROW_HEIGHT_GROUP_PX;
  }
  return TREE_ROW_HEIGHT_LEAF_PX;
}

/** Salesforce ISO timestamps shown in the browser locale/time zone (same as {@link convertDateToLocale} elsewhere). */
function formatFieldUsageLatestModifiedCell(raw: string | null): string {
  if (raw == null || raw === '') {
    return '—';
  }
  const parsed = parseISO(raw);
  if (!isValid(parsed)) {
    return raw;
  }
  return convertDateToLocale(raw) ?? raw;
}

/** Leaf rows for {@link DataTree}, grouped by {@link FieldUsageTreeRow.objectApiName} (same pattern as field permissions editor). */
interface FieldUsageTreeRow {
  _key: string;
  objectApiName: string;
  objectLabel: string;
  objectTotalRecords: number;
  objectQueryTruncated: boolean;
  objectCustomizable: boolean;
  objectError?: string;
  fieldApiName: string;
  fieldLabel: string;
  /** Describe-style type label ({@link getFieldUsageTypeLabel}). */
  type: string;
  custom: boolean;
  filled: number;
  pct: number;
  latestModified: string | null;
  /** Synthetic row when the object payload has `error` and no field stats. */
  isObjectErrorPlaceholder?: boolean;
  /** Unmanaged custom field (no namespace prefix) eligible for destructive delete; same rules as `isUnmanagedCustomFieldApiName` in shared utils. */
  destructiveDeleteEligible?: boolean;
  /** Where Used row counts by Kind: Layout, Automation, Apex ({@link countWhereUsedByUiCategory}). */
  whereUsedOnLayout: number;
  whereUsedInAutomation: number;
  whereUsedInApex: number;
}

function whereUsedUiCountsForField(
  whereUsed: FieldUsageJobResultParsed['whereUsed'] | undefined,
  objectApiName: string,
  fieldApiName: string,
): { whereUsedOnLayout: number; whereUsedInAutomation: number; whereUsedInApex: number } {
  if (!whereUsed || !isCustomFieldApiName(fieldApiName)) {
    return { whereUsedOnLayout: 0, whereUsedInAutomation: 0, whereUsedInApex: 0 };
  }
  const { onLayout, inAutomation, inApex } = countWhereUsedByUiCategory(
    getWhereUsedDepsForFieldKey(whereUsed, `${objectApiName}.${fieldApiName}`),
  );
  return { whereUsedOnLayout: onLayout, whereUsedInAutomation: inAutomation, whereUsedInApex: inApex };
}

/** Lightning Setup → Object Manager deep link (same pattern as permission analysis export). */
function fieldUsageObjectManagerReturnUrl(objectApiName: string, view: 'details' | 'fields'): string {
  const enc = encodeURIComponent(objectApiName);
  if (view === 'fields') {
    return `/lightning/setup/ObjectManager/${enc}/FieldsAndRelationships/view`;
  }
  return `/lightning/setup/ObjectManager/${enc}/Details/view`;
}

/** SOQL for Query Records: analyzed fields plus Id / LastModifiedDate, no WHERE (same shape as field usage scan). */
function buildFieldUsageObjectQuerySoql(objectApiName: string, childRows: readonly FieldUsageTreeRow[]): string {
  const analyzedFields = childRows
    .filter((row) => !row.isObjectErrorPlaceholder && row.objectApiName === objectApiName && row.fieldApiName && row.fieldApiName !== '—')
    .map((row) => row.fieldApiName);
  const orderedUnique = [...new Set(analyzedFields)].sort((a, b) => a.localeCompare(b));
  const selectList: string[] = ['Id', 'LastModifiedDate'];
  for (const fieldName of orderedUnique) {
    if (fieldName !== 'Id' && fieldName !== 'LastModifiedDate') {
      selectList.push(fieldName);
    }
  }
  return `SELECT ${selectList.join(', ')} FROM ${objectApiName}`;
}

/**
 * Opens Query Results in a new tab. Writes initial SOQL to `localStorage` under key `query` because `location.state`
 * is not passed through `window.open`, and `sessionStorage` is not visible in the new tab (each top-level tab has its
 * own session storage). {@link QueryResults} reads this handoff and clears `localStorage` after applying.
 * `queryResultsHref` must come from {@link useHref} so the path includes the app router basename (e.g. `/app`).
 */
function openFieldUsageObjectQueryInNewTab(
  objectApiName: string,
  objectLabel: string,
  childRows: readonly FieldUsageTreeRow[],
  queryResultsHref: string,
): void {
  const soql = buildFieldUsageObjectQuerySoql(objectApiName, childRows);
  setItemInLocalStorage(
    'query',
    JSON.stringify({
      soql,
      isTooling: false,
      sobject: { name: objectApiName, label: objectLabel },
    }),
  );
  window.open(queryResultsHref, '_blank', 'noopener,noreferrer');
}

const FIELD_USAGE_POPOVER_PANEL_PROPS = {
  onDoubleClick: (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  },
};

interface FieldUsageOrgLoginProps {
  serverUrl: string | undefined;
  org: SalesforceOrgUi | null | undefined;
  skipFrontDoorAuth: boolean;
}

function FieldUsageObjectGroupCell(
  props: RenderGroupCellProps<FieldUsageTreeRow> &
    FieldUsageOrgLoginProps & {
      /** From parent {@link useHref}; one value for all groups (avoids N identical hook calls). */
      queryResultsHref: string;
    },
): ReactElement {
  const { groupKey, childRows, serverUrl, org, skipFrontDoorAuth, queryResultsHref } = props;
  const api = String(groupKey);
  const sample = childRows[0];
  const label = sample?.objectLabel?.trim() ? sample.objectLabel.trim() : api;
  const analyzedFieldCount = childRows.filter((row) => !row.isObjectErrorPlaceholder).length;
  const rowCount = sample?.objectTotalRecords ?? 0;
  const slug = api.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const returnUrl = fieldUsageObjectManagerReturnUrl(api, 'details');
  const canDeepLink = Boolean(org?.uniqueId && serverUrl);

  const handleOpenQueryResults = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      openFieldUsageObjectQueryInNewTab(api, label, childRows, queryResultsHref);
    },
    [api, label, childRows, queryResultsHref],
  );

  return (
    <Popover
      size="large"
      panelProps={FIELD_USAGE_POPOVER_PANEL_PROPS}
      footer={
        <footer className="slds-popover__footer">
          <button
            type="button"
            className="slds-button slds-button_neutral"
            title={`Run this SELECT in Query Records (new tab) for ${label}`}
            onClick={handleOpenQueryResults}
          >
            <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_left" omitContainer />
            View query results
          </button>
        </footer>
      }
      content={
        <div>
          {canDeepLink && org && serverUrl ? (
            <SalesforceLogin org={org} serverUrl={serverUrl} returnUrl={returnUrl} skipFrontDoorAuth={skipFrontDoorAuth}>
              View in Salesforce
            </SalesforceLogin>
          ) : null}
          <Grid
            wrap
            gutters
            className={canDeepLink ? 'slds-m-top_x-small' : undefined}
            css={css`
              min-height: 80px;
            `}
          >
            <GridCol size={12}>
              <ReadOnlyFormElement
                id={`field-usage-obj-${slug}-label`}
                label="Object Label"
                className="slds-p-bottom_x-small"
                value={label}
                bottomBorder
              />
            </GridCol>
            <GridCol size={12}>
              <ReadOnlyFormElement
                id={`field-usage-obj-${slug}-api`}
                label="Object API Name"
                className="slds-p-bottom_x-small"
                value={api}
                bottomBorder
              />
            </GridCol>
            <GridCol size={6}>
              <ReadOnlyFormElement
                id={`field-usage-obj-${slug}-fields`}
                label="Fields Analyzed"
                className="slds-p-bottom_x-small"
                value={String(formatNumber(analyzedFieldCount))}
                bottomBorder
              />
            </GridCol>
            <GridCol size={6}>
              <ReadOnlyFormElement
                id={`field-usage-obj-${slug}-rows`}
                label="Rows Scanned"
                className="slds-p-bottom_x-small"
                value={String(formatNumber(rowCount))}
                bottomBorder
              />
            </GridCol>
            <GridCol size={12}>
              <ReadOnlyFormElement
                id={`field-usage-obj-${slug}-flags`}
                label="Notes"
                className="slds-p-bottom_x-small"
                value={
                  [
                    sample?.objectQueryTruncated ? 'Scan truncated' : null,
                    sample?.objectCustomizable === false ? 'Not customizable' : null,
                    sample?.objectError ? sample.objectError : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'
                }
                bottomBorder
              />
            </GridCol>
            {canDeepLink ? (
              <GridCol size={12} className="slds-m-top_small">
                <div className="slds-grid slds-text-small slds-text-color_weak">
                  Use <KeyboardShortcut className="slds-m-left_x-small" keys={['shift', 'click']} /> to skip this popup
                </div>
              </GridCol>
            ) : null}
          </Grid>
        </div>
      }
      buttonProps={{
        className: 'slds-button slds-button_reset slds-text-align_left',
      }}
      buttonStyle={{
        width: '100%',
        height: '100%',
        alignItems: 'center',
        display: 'flex',
        lineHeight: 1.25,
        padding: '0.25rem 0.5rem 0.25rem 0.25rem',
      }}
    >
      <span
        className="slds-text-body_small slds-truncate"
        css={css`
          display: block;
          flex: 1;
          min-width: 0;
          text-align: left;
        `}
        onClick={(event: MouseEvent<HTMLSpanElement>) => {
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            if (!canDeepLink || !org || !serverUrl) {
              return;
            }
            event.stopPropagation();
            event.preventDefault();
            salesforceLoginAndRedirect({
              serverUrl,
              org,
              returnUrl,
              skipFrontDoorAuth,
            });
          }
        }}
      >
        <span className="slds-text-bold">{label}</span> <code>{api}</code>
        <span className="slds-text-color_weak">
          {' '}
          · {formatNumber(analyzedFieldCount)} field{analyzedFieldCount === 1 ? '' : 's'}
          {' · '}
          {formatNumber(rowCount)} rows scanned
          {sample?.objectQueryTruncated ? ' · truncated' : ''}
          {sample?.objectCustomizable ? '' : ' · not customizable'}
        </span>
        {sample?.objectError ? <span className="slds-text-color_error"> · {sample.objectError}</span> : null}
      </span>
    </Popover>
  );
}

function FieldUsageFieldNameCell({
  row,
  serverUrl,
  org,
  skipFrontDoorAuth,
}: {
  row: FieldUsageTreeRow;
} & FieldUsageOrgLoginProps): ReactElement {
  const slug = `${row.objectApiName}-${row.fieldApiName}`.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const returnUrl = fieldUsageObjectManagerReturnUrl(row.objectApiName, 'fields');
  const canDeepLink = Boolean(org?.uniqueId && serverUrl);

  return (
    <Popover
      size="large"
      panelProps={FIELD_USAGE_POPOVER_PANEL_PROPS}
      content={
        <div>
          {canDeepLink && org && serverUrl ? (
            <SalesforceLogin org={org} serverUrl={serverUrl} returnUrl={returnUrl} skipFrontDoorAuth={skipFrontDoorAuth}>
              View in Salesforce
            </SalesforceLogin>
          ) : null}
          <Grid
            wrap
            gutters
            className={canDeepLink ? 'slds-m-top_x-small' : undefined}
            css={css`
              min-height: 80px;
            `}
          >
            <GridCol size={12}>
              <ReadOnlyFormElement
                id={`field-usage-f-${slug}-obj`}
                label="Parent Object"
                className="slds-p-bottom_x-small"
                value={`${row.objectLabel} (${row.objectApiName})`}
                bottomBorder
              />
            </GridCol>
            <GridCol size={12}>
              <ReadOnlyFormElement
                id={`field-usage-f-${slug}-api`}
                label="Field API Name"
                className="slds-p-bottom_x-small"
                value={row.fieldApiName}
                bottomBorder
              />
            </GridCol>
            <GridCol size={12}>
              <ReadOnlyFormElement
                id={`field-usage-f-${slug}-label`}
                label="Field Label"
                className="slds-p-bottom_x-small"
                value={row.fieldLabel}
                bottomBorder
              />
            </GridCol>
            {canDeepLink ? (
              <GridCol size={12} className="slds-m-top_small">
                <div className="slds-grid slds-text-small slds-text-color_weak">
                  Use <KeyboardShortcut className="slds-m-left_x-small" keys={['shift', 'click']} /> to skip this popup
                </div>
              </GridCol>
            ) : null}
          </Grid>
        </div>
      }
      buttonProps={{
        className: 'slds-button slds-button_reset slds-text-align_left',
      }}
      buttonStyle={{ width: '100%', height: '100%', padding: 0 }}
    >
      <div
        className="slds-p-vertical_xx-small"
        onClick={(event: MouseEvent<HTMLDivElement>) => {
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            if (!canDeepLink || !org || !serverUrl) {
              return;
            }
            event.stopPropagation();
            event.preventDefault();
            salesforceLoginAndRedirect({
              serverUrl,
              org,
              returnUrl,
              skipFrontDoorAuth,
            });
          }
        }}
      >
        <div className="slds-text-body_small slds-truncate">
          <code>{row.fieldApiName}</code>
        </div>
        <div className="slds-text-body_small slds-text-color_weak slds-truncate">{row.fieldLabel}</div>
      </div>
    </Popover>
  );
}

interface WhereUsedTableRow {
  _key: string;
  componentType: string;
  componentName: string;
  kindLabel: string;
  /** Flow `VersionNumber` when known; em dash otherwise. */
  flowVersionLabel: string;
  /** Relative path for Salesforce login link when opening the dependency in the org. */
  openInSalesforcePath: string | null;
}

function formatJobResultJson(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

/**
 * Lazily stringifies the result when the Raw JSON tab actually renders. Inlining the stringify in the
 * `resultTabs` useMemo would re-run on every memo dep change even if the tab isn't active — for very
 * large blobs this is noticeable jank when toggling filters.
 */
const RawJsonTabContent: FunctionComponent<{ result: unknown }> = ({ result }) => {
  const formatted = useMemo(() => formatJobResultJson(result), [result]);
  return (
    <div className="slds-p-around_medium">
      <pre
        className="slds-box slds-scrollable_y"
        css={css`
          max-height: min(560px, 70vh);
          font-size: 0.75rem;
        `}
      >
        {formatted}
      </pre>
    </div>
  );
};

/**
 * Field usage results workspace. Subscribes to the in-flight job entry (jotai jobsState) for progress
 * and to Dexie `analysis_job_history` for the terminal row; no HTTP polling. Result decoding happens
 * once per Dexie row (gzip decompress) and feeds the existing field-usage parser.
 */
export const FieldUsageAnalysisView: FunctionComponent = () => {
  const selectedOrg = useAtomValue(selectedOrgState);
  const [{ serverUrl }] = useAtom(applicationCookieState);
  const skipFrontDoorAuth = useAtomValue(selectSkipFrontdoorAuth);
  const jobs = useAtomValue(jobsState);
  const [searchParams, setSearchParams] = useSearchParams();
  const jobId = searchParams.get('job');

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loadAllRecordsModalOpen, setLoadAllRecordsModalOpen] = useState(false);
  const [whereUsedForKey, setWhereUsedForKey] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<unknown>>(() => new Set());
  const [fieldUsageSelectedRowKeys, setFieldUsageSelectedRowKeys] = useState(() => new Set<string>());
  const [deleteFieldMetadataModalOpen, setDeleteFieldMetadataModalOpen] = useState(false);
  const [decodedFullResult, setDecodedFullResult] = useState<FieldUsageFullResult | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const fieldUsageQueryResultsHref = useHref({
    pathname: `${APP_ROUTES.QUERY.ROUTE}/results`,
    ...(APP_ROUTES.QUERY.SEARCH_PARAM ? { search: `?${APP_ROUTES.QUERY.SEARCH_PARAM}` } : {}),
  });

  /**
   * Live in-flight AsyncJob for this jobHistoryKey, when present. Drives the progress UI before the
   * Dexie terminal row lands; the Jobs popover shows the same entry.
   */
  const inFlightJob: AsyncJob<FieldUsageAnalysisJob> | null = useMemo(() => {
    if (!jobId) {
      return null;
    }
    for (const candidate of Object.values(jobs)) {
      if (candidate.type !== 'FieldUsageAnalysis') {
        continue;
      }
      const meta = candidate.meta as FieldUsageAnalysisJob | undefined;
      if (meta?.jobHistoryKey === jobId) {
        return candidate as AsyncJob<FieldUsageAnalysisJob>;
      }
    }
    return null;
  }, [jobs, jobId]);

  const inFlightStatus = inFlightJob?.status;
  const isJobRunning = inFlightStatus === 'pending' || inFlightStatus === 'in-progress';

  /**
   * Terminal Dexie row for this jobHistoryKey, kept reactive via useLiveQuery so the view updates
   * the moment the JobWorker writes the row.
   */
  const historyRow = useLiveQuery(() => (jobId ? dexieDb.analysis_job_history.get(jobId) : undefined), [jobId]);

  useEffect(() => {
    // Eagerly drop the prior decoded payload so switching between large completed runs doesn't keep both
    // the old and new uncompressed blobs in memory while the new gunzip resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale decoded payload when job/row changes
    setDecodedFullResult(null);
    setDecodeError(null);
    if (!historyRow || historyRow.status !== 'completed' || !historyRow.resultBlob) {
      return;
    }
    let cancelled = false;
    gzipDecode<FieldUsageFullResult>(historyRow.resultBlob)
      .then((decoded) => {
        if (!cancelled) {
          setDecodedFullResult(decoded);
        }
      })
      .catch((ex) => {
        if (!cancelled) {
          logger.error('Failed to decode field_usage history blob', ex);
          setDecodeError(getErrorMessage(ex));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [historyRow]);

  // Derived status / errors used by the existing render branches.
  const jobStatusNormalized = useMemo(() => {
    if (historyRow?.status === 'completed' || historyRow?.status === 'failed') {
      return historyRow.status;
    }
    if (isJobRunning) {
      return 'running';
    }
    if (inFlightStatus === 'failed' || inFlightStatus === 'aborted') {
      return 'failed';
    }
    return '';
  }, [historyRow?.status, isJobRunning, inFlightStatus]);
  const isTerminal = jobStatusNormalized === 'completed' || jobStatusNormalized === 'failed';
  const fetchError = decodeError;
  const terminalErrorMessage = historyRow?.errorMessage ?? inFlightJob?.statusMessage ?? null;
  const liveProgress = inFlightJob?.progress;
  const isFieldUsageJobActiveForOrg = selectedOrg ? isAnalysisJobActive(jobs, selectedOrg.uniqueId, 'field_usage') : false;

  /** Must be memoized: a fresh object every render makes `[parsedResult]` effects run forever. */
  const parsedResult: FieldUsageJobResultParsed | null = useMemo(() => {
    if (jobStatusNormalized !== 'completed' || !decodedFullResult) {
      return null;
    }
    return parseFieldUsageJobResult(decodedFullResult);
  }, [jobStatusNormalized, decodedFullResult]);

  useEffect(() => {
    if (!parsedResult) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset expansion when a new job result loads so object groups start expanded
    setExpandedGroupIds(new Set(Object.keys(parsedResult.objects)));
  }, [parsedResult]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- new job result invalidates row selection
    setFieldUsageSelectedRowKeys(new Set());
  }, [parsedResult]);

  const treeFieldRows: FieldUsageTreeRow[] = useMemo(() => {
    if (!parsedResult) {
      return [];
    }
    const rows: FieldUsageTreeRow[] = [];
    for (const objectApiName of Object.keys(parsedResult.objects).sort((a, b) => a.localeCompare(b))) {
      const payload = parsedResult.objects[objectApiName];
      const base = {
        objectApiName,
        objectLabel: payload.label,
        objectTotalRecords: payload.totalRecords,
        objectQueryTruncated: payload.queryTruncated,
        objectCustomizable: payload.customizable,
        ...(payload.error ? { objectError: payload.error } : {}),
      };
      if (payload.error) {
        rows.push({
          _key: `${objectApiName}::__error__`,
          ...base,
          fieldApiName: '—',
          fieldLabel: payload.error,
          type: '',
          custom: false,
          filled: 0,
          pct: 0,
          latestModified: null,
          isObjectErrorPlaceholder: true,
          destructiveDeleteEligible: false,
          whereUsedOnLayout: 0,
          whereUsedInAutomation: 0,
          whereUsedInApex: 0,
        });
        continue;
      }
      for (const fieldApiName of Object.keys(payload.fieldUsage).sort((a, b) => a.localeCompare(b))) {
        const stat = payload.fieldUsage[fieldApiName];
        const meta = payload.fieldMeta[fieldApiName];
        const destructiveDeleteEligible = fieldUsageRowEligibleForDestructiveDelete({
          isObjectErrorPlaceholder: false,
          fieldApiName,
          meta,
        });
        rows.push({
          _key: `${objectApiName}.${fieldApiName}`,
          ...base,
          fieldApiName,
          fieldLabel: meta?.label ?? fieldApiName,
          type: getFieldUsageTypeLabel(meta),
          custom: meta?.custom ?? false,
          filled: stat.filled,
          pct: stat.pct,
          latestModified: stat.latestFilledRowModified,
          destructiveDeleteEligible,
          ...whereUsedUiCountsForField(parsedResult.whereUsed, objectApiName, fieldApiName),
        });
      }
    }
    return rows;
  }, [parsedResult]);

  const getTreeRowKey = useCallback((row: FieldUsageTreeRow) => row._key, []);

  const objectsTabTotals = useMemo(() => {
    const objectCount = parsedResult ? Object.keys(parsedResult.objects).length : 0;
    const analyzedFieldCount = treeFieldRows.filter((row) => !row.isObjectErrorPlaceholder).length;
    return { objectCount, analyzedFieldCount };
  }, [parsedResult, treeFieldRows]);

  const fieldUsageReloadObjectApiNames = useMemo(() => {
    if (!parsedResult) {
      return [];
    }
    return Object.keys(parsedResult.objects).sort((a, b) => a.localeCompare(b));
  }, [parsedResult]);

  const canLoadAllRecords = parsedResult?.truncated === true && fieldUsageReloadObjectApiNames.length > 0 && Boolean(selectedOrg?.uniqueId);

  const handleConfirmLoadAllRecords = useCallback(() => {
    if (!selectedOrg || fieldUsageReloadObjectApiNames.length === 0) {
      return;
    }
    if (isAnalysisJobActive(jobs, selectedOrg.uniqueId, 'field_usage')) {
      fireToast({
        message: 'A Field Usage job is already running for this org. Wait for it to finish before starting another.',
        type: 'warning',
      });
      return;
    }

    const newJobHistoryKey = `aj_${crypto.randomUUID()}`;
    const meta: FieldUsageAnalysisJob = {
      jobHistoryKey: newJobHistoryKey,
      orgUniqueId: selectedOrg.uniqueId,
      objectApiNames: fieldUsageReloadObjectApiNames,
      loadFullScan: true,
    };
    const asyncJobNew: AsyncJobNew<FieldUsageAnalysisJob> = {
      type: 'FieldUsageAnalysis',
      title: `Field Usage Full Scan (${fieldUsageReloadObjectApiNames.length} Object${fieldUsageReloadObjectApiNames.length === 1 ? '' : 's'})`,
      org: selectedOrg,
      meta,
      viewUrl: `/analysis?job=${encodeURIComponent(newJobHistoryKey)}`,
    };
    fromJetstreamEvents.emit({ type: 'newJob', payload: [asyncJobNew] });
    setLoadAllRecordsModalOpen(false);
    fireToast({ message: 'Full scan job started. Loading results…', type: 'success' });
    setSearchParams({ job: newJobHistoryKey }, { replace: true });
  }, [jobs, selectedOrg, fieldUsageReloadObjectApiNames, setSearchParams]);

  const lowUsageTreeRows: FieldUsageTreeRow[] = useMemo(() => {
    if (!parsedResult) {
      return [];
    }
    const rows: FieldUsageTreeRow[] = [];
    for (const objectApiName of Object.keys(parsedResult.objects).sort()) {
      const payload = parsedResult.objects[objectApiName];
      if (!payload || payload.error) {
        continue;
      }
      for (const fieldApiName of Object.keys(payload.fieldUsage)) {
        const stat = payload.fieldUsage[fieldApiName];
        const meta = payload.fieldMeta[fieldApiName];
        if (!meta?.custom) {
          continue;
        }
        if (stat.pct > LOW_USAGE_PCT_THRESHOLD) {
          continue;
        }
        rows.push({
          _key: `${objectApiName}.${fieldApiName}`,
          objectApiName,
          objectLabel: payload.label,
          objectTotalRecords: payload.totalRecords,
          objectQueryTruncated: payload.queryTruncated,
          objectCustomizable: payload.customizable,
          fieldApiName,
          fieldLabel: meta.label ?? fieldApiName,
          type: getFieldUsageTypeLabel(meta),
          custom: true,
          filled: stat.filled,
          pct: stat.pct,
          latestModified: stat.latestFilledRowModified,
          destructiveDeleteEligible: fieldUsageRowEligibleForDestructiveDelete({
            isObjectErrorPlaceholder: false,
            fieldApiName,
            meta,
          }),
          ...whereUsedUiCountsForField(parsedResult.whereUsed, objectApiName, fieldApiName),
        });
      }
    }
    rows.sort((a, b) => a.pct - b.pct || a.objectApiName.localeCompare(b.objectApiName));
    return rows;
  }, [parsedResult]);

  const fieldUsageRowByKey = useMemo(() => {
    const map = new Map<string, FieldUsageTreeRow>();
    for (const row of treeFieldRows) {
      map.set(row._key, row);
    }
    for (const row of lowUsageTreeRows) {
      map.set(row._key, row);
    }
    return map;
  }, [treeFieldRows, lowUsageTreeRows]);

  const fieldUsageSelectedDestructiveDeleteCount = useMemo(() => {
    let count = 0;
    for (const key of fieldUsageSelectedRowKeys) {
      if (fieldUsageRowByKey.get(key)?.destructiveDeleteEligible) {
        count += 1;
      }
    }
    return count;
  }, [fieldUsageRowByKey, fieldUsageSelectedRowKeys]);

  const fieldUsageDeleteSelectedMetadata = useMemo(() => {
    const rows = Array.from(fieldUsageSelectedRowKeys)
      .map((key) => fieldUsageRowByKey.get(key))
      .filter((row): row is FieldUsageTreeRow => Boolean(row));
    return fieldUsageRowsToCustomFieldDeleteMetadata(rows);
  }, [fieldUsageRowByKey, fieldUsageSelectedRowKeys]);

  const handleFieldUsageToolbarDropdown = useCallback(
    (actionId: string) => {
      if (actionId === FIELD_USAGE_TABLE_ACTION_DELETE_METADATA) {
        if (fieldUsageSelectedDestructiveDeleteCount === 0) {
          return;
        }
        setDeleteFieldMetadataModalOpen(true);
      }
    },
    [fieldUsageSelectedDestructiveDeleteCount],
  );

  const handleFieldUsageSelectedRowsChange = useCallback((next: Set<Key>) => {
    setFieldUsageSelectedRowKeys(new Set(Array.from(next, (key) => String(key))));
  }, []);

  const whereUsedRows: WhereUsedTableRow[] = useMemo(() => {
    if (!parsedResult || !whereUsedForKey) {
      return [];
    }
    const deps: WhereUsedDependencyRowParsed[] = getWhereUsedDepsForFieldKey(parsedResult.whereUsed, whereUsedForKey);
    return deps.map((row, index) => {
      const fv = row.flowVersionNumber;
      const flowVersionLabel = row.type.trim() === 'Flow' && fv != null && Number.isFinite(Number(fv)) ? String(fv) : '—';
      return {
        _key: `${row.type}:${row.name}:${String(index)}`,
        componentType: row.type,
        componentName: row.name,
        kindLabel: row.kind === 'automation' ? 'Automation' : row.kind === 'apex' ? 'Apex' : row.kind === 'layout' ? 'Layout' : 'Other',
        flowVersionLabel,
        openInSalesforcePath: getWhereUsedOpenInSalesforcePath(row),
      };
    });
  }, [parsedResult, whereUsedForKey]);

  const treeColumns: ColumnWithFilter<FieldUsageTreeRow>[] = useMemo(
    () => [
      {
        ...SelectColumn,
        key: SELECT_COLUMN_KEY,
        resizable: false,
        sortable: false,
        minWidth: 36,
        width: 40,
        maxWidth: 44,
        renderCell: (args) => {
          if (!args.row.destructiveDeleteEligible) {
            return null;
          }
          return SelectColumn.renderCell?.(args) || <SelectFormatter {...args} />;
        },
        renderGroupCell: () => null,
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('objectApiName', 'text'),
        name: '',
        key: 'objectApiName',
        width: 40,
        minWidth: 36,
        maxWidth: 44,
        resizable: false,
        sortable: false,
        renderGroupCell: ({ isExpanded, toggleGroup }) => (
          <Grid align="end" verticalAlign="center" className="slds-p-right_xx-small h-100">
            <button
              type="button"
              className="slds-button slds-button_reset slds-p-around_xx-small"
              title={isExpanded ? 'Collapse' : 'Expand'}
              aria-expanded={isExpanded}
              onClick={toggleGroup}
            >
              <Icon
                icon={isExpanded ? 'chevrondown' : 'chevronright'}
                type="utility"
                className="slds-icon slds-icon-text-default slds-icon_x-small"
              />
            </button>
          </Grid>
        ),
        renderCell: () => null,
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('fieldApiName', 'text'),
        name: 'Object / Field',
        key: 'fieldApiName',
        width: 340,
        minWidth: 200,
        renderGroupCell: (groupProps) => (
          <FieldUsageObjectGroupCell
            {...groupProps}
            serverUrl={serverUrl}
            org={selectedOrg}
            skipFrontDoorAuth={skipFrontDoorAuth}
            queryResultsHref={fieldUsageQueryResultsHref}
          />
        ),
        renderCell: (p) =>
          p.row.isObjectErrorPlaceholder ? (
            <span className="slds-text-body_small slds-text-color_error">{p.row.fieldLabel}</span>
          ) : (
            <FieldUsageFieldNameCell row={p.row} serverUrl={serverUrl} org={selectedOrg} skipFrontDoorAuth={skipFrontDoorAuth} />
          ),
        getValue: ({ row }) => `${row.fieldApiName} ${row.fieldLabel}`,
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('type', 'text'),
        name: 'Type',
        key: 'type',
        width: 200,
        minWidth: 160,
        renderGroupCell: () => null,
        renderCell: (p) => <span>{p.row.isObjectErrorPlaceholder ? '' : p.row.type}</span>,
        getValue: ({ row }) => (row.isObjectErrorPlaceholder ? '' : row.type),
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('custom', 'text'),
        name: 'Custom Field',
        key: 'custom',
        width: 100,
        minWidth: 80,
        renderGroupCell: () => null,
        renderCell: (p) => <span>{p.row.isObjectErrorPlaceholder ? '' : p.row.custom ? 'Yes' : 'No'}</span>,
        getValue: ({ row }) => {
          if (row.isObjectErrorPlaceholder) {
            return '';
          }
          return row.custom ? 'Yes' : 'No';
        },
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('filled', 'number'),
        name: 'Filled',
        key: 'filled',
        width: 80,
        minWidth: 80,
        renderGroupCell: () => null,
        renderCell: (p) => <span>{p.row.isObjectErrorPlaceholder ? '' : formatNumber(p.row.filled)}</span>,
        getValue: ({ row }) => (row.isObjectErrorPlaceholder ? '' : formatNumber(row.filled)),
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('pct', 'number'),
        name: '% Filled',
        key: 'pct',
        width: 100,
        minWidth: 100,
        renderGroupCell: () => null,
        renderCell: (p) => <span>{p.row.isObjectErrorPlaceholder ? '' : `${p.row.pct.toFixed(1)}%`}</span>,
        getValue: ({ row }) => (row.isObjectErrorPlaceholder ? '' : `${row.pct.toFixed(1)}%`),
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('latestModified', 'text'),
        name: 'Latest Value Row Modified',
        key: 'latestModified',
        width: 220,
        minWidth: 100,
        renderGroupCell: () => null,
        renderCell: (p) => <span>{p.row.isObjectErrorPlaceholder ? '' : formatFieldUsageLatestModifiedCell(p.row.latestModified)}</span>,
        getValue: ({ row }) => {
          if (row.isObjectErrorPlaceholder) {
            return '';
          }
          return formatFieldUsageLatestModifiedCell(row.latestModified);
        },
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('whereUsedOnLayout', 'number'),
        name: 'On Layout',
        key: 'whereUsedOnLayout',
        width: 120,
        minWidth: 100,
        renderGroupCell: () => null,
        renderCell: (p) => (
          <span>{p.row.isObjectErrorPlaceholder ? '' : p.row.whereUsedOnLayout > 0 ? formatNumber(p.row.whereUsedOnLayout) : '—'}</span>
        ),
        getValue: ({ row }) => {
          if (row.isObjectErrorPlaceholder) {
            return '';
          }
          return row.whereUsedOnLayout > 0 ? String(row.whereUsedOnLayout) : '';
        },
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('whereUsedInAutomation', 'number'),
        name: 'In Automation',
        key: 'whereUsedInAutomation',
        width: 140,
        minWidth: 140,
        renderGroupCell: () => null,
        renderCell: (p) => (
          <span>
            {p.row.isObjectErrorPlaceholder ? '' : p.row.whereUsedInAutomation > 0 ? formatNumber(p.row.whereUsedInAutomation) : '—'}
          </span>
        ),
        getValue: ({ row }) => {
          if (row.isObjectErrorPlaceholder) {
            return '';
          }
          return row.whereUsedInAutomation > 0 ? String(row.whereUsedInAutomation) : '';
        },
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('whereUsedInApex', 'number'),
        name: 'In Apex',
        key: 'whereUsedInApex',
        width: 100,
        minWidth: 100,
        renderGroupCell: () => null,
        renderCell: (p) => (
          <span>{p.row.isObjectErrorPlaceholder ? '' : p.row.whereUsedInApex > 0 ? formatNumber(p.row.whereUsedInApex) : '—'}</span>
        ),
        getValue: ({ row }) => {
          if (row.isObjectErrorPlaceholder) {
            return '';
          }
          return row.whereUsedInApex > 0 ? String(row.whereUsedInApex) : '';
        },
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('whereUsed', 'text'),
        name: '',
        key: 'whereUsed',
        width: 188,
        minWidth: 160,
        sortable: false,
        renderGroupCell: () => null,
        renderCell: (p) => {
          if (p.row.isObjectErrorPlaceholder || !isCustomFieldApiName(p.row.fieldApiName)) {
            return <span className="slds-text-color_weak">—</span>;
          }
          const fieldKey = `${p.row.objectApiName}.${p.row.fieldApiName}`;
          if (!parsedResult || !fieldHasWhereUsedDeps(parsedResult.whereUsed, fieldKey)) {
            return <span className="slds-text-color_weak">—</span>;
          }
          return (
            <div className="slds-p-around_x-small">
              <button
                type="button"
                className="slds-button slds-button_neutral slds-button_stretch"
                onClick={() => setWhereUsedForKey(fieldKey)}
              >
                Where Used
              </button>
            </div>
          );
        },
        getValue: ({ row }) => {
          if (row.isObjectErrorPlaceholder || !isCustomFieldApiName(row.fieldApiName)) {
            return '—';
          }
          const fieldKey = `${row.objectApiName}.${row.fieldApiName}`;
          if (!parsedResult || !fieldHasWhereUsedDeps(parsedResult.whereUsed, fieldKey)) {
            return '—';
          }
          return 'Where Used';
        },
      },
    ],
    [parsedResult, serverUrl, selectedOrg, skipFrontDoorAuth, fieldUsageQueryResultsHref],
  );

  const whereUsedColumns: ColumnWithFilter<WhereUsedTableRow>[] = useMemo(
    () => [
      {
        ...setColumnFromType<WhereUsedTableRow>('componentType', 'text'),
        name: 'Metadata Type',
        key: 'componentType',
        width: 160,
        maxWidth: 220,
      },
      {
        ...setColumnFromType<WhereUsedTableRow>('componentName', 'text'),
        name: 'Name',
        key: 'componentName',
        width: 480,
        minWidth: 280,
      },
      {
        ...setColumnFromType<WhereUsedTableRow>('flowVersionLabel', 'text'),
        name: 'Flow Ver.',
        key: 'flowVersionLabel',
        width: 88,
        minWidth: 72,
        maxWidth: 100,
      },
      {
        ...setColumnFromType<WhereUsedTableRow>('kindLabel', 'text'),
        name: 'Kind',
        key: 'kindLabel',
        width: 120,
        maxWidth: 140,
      },
      {
        ...setColumnFromType<WhereUsedTableRow>('openInSalesforcePath', 'text'),
        name: 'Open',
        key: 'openInSalesforcePath',
        width: 108,
        minWidth: 96,
        sortable: false,
        renderCell: (p) => {
          const returnUrl = p.row.openInSalesforcePath;
          if (!returnUrl || !selectedOrg?.uniqueId || !serverUrl) {
            return <span className="slds-text-color_weak">—</span>;
          }
          return (
            <SalesforceLogin
              org={selectedOrg}
              serverUrl={serverUrl}
              skipFrontDoorAuth={skipFrontDoorAuth}
              returnUrl={returnUrl}
              title="Open in Salesforce"
              className="slds-text-body_small"
            >
              Open
            </SalesforceLogin>
          );
        },
        getValue: ({ row }) => (row.openInSalesforcePath ? 'Open' : ''),
      },
    ],
    [selectedOrg, serverUrl, skipFrontDoorAuth],
  );

  const resultTabs = useMemo(() => {
    if (!parsedResult) {
      return null;
    }
    return [
      {
        id: 'objects',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="entity"
                containerClassname="slds-icon_container slds-icon-standard-entity"
                className="slds-icon slds-icon_small"
              />
            </span>
            Objects & Fields
          </Fragment>
        ),
        titleText: 'Objects & Fields',
        content: (
          <div className="slds-p-around_small">
            {parsedResult.truncated && (
              <div className="slds-m-bottom_small">
                <ScopedNotification theme="warning">
                  At least one Object hit the row scan cap; percentages reflect scanned rows only.
                </ScopedNotification>
              </div>
            )}
            {treeFieldRows.length === 0 ? (
              <ScopedNotification theme="info">No Object rows in this result.</ScopedNotification>
            ) : (
              <AutoFullHeightContainer
                fillHeight
                bottomBuffer={24}
                baseCss={css`
                  min-height: 280px;
                `}
              >
                <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">
                  {formatNumber(objectsTabTotals.analyzedFieldCount)} analyzed field
                  {objectsTabTotals.analyzedFieldCount === 1 ? '' : 's'} across {formatNumber(objectsTabTotals.objectCount)} Object
                  {objectsTabTotals.objectCount === 1 ? '' : 's'}.
                </p>
                <DataTree
                  columns={treeColumns}
                  data={treeFieldRows}
                  getRowKey={getTreeRowKey}
                  includeQuickFilter
                  groupBy={FIELD_USAGE_DATA_TREE_GROUP_BY}
                  rowGrouper={groupBy}
                  expandedGroupIds={expandedGroupIds}
                  onExpandedGroupIdsChange={setExpandedGroupIds}
                  rowHeight={fieldUsageDataTreeRowHeight}
                  initialSortColumns={FIELD_USAGE_TREE_INITIAL_SORT_BY_FIELD}
                  selectedRows={fieldUsageSelectedRowKeys}
                  onSelectedRowsChange={handleFieldUsageSelectedRowsChange}
                  org={selectedOrg ?? undefined}
                  serverUrl={serverUrl}
                  skipFrontdoorLogin={skipFrontDoorAuth}
                />
              </AutoFullHeightContainer>
            )}
          </div>
        ),
      },
      {
        id: 'low-usage',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="chart"
                containerClassname="slds-icon_container slds-icon-standard-chart"
                className="slds-icon slds-icon_small"
              />
            </span>
            Low Usage (≤{LOW_USAGE_PCT_THRESHOLD}%)
          </Fragment>
        ),
        titleText: 'Low Usage Custom Fields',
        content: (
          <div className="slds-p-around_small">
            <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_small">
              {getFieldUsageLowUsageIntroCopy(LOW_USAGE_PCT_THRESHOLD)}
            </p>
            {lowUsageTreeRows.length === 0 ? (
              <ScopedNotification theme="info">
                No unmanaged Custom Fields at or below {LOW_USAGE_PCT_THRESHOLD}% population for the objects in this scan.
              </ScopedNotification>
            ) : (
              <AutoFullHeightContainer
                fillHeight
                bottomBuffer={24}
                baseCss={css`
                  min-height: 280px;
                `}
              >
                <DataTree
                  columns={treeColumns}
                  data={lowUsageTreeRows}
                  getRowKey={getTreeRowKey}
                  includeQuickFilter
                  groupBy={FIELD_USAGE_DATA_TREE_GROUP_BY}
                  rowGrouper={groupBy}
                  expandedGroupIds={expandedGroupIds}
                  onExpandedGroupIdsChange={setExpandedGroupIds}
                  rowHeight={fieldUsageDataTreeRowHeight}
                  initialSortColumns={FIELD_USAGE_TREE_INITIAL_SORT_BY_PCT}
                  selectedRows={fieldUsageSelectedRowKeys}
                  onSelectedRowsChange={handleFieldUsageSelectedRowsChange}
                  org={selectedOrg ?? undefined}
                  serverUrl={serverUrl}
                  skipFrontdoorLogin={skipFrontDoorAuth}
                />
              </AutoFullHeightContainer>
            )}
          </div>
        ),
      },
      ...(SHOW_RAW_JOB_JSON_UI
        ? [
            {
              id: 'raw-json',
              title: (
                <Fragment>
                  <span className="slds-tabs__left-icon">
                    <Icon
                      type="standard"
                      icon="apex"
                      containerClassname="slds-icon_container slds-icon-standard-apex"
                      className="slds-icon slds-icon_small"
                    />
                  </span>
                  Raw JSON
                </Fragment>
              ),
              titleText: 'Raw JSON',
              content: <RawJsonTabContent result={decodedFullResult} />,
            },
          ]
        : []),
    ];
  }, [
    parsedResult,
    treeFieldRows,
    treeColumns,
    lowUsageTreeRows,
    expandedGroupIds,
    getTreeRowKey,
    objectsTabTotals,
    decodedFullResult,
    fieldUsageSelectedRowKeys,
    handleFieldUsageSelectedRowsChange,
    selectedOrg,
    serverUrl,
    skipFrontDoorAuth,
  ]);

  return (
    <div>
      <RequireMetadataApiBanner />
      <Toolbar>
        <div
          css={css`
            display: flex;
            width: 100%;
            min-width: 0;
            align-items: center;
            flex-wrap: nowrap;
            gap: 0.5rem 0.75rem;
          `}
        >
          <div
            css={css`
              flex: 0 0 auto;
            `}
          >
            <ToolbarItemGroup>
              <Link className="slds-button slds-button_brand" to="..">
                <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
                Go Back
              </Link>
            </ToolbarItemGroup>
          </div>
          <div
            css={css`
              flex: 1 1 0;
              min-width: 0;
            `}
          />
          <div
            css={css`
              flex: 0 0 auto;
            `}
          >
            <ToolbarItemActions>
              {parsedResult && treeFieldRows.some((row) => !row.isObjectErrorPlaceholder) && (
                <DropDown
                  buttonClassName="slds-button slds-button_neutral slds-button_icon slds-button_icon-border-filled"
                  buttonContent={
                    <Icon
                      type="utility"
                      icon="settings"
                      className="slds-button__icon slds-button__icon_hint slds-button__icon_medium"
                      description="Field Actions"
                    />
                  }
                  position="right"
                  actionText="Field Actions"
                  items={[
                    {
                      id: FIELD_USAGE_TABLE_ACTION_DELETE_METADATA,
                      subheader: 'Deploy Actions',
                      icon: { type: 'utility', icon: 'delete', description: 'Delete Selected Custom Fields' },
                      value: 'Delete Selected Metadata',
                      disabled: fieldUsageSelectedDestructiveDeleteCount === 0,
                      title:
                        fieldUsageSelectedDestructiveDeleteCount === 0
                          ? 'Select unmanaged Custom Fields (no namespace prefix) on the Objects & Fields or Low Usage tab'
                          : 'Same destructive deploy flow as Deploy Metadata (validate or delete from this org)',
                    },
                  ]}
                  onSelected={handleFieldUsageToolbarDropdown}
                />
              )}
              <Tooltip
                ariaRole="label"
                content={
                  canLoadAllRecords
                    ? 'Start a new job that scans all rows for these objects (no per-object cap). Confirm to review API impact.'
                    : 'Shown when the row scan stopped early. Run a full scan only if you need complete counts.'
                }
              >
                <button
                  type="button"
                  className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
                  disabled={!canLoadAllRecords || isFieldUsageJobActiveForOrg}
                  onClick={() => setLoadAllRecordsModalOpen(true)}
                >
                  <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
                  <span>Load All Records</span>
                </button>
              </Tooltip>
              <Tooltip ariaRole="label" content="View past Field Usage runs for this org">
                <button
                  type="button"
                  aria-label="Field Usage history"
                  className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
                  css={css`
                    padding: 0.5rem;
                  `}
                  disabled={!selectedOrg?.uniqueId}
                  onClick={() => setIsHistoryOpen(true)}
                >
                  <Icon type="utility" icon="date_time" className="slds-button__icon" omitContainer title="Field Usage history" />
                </button>
              </Tooltip>
            </ToolbarItemActions>
          </div>
        </div>
      </Toolbar>
      {deleteFieldMetadataModalOpen && selectedOrg && Object.keys(fieldUsageDeleteSelectedMetadata).length > 0 && (
        <DeleteMetadataModal
          selectedOrg={selectedOrg}
          selectedMetadata={fieldUsageDeleteSelectedMetadata}
          onClose={() => setDeleteFieldMetadataModalOpen(false)}
        />
      )}
      {loadAllRecordsModalOpen && (
        <Modal
          header="Load All Records?"
          tagline="Starts a new Field Usage job for the same objects without the per-object row scan cap."
          onClose={() => setLoadAllRecordsModalOpen(false)}
          footer={
            <Fragment>
              <button type="button" className="slds-button slds-button_neutral" onClick={() => setLoadAllRecordsModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="slds-button slds-button_brand slds-m-left_x-small"
                disabled={isFieldUsageJobActiveForOrg}
                onClick={handleConfirmLoadAllRecords}
              >
                Start Full Scan
              </button>
            </Fragment>
          }
        >
          <div className="slds-p-around_medium">
            <ScopedNotification theme="warning">
              This runs a full row scan for each Object in this job. It can take a long time and use many Salesforce API calls (REST query
              and queryMore), counting against your org&apos;s daily limits.
            </ScopedNotification>
            <p className="slds-m-top_small slds-text-body_regular">
              A <strong>new</strong> analysis job will start. When it completes, this page will show that job&apos;s results.
            </p>
          </div>
        </Modal>
      )}
      {isHistoryOpen && selectedOrg && (
        <PermissionAnalysisHistoryModal
          selectedOrg={selectedOrg}
          analysisJobType="field_usage"
          currentJobId={jobId}
          onClose={() => setIsHistoryOpen(false)}
          onSelectJob={(nextJobId) => {
            setSearchParams({ job: nextJobId }, { replace: true });
          }}
        />
      )}
      {whereUsedForKey && (
        <Modal
          header={`Where Used — ${whereUsedForKey}`}
          tagline="Tooling MetadataComponentDependency references (Custom Fields). Flow version is Tooling Flow.VersionNumber when available. Open uses your org login."
          size="lg"
          onClose={() => setWhereUsedForKey(null)}
          footer={
            <button type="button" className="slds-button slds-button_neutral" onClick={() => setWhereUsedForKey(null)}>
              Close
            </button>
          }
        >
          {whereUsedRows.length === 0 ? (
            <p className="slds-text-body_regular slds-text-color_weak slds-p-around_small">
              No dependency rows were returned for this field (or Where Used could not be computed for this org).
            </p>
          ) : (
            <div className="slds-p-around_small">
              <div className="slds-scrollable_x">
                <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
                  <DataTable
                    columns={whereUsedColumns}
                    data={whereUsedRows}
                    getRowKey={(row) => row._key}
                    includeQuickFilter
                    rowHeight={34}
                  />
                </AutoFullHeightContainer>
              </div>
            </div>
          )}
        </Modal>
      )}
      <AutoFullHeightContainer
        baseCss={css`
          background-color: #ffffff;
        `}
        bottomBuffer={10}
        className="slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        {!jobId && (
          <div className="slds-p-around_medium">
            <ScopedNotification theme="warning">
              No analysis job is linked to this page. Start a Field Usage job from Data Analysis, then you will be redirected here
              automatically.
            </ScopedNotification>
          </div>
        )}
        {jobId && fetchError && <Toast type="error">{fetchError}</Toast>}
        {jobId && !fetchError && jobStatusNormalized === 'failed' && terminalErrorMessage != null && (
          <div className="slds-p-around_medium">
            <Toast type="error">{terminalErrorMessage}</Toast>
          </div>
        )}
        {jobId && !fetchError && !isTerminal && (
          <div className="slds-p-around_medium">
            <h2 className="slds-text-heading_small slds-m-bottom_x-small">Field usage analysis in progress…</h2>
            <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">
              {isJobRunning && liveProgress?.label ? liveProgress.label : 'Preparing'}
              {isJobRunning && liveProgress && liveProgress.total > 0
                ? ` — object ${formatNumber(liveProgress.current)} of ${formatNumber(liveProgress.total)}`
                : ''}
            </p>
            <ProgressIndicator
              currentValue={isJobRunning && liveProgress && Number.isFinite(liveProgress.percent) ? Math.round(liveProgress.percent) : 0}
              isIndeterminate={!isJobRunning || !liveProgress || !Number.isFinite(liveProgress.percent)}
            />
            <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
              You can leave this page — the job will keep running and you&apos;ll find it in the Jobs popover.
            </p>
          </div>
        )}
        {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && !parsedResult && (
          <div className="slds-p-around_medium">
            <Toast type="warning">
              This job completed but the result payload is not a recognized Field Usage envelope (missing `phase: field_usage_v1`).
            </Toast>
          </div>
        )}
        {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && parsedResult && resultTabs && (
          <DataTableSelectedContext.Provider value={{ selectedRowIds: fieldUsageSelectedRowKeys, getRowKey: getTreeRowKey }}>
            <Fragment>
              <div className="slds-p-horizontal_medium slds-p-top_x-small">
                <p className="slds-text-body_small">
                  <span className="slds-text-color_weak">Summary </span>
                  {parsedResult.summary}
                </p>
              </div>
              {parsedResult.failedObjects.length > 0 && (
                <div className="slds-p-horizontal_medium slds-p-top_x-small">
                  <ScopedNotification theme="error">Objects with errors: {parsedResult.failedObjects.join(', ')}.</ScopedNotification>
                </div>
              )}
              <Tabs key={resultTabs.map((tab) => tab.id).join('|')} initialActiveId="objects" tabs={resultTabs} />
            </Fragment>
          </DataTableSelectedContext.Provider>
        )}
      </AutoFullHeightContainer>
    </div>
  );
};

export default FieldUsageAnalysisView;

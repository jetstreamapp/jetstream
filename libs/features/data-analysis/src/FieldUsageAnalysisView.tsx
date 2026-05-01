import { css } from '@emotion/react';
import { PermissionAnalysisHistoryModal } from '@jetstream/feature/manage-permissions';
import { logger } from '@jetstream/shared/client-logger';
import { getAnalysisJob } from '@jetstream/shared/data';
import { convertDateToLocale, formatNumber } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  DataTable,
  DataTree,
  Grid,
  Icon,
  Modal,
  ScopedNotification,
  setColumnFromType,
  Spinner,
  Tabs,
  Toast,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
} from '@jetstream/ui';
import { RequireMetadataApiBanner } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import groupBy from 'lodash/groupBy';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import type { RenderGroupCellProps, SortColumn } from 'react-data-grid';
import { Link, useSearchParams } from 'react-router-dom';
import {
  countWhereUsedByUiCategory,
  fieldHasWhereUsedDeps,
  getFieldUsageTypeLabel,
  getWhereUsedDepsForFieldKey,
  parseFieldUsageJobResult,
  type FieldUsageJobResultParsed,
  type WhereUsedDependencyRowParsed,
} from './field-usage-result-parse';

const HEIGHT_BUFFER = 170;

/** Custom fields at or below this fill rate appear on the **Low usage** tab. */
const LOW_USAGE_PCT_THRESHOLD = 5;

const TREE_GROUP_BY = ['objectApiName'] as const;

/** Tall enough for two-line Object/Field cell + padded "Where Used" control (react-data-grid clips overflow). */
const TREE_ROW_HEIGHT_LEAF_PX = 56;
const TREE_ROW_HEIGHT_GROUP_PX = 58;

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
  if (!whereUsed || !fieldApiName.endsWith('__c')) {
    return { whereUsedOnLayout: 0, whereUsedInAutomation: 0, whereUsedInApex: 0 };
  }
  const { onLayout, inAutomation, inApex } = countWhereUsedByUiCategory(
    getWhereUsedDepsForFieldKey(whereUsed, `${objectApiName}.${fieldApiName}`),
  );
  return { whereUsedOnLayout: onLayout, whereUsedInAutomation: inAutomation, whereUsedInApex: inApex };
}

function renderFieldUsageObjectGroupCell({ groupKey, childRows, toggleGroup }: RenderGroupCellProps<FieldUsageTreeRow>) {
  const api = String(groupKey);
  const sample = childRows[0];
  const label = sample?.objectLabel?.trim() ? sample.objectLabel.trim() : api;
  const analyzedFieldCount = childRows.filter((row) => !row.isObjectErrorPlaceholder).length;
  return (
    <button
      type="button"
      className="slds-button slds-button_reset slds-text-align_left"
      css={css`
        width: 100%;
        height: 100%;
        align-items: flex-start;
        display: flex;
        line-height: 1.35;
        padding: 0.35rem 0.5rem 0.35rem 0.25rem;
        white-space: normal;
      `}
      onClick={toggleGroup}
      title={api}
    >
      <span
        css={css`
          flex: 1;
          min-width: 0;
          text-align: left;
        `}
      >
        <span className="slds-text-body_small slds-text-bold">{label}</span> <code className="slds-text-body_small">{api}</code>
        <span className="slds-text-body_small slds-text-color_weak">
          {' '}
          · {formatNumber(analyzedFieldCount)} field{analyzedFieldCount === 1 ? '' : 's'}
          {' · '}
          {formatNumber(sample?.objectTotalRecords ?? 0)} rows scanned
          {sample?.objectQueryTruncated ? ' · truncated' : ''}
          {sample?.objectCustomizable ? '' : ' · not customizable'}
        </span>
        {sample?.objectError ? <span className="slds-text-body_small slds-text-color_error"> · {sample.objectError}</span> : null}
      </span>
    </button>
  );
}

interface WhereUsedTableRow {
  _key: string;
  componentType: string;
  componentName: string;
  kindLabel: string;
}

function formatJobResultJson(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

/**
 * Field usage results workspace: polls the analysis job created from {@link DataAnalysisSelection}.
 */
export const FieldUsageAnalysisView: FunctionComponent = () => {
  const selectedOrg = useAtomValue(selectedOrgState);
  const [searchParams, setSearchParams] = useSearchParams();
  const jobId = searchParams.get('job');

  const [jobRecord, setJobRecord] = useState<Record<string, unknown> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [whereUsedForKey, setWhereUsedForKey] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<unknown>>(() => new Set());

  useEffect(() => {
    if (!selectedOrg?.uniqueId || !jobId) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- switching org/job clears stale record until poll returns
    setJobRecord(null);

    const orgForPoll = selectedOrg;
    const jobIdForPoll = jobId;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let pollIntervalMs = 2000;
    let consecutiveNonTerminalSuccess = 0;

    const clearPolling = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const effectivePollIntervalMs = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return Math.max(pollIntervalMs, 12000);
      }
      return pollIntervalMs;
    };

    const schedulePolling = () => {
      clearPolling();
      intervalId = setInterval(() => void pollOnce(), effectivePollIntervalMs());
    };

    async function pollOnce() {
      try {
        const { job } = await getAnalysisJob(orgForPoll, jobIdForPoll);
        if (cancelled) {
          return;
        }
        setJobRecord(job);
        setFetchError(null);
        const status = String(job.status ?? '');
        if (status === 'completed' || status === 'failed') {
          clearPolling();
          return;
        }
        consecutiveNonTerminalSuccess += 1;
        const nextMs = Math.min(5000, 2000 + (consecutiveNonTerminalSuccess - 1) * 500);
        if (nextMs !== pollIntervalMs) {
          pollIntervalMs = nextMs;
          schedulePolling();
        }
      } catch (ex) {
        if (!cancelled) {
          setFetchError(getErrorMessage(ex));
          logger.error('Failed to load field usage analysis job', ex);
          clearPolling();
        }
      }
    }

    const onVisibilityChange = () => {
      if (cancelled) {
        return;
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        pollIntervalMs = 2000;
        consecutiveNonTerminalSuccess = 0;
        void pollOnce();
      }
      schedulePolling();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    void pollOnce();
    schedulePolling();

    return () => {
      cancelled = true;
      clearPolling();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [selectedOrg, jobId]);

  const jobStatusNormalized = jobRecord?.status != null ? String(jobRecord.status).trim().toLowerCase() : '';
  const isTerminal = jobStatusNormalized === 'completed' || jobStatusNormalized === 'failed';

  /** Must be memoized: a fresh object every render makes `[parsedResult]` effects run forever (setExpandedGroupIds → re-render → parse again). */
  const parsedResult: FieldUsageJobResultParsed | null = useMemo(() => {
    if (jobStatusNormalized !== 'completed' || jobRecord?.result == null) {
      return null;
    }
    return parseFieldUsageJobResult(jobRecord.result);
  }, [jobStatusNormalized, jobRecord?.result]);

  useEffect(() => {
    if (!parsedResult) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset expansion when a new job result loads so object groups start expanded
    setExpandedGroupIds(new Set(Object.keys(parsedResult.objects)));
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
          whereUsedOnLayout: 0,
          whereUsedInAutomation: 0,
          whereUsedInApex: 0,
        });
        continue;
      }
      for (const fieldApiName of Object.keys(payload.fieldUsage).sort((a, b) => a.localeCompare(b))) {
        const stat = payload.fieldUsage[fieldApiName];
        const meta = payload.fieldMeta[fieldApiName];
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
          ...whereUsedUiCountsForField(parsedResult.whereUsed, objectApiName, fieldApiName),
        });
      }
    }
    rows.sort((a, b) => a.pct - b.pct || a.objectApiName.localeCompare(b.objectApiName));
    return rows;
  }, [parsedResult]);

  const whereUsedRows: WhereUsedTableRow[] = useMemo(() => {
    if (!parsedResult || !whereUsedForKey) {
      return [];
    }
    const deps: WhereUsedDependencyRowParsed[] = getWhereUsedDepsForFieldKey(parsedResult.whereUsed, whereUsedForKey);
    return deps.map((row, index) => ({
      _key: `${row.type}:${row.name}:${String(index)}`,
      componentType: row.type,
      componentName: row.name,
      kindLabel: row.kind === 'automation' ? 'Automation' : row.kind === 'apex' ? 'Apex' : row.kind === 'layout' ? 'Layout' : 'Other',
    }));
  }, [parsedResult, whereUsedForKey]);

  const treeColumns: ColumnWithFilter<FieldUsageTreeRow>[] = useMemo(
    () => [
      {
        ...setColumnFromType<FieldUsageTreeRow>('objectApiName', 'text'),
        name: '',
        key: 'objectApiName',
        width: 40,
        minWidth: 36,
        maxWidth: 44,
        resizable: false,
        sortable: false,
        renderGroupCell: ({ isExpanded }) => (
          <Grid align="end" verticalAlign="center" className="slds-p-right_xx-small h-100">
            <Icon
              icon={isExpanded ? 'chevrondown' : 'chevronright'}
              type="utility"
              className="slds-icon slds-icon-text-default slds-icon_x-small"
              title={isExpanded ? 'Expanded' : 'Collapsed'}
            />
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
        renderGroupCell: renderFieldUsageObjectGroupCell,
        renderCell: (p) =>
          p.row.isObjectErrorPlaceholder ? (
            <span className="slds-text-body_small slds-text-color_error">{p.row.fieldLabel}</span>
          ) : (
            <div className="slds-p-vertical_xx-small">
              <div className="slds-text-body_small">
                <code>{p.row.fieldApiName}</code>
              </div>
              <div className="slds-text-body_small slds-text-color_weak slds-truncate" title={p.row.fieldLabel}>
                {p.row.fieldLabel}
              </div>
            </div>
          ),
        getValue: ({ row }) => `${row.fieldApiName} ${row.fieldLabel}`,
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('type', 'text'),
        name: 'Type',
        key: 'type',
        width: 200,
        minWidth: 104,
        renderGroupCell: () => null,
        renderCell: (p) => <span>{p.row.isObjectErrorPlaceholder ? '' : p.row.type}</span>,
        getValue: ({ row }) => (row.isObjectErrorPlaceholder ? '' : row.type),
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('custom', 'text'),
        name: 'Custom',
        key: 'custom',
        width: 88,
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
        width: 100,
        renderGroupCell: () => null,
        renderCell: (p) => <span>{p.row.isObjectErrorPlaceholder ? '' : formatNumber(p.row.filled)}</span>,
        getValue: ({ row }) => (row.isObjectErrorPlaceholder ? '' : formatNumber(row.filled)),
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('pct', 'number'),
        name: '% Filled',
        key: 'pct',
        width: 100,
        renderGroupCell: () => null,
        renderCell: (p) => <span>{p.row.isObjectErrorPlaceholder ? '' : `${p.row.pct.toFixed(1)}%`}</span>,
        getValue: ({ row }) => (row.isObjectErrorPlaceholder ? '' : `${row.pct.toFixed(1)}%`),
      },
      {
        ...setColumnFromType<FieldUsageTreeRow>('latestModified', 'text'),
        name: 'Latest Value Row Modified',
        key: 'latestModified',
        width: 200,
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
        width: 104,
        minWidth: 88,
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
        width: 120,
        minWidth: 96,
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
        width: 96,
        minWidth: 80,
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
        width: 180,
        minWidth: 140,
        sortable: false,
        renderGroupCell: () => null,
        renderCell: (p) => {
          if (p.row.isObjectErrorPlaceholder || !p.row.fieldApiName.endsWith('__c')) {
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
          if (row.isObjectErrorPlaceholder || !row.fieldApiName.endsWith('__c')) {
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
    [parsedResult],
  );

  const whereUsedColumns: ColumnWithFilter<WhereUsedTableRow>[] = useMemo(
    () => [
      {
        ...setColumnFromType<WhereUsedTableRow>('componentType', 'text'),
        name: 'Metadata type',
        key: 'componentType',
        width: 200,
      },
      {
        ...setColumnFromType<WhereUsedTableRow>('componentName', 'text'),
        name: 'Name',
        key: 'componentName',
        width: 280,
      },
      {
        ...setColumnFromType<WhereUsedTableRow>('kindLabel', 'text'),
        name: 'Kind',
        key: 'kindLabel',
        width: 120,
      },
    ],
    [],
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
        titleText: 'Objects and Fields',
        content: (
          <div className="slds-p-around_small">
            {parsedResult.truncated && (
              <div className="slds-m-bottom_small">
                <ScopedNotification theme="warning">
                  At least one object hit the row scan cap; percentages reflect scanned rows only.
                </ScopedNotification>
              </div>
            )}
            {treeFieldRows.length === 0 ? (
              <ScopedNotification theme="info">No object rows in this result.</ScopedNotification>
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
                  {objectsTabTotals.analyzedFieldCount === 1 ? '' : 's'} across {formatNumber(objectsTabTotals.objectCount)} object
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
            Low usage (≤{LOW_USAGE_PCT_THRESHOLD}%)
          </Fragment>
        ),
        titleText: 'Low usage custom fields',
        content: (
          <div className="slds-p-around_small">
            <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_small">
              Custom fields (`__c`) at or below {LOW_USAGE_PCT_THRESHOLD}% population across scanned rows.
            </p>
            {lowUsageTreeRows.length === 0 ? (
              <ScopedNotification theme="info">No custom fields at or below this threshold for the selected objects.</ScopedNotification>
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
                />
              </AutoFullHeightContainer>
            )}
          </div>
        ),
      },
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
        content: (
          <div className="slds-p-around_medium">
            <pre
              className="slds-box slds-scrollable_y"
              css={css`
                max-height: min(560px, 70vh);
                font-size: 0.75rem;
              `}
            >
              {formatJobResultJson(jobRecord?.result)}
            </pre>
          </div>
        ),
      },
    ];
  }, [parsedResult, treeFieldRows, treeColumns, lowUsageTreeRows, expandedGroupIds, getTreeRowKey, objectsTabTotals, jobRecord?.result]);

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
              <Tooltip ariaRole="label" content="View past field usage runs for this org">
                <button
                  type="button"
                  aria-label="Field usage history"
                  className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
                  css={css`
                    padding: 0.5rem;
                  `}
                  disabled={!selectedOrg?.uniqueId}
                  onClick={() => setIsHistoryOpen(true)}
                >
                  <Icon type="utility" icon="date_time" className="slds-button__icon" omitContainer title="Field usage history" />
                </button>
              </Tooltip>
            </ToolbarItemActions>
          </div>
        </div>
      </Toolbar>
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
          tagline="Tooling MetadataComponentDependency references (custom fields)."
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
                    rowHeight={30}
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
              No analysis job is linked to this page. Start a field usage job from Data Analysis, then you will be redirected here
              automatically.
            </ScopedNotification>
          </div>
        )}
        {jobId && fetchError && <Toast type="error">{fetchError}</Toast>}
        {jobId && !fetchError && jobStatusNormalized === 'failed' && jobRecord?.errorMessage != null && (
          <div className="slds-p-around_medium">
            <Toast type="error">{String(jobRecord.errorMessage)}</Toast>
          </div>
        )}
        {jobId && !fetchError && !isTerminal && (
          <div className="slds-p-around_medium">
            <Spinner />
          </div>
        )}
        {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && !parsedResult && (
          <div className="slds-p-around_medium">
            <Toast type="warning">
              This job completed but the result payload is not a recognized field usage envelope (missing `phase: field_usage_v1`).
            </Toast>
          </div>
        )}
        {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && parsedResult && resultTabs && (
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
        )}
      </AutoFullHeightContainer>
    </div>
  );
};

export default FieldUsageAnalysisView;

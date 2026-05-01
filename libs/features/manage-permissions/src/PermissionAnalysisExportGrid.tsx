import { css } from '@emotion/react';
import type { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  DataTable,
  Grid,
  GridCol,
  Icon,
  KeyboardShortcut,
  Popover,
  ReadOnlyFormElement,
  SalesforceLogin,
  ScopedNotification,
  salesforceLoginAndRedirect,
} from '@jetstream/ui';
import type { ColumnWithFilter, RowWithKey } from '@jetstream/ui';
import { FunctionComponent, Fragment, type MouseEvent, useCallback, useMemo, useState } from 'react';
import type { CellMouseArgs } from 'react-data-grid';
import { PermissionAnalysisFindingsModal } from './PermissionAnalysisFindingsModal';
import {
  buildContainerIdFindingSeverity,
  buildDynamicExportColumns,
  buildFieldPermissionFindingCellHighlights,
  fieldPermissionCellSeverity,
  formatObjectLabelForModalSummary,
  listFindingsForExportContainer,
  listFindingsForFieldPermissionCell,
  pickAssignmentExportClickableColumnKeys,
  pickPermissionSetExportClickableColumnKeys,
  pickTabVisibilityExportClickableColumnKeys,
  type PermissionAnalysisFinding,
  type PermissionExportRow,
  type SobjectExportDetail,
} from './permission-export-result-view';

const OBJECT_PERMISSIONS_OMIT_KEYS = new Set(['attributes', 'Id', 'ParentId']);

/** Bare (borderless) base icon buttons for object cell actions, grouped in SLDS button group. */
const OBJECT_TYPE_ACTION_BUTTON_CLASSNAME = 'slds-button slds-button_icon slds-button_icon-bare';

/** Default grid width for text columns; Object column needs extra space for label + actions. */
const DEFAULT_TEXT_COLUMN_WIDTH = 175;

/** Label + tooltip; optional Object Manager icon only (no separate info popover). */
const OBJECT_NAME_COLUMN_MIN_WIDTH_ONE_ACTION = 200;
/** `minmax` + `fr`: Object column grows; floor keeps label + icon actions usable. */
const EXPORT_GRID_OBJECT_NAME_FR = 1.65;

const PERMISSION_ANALYSIS_POPOVER_PANEL_PROPS = {
  onDoubleClick: (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  },
};

export type PermissionAnalysisExportGridVariant = 'default' | 'object_permissions';

/** Which export surface receives issue highlights and cell drill-in (see permission export analysis job). */
export type PermissionAnalysisExportFindingSurface =
  | 'none'
  | 'field_permissions'
  | 'container_row'
  | 'assignment_row'
  | 'tab_visibility_row';

export interface PermissionAnalysisExportGridProps {
  rows: PermissionExportRow[];
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  /** Describe + EntityDefinition metadata for SobjectType cells (label, API Name, description). */
  sobjectExportDetails?: Record<string, SobjectExportDetail>;
  /** `object_permissions` — hides Id/ParentId/attributes and adds Object Manager link on SobjectType. */
  variant?: PermissionAnalysisExportGridVariant;
  /** Parsed `analysis_job.result.findings` when this grid should surface issue rows. */
  findings?: PermissionAnalysisFinding[];
  /** How issues map onto this grid; defaults to `none`. */
  findingSurface?: PermissionAnalysisExportFindingSurface;
  /** Display names for permission set Ids (modal context lines). */
  containerLabelById?: Map<string, string>;
}

/** Object label (click for API / label / description popover, Field Usage–style) and optional Object Manager link. */
export const SobjectTypeCellContent: FunctionComponent<{
  apiName: string;
  detail: SobjectExportDetail | undefined;
  objectManager?: { org: SalesforceOrgUi; serverUrl: string; skipFrontDoorAuth: boolean };
}> = ({ apiName, detail, objectManager }) => {
  const label = detail?.label?.trim() ? detail.label.trim() : apiName;
  const descriptionText =
    detail?.description != null && String(detail.description).trim().length > 0 ? String(detail.description).trim() : null;
  const slug = apiName.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const objectManagerReturnUrl = `/lightning/setup/ObjectManager/${encodeURIComponent(apiName)}/Details/view`;
  const canDeepLink = Boolean(objectManager?.org?.uniqueId && objectManager.serverUrl);

  return (
    <div className="slds-grid slds-gutters_xx-small slds-grid_vertical-align-center">
      <div
        className="slds-col slds-grow"
        css={css`
          min-width: 0;
        `}
      >
        <Popover
          size="large"
          panelProps={PERMISSION_ANALYSIS_POPOVER_PANEL_PROPS}
          content={
            <div>
              {canDeepLink && objectManager ? (
                <SalesforceLogin
                  org={objectManager.org}
                  serverUrl={objectManager.serverUrl}
                  skipFrontDoorAuth={objectManager.skipFrontDoorAuth}
                  returnUrl={objectManagerReturnUrl}
                >
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
                    id={`perm-analysis-obj-${slug}-label`}
                    label="Object Label"
                    className="slds-p-bottom_x-small"
                    value={label}
                    bottomBorder
                  />
                </GridCol>
                <GridCol size={12}>
                  <ReadOnlyFormElement
                    id={`perm-analysis-obj-${slug}-api`}
                    label="Object API Name"
                    className="slds-p-bottom_x-small"
                    value={apiName}
                    bottomBorder
                  />
                </GridCol>
                <GridCol size={12}>
                  <ReadOnlyFormElement
                    id={`perm-analysis-obj-${slug}-desc`}
                    label="Description"
                    className="slds-p-bottom_x-small"
                    value={descriptionText ?? '—'}
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
            minWidth: 0,
            height: 'auto',
            padding: 0,
          }}
        >
          <span
            className="slds-truncate"
            title={label !== apiName ? `${label} (${apiName})` : label}
            onClick={(event: MouseEvent<HTMLSpanElement>) => {
              if (event.shiftKey || event.ctrlKey || event.metaKey) {
                if (!canDeepLink || !objectManager) {
                  return;
                }
                event.stopPropagation();
                event.preventDefault();
                salesforceLoginAndRedirect({
                  serverUrl: objectManager.serverUrl,
                  org: objectManager.org,
                  returnUrl: objectManagerReturnUrl,
                  skipFrontDoorAuth: objectManager.skipFrontDoorAuth,
                });
              }
            }}
          >
            {label}
          </span>
        </Popover>
      </div>
      {objectManager && (
        <div
          className="slds-col slds-no-flex"
          css={css`
            display: flex;
            align-items: center;
            column-gap: 0.375rem;
          `}
        >
          <SalesforceLogin
            org={objectManager.org}
            serverUrl={objectManager.serverUrl}
            skipFrontDoorAuth={objectManager.skipFrontDoorAuth}
            returnUrl={`/lightning/setup/ObjectManager/${encodeURIComponent(apiName)}/Details/view`}
            title={`Open ${apiName} in Object Manager`}
            omitIcon
            className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
          >
            <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
          </SalesforceLogin>
        </div>
      )}
    </div>
  );
};

function relaxExportPermissionColumnsForFlex(columns: ColumnWithFilter<RowWithKey>[]): ColumnWithFilter<RowWithKey>[] {
  return columns.map((column) => {
    if (typeof column.key !== 'string' || !column.key.startsWith('Permissions')) {
      return column;
    }
    return {
      ...column,
      width: 'minmax(100px, 0.32fr)',
      minWidth: 100,
    } as ColumnWithFilter<RowWithKey>;
  });
}

function applySobjectTypeColumn(
  columns: ColumnWithFilter<RowWithKey>[],
  options: {
    sobjectExportDetails?: Record<string, SobjectExportDetail>;
    objectManager?: { org: SalesforceOrgUi; serverUrl: string; skipFrontDoorAuth: boolean };
  },
): ColumnWithFilter<RowWithKey>[] {
  const { sobjectExportDetails, objectManager } = options;
  const detailCount = sobjectExportDetails ? Object.keys(sobjectExportDetails).length : 0;
  if (!objectManager && detailCount === 0) {
    return columns;
  }

  return columns.map((column) => {
    if (column.key !== 'SobjectType') {
      return column;
    }
    const priorMinWidth = typeof column.minWidth === 'number' ? column.minWidth : 0;
    const reservedMinWidth = objectManager ? OBJECT_NAME_COLUMN_MIN_WIDTH_ONE_ACTION : DEFAULT_TEXT_COLUMN_WIDTH;
    const objectNameFloor = Math.max(priorMinWidth, reservedMinWidth, DEFAULT_TEXT_COLUMN_WIDTH);

    return {
      ...column,
      minWidth: objectNameFloor,
      width: `minmax(${objectNameFloor}px, ${EXPORT_GRID_OBJECT_NAME_FR}fr)`,
      getValue: ({ row }) => {
        const api = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
        if (!api) {
          return null;
        }
        const detail = sobjectExportDetails?.[api];
        const label = detail?.label?.trim() ? detail.label.trim() : api;
        const parts = [label, api];
        if (detail?.description != null && String(detail.description).trim().length > 0) {
          parts.push(String(detail.description).trim());
        }
        return parts.join(' ');
      },
      renderCell: (props) => {
        const raw = props.row?.SobjectType;
        const apiName = typeof raw === 'string' ? raw.trim() : '';
        if (!apiName) {
          return <div className="slds-truncate">—</div>;
        }
        const detail = sobjectExportDetails?.[apiName];
        return <SobjectTypeCellContent apiName={apiName} detail={detail} objectManager={objectManager} />;
      },
    } as ColumnWithFilter<RowWithKey>;
  });
}

type FieldCellModalState = {
  kind: 'field';
  parentId: string;
  objectApiName: string;
  fieldApiName: string;
  columnKey: string;
  columnLabel: string;
  matches: PermissionAnalysisFinding[];
};

type ContainerModalState = {
  kind: 'container';
  containerId: string;
  columnLabel: string;
  matches: PermissionAnalysisFinding[];
};

type ExportFindingsModalState = FieldCellModalState | ContainerModalState | null;

function mergeFindingCellClass<T extends RowWithKey>(
  column: ColumnWithFilter<T>,
  extraClass: (row: T) => string | undefined,
): ColumnWithFilter<T> {
  const prior = column.cellClass;
  return {
    ...column,
    cellClass: (row: T) => {
      const a = typeof prior === 'function' ? prior(row) : prior;
      const b = extraClass(row);
      const merged = [a, b].filter(Boolean).join(' ');
      return merged.length > 0 ? merged : undefined;
    },
  } as ColumnWithFilter<T>;
}

/**
 * Read-only SOQL export rows with dynamic columns and quick filter.
 * Optional issue highlights for field permissions, permission set / profile rows, and assignments.
 */
export const PermissionAnalysisExportGrid: FunctionComponent<PermissionAnalysisExportGridProps> = ({
  rows,
  org,
  serverUrl,
  skipFrontdoorLogin,
  defaultApiVersion,
  sobjectExportDetails,
  variant = 'default',
  findings = [],
  findingSurface = 'none',
  containerLabelById,
}) => {
  const [modalState, setModalState] = useState<ExportFindingsModalState>(null);

  const fieldHighlights = useMemo(() => {
    if (findingSurface !== 'field_permissions' || findings.length === 0) {
      return null;
    }
    return buildFieldPermissionFindingCellHighlights(findings);
  }, [findingSurface, findings]);

  const containerSeverity = useMemo(() => {
    if (
      (findingSurface !== 'container_row' && findingSurface !== 'assignment_row' && findingSurface !== 'tab_visibility_row') ||
      findings.length === 0
    ) {
      return null;
    }
    return buildContainerIdFindingSeverity(findings);
  }, [findingSurface, findings]);

  const permissionSetClickColumns = useMemo(() => {
    if (findingSurface !== 'container_row' || rows.length === 0) {
      return [] as string[];
    }
    return pickPermissionSetExportClickableColumnKeys(rows[0]);
  }, [findingSurface, rows]);

  const assignmentClickColumns = useMemo(() => {
    if (findingSurface !== 'assignment_row' || rows.length === 0) {
      return [] as string[];
    }
    return pickAssignmentExportClickableColumnKeys(rows[0]);
  }, [findingSurface, rows]);

  const tabVisibilityClickColumns = useMemo(() => {
    if (findingSurface !== 'tab_visibility_row' || rows.length === 0) {
      return [] as string[];
    }
    return pickTabVisibilityExportClickableColumnKeys(rows[0]);
  }, [findingSurface, rows]);

  const baseColumns = useMemo(() => {
    const dynamicOptions = variant === 'object_permissions' ? { omitColumnKeys: OBJECT_PERMISSIONS_OMIT_KEYS } : undefined;

    const base = buildDynamicExportColumns(rows, dynamicOptions);

    const objectManager = variant === 'object_permissions' ? { org, serverUrl, skipFrontDoorAuth: skipFrontdoorLogin } : undefined;
    const detailCount = sobjectExportDetails ? Object.keys(sobjectExportDetails).length : 0;
    if (!objectManager && detailCount === 0) {
      return base;
    }
    const withObjectColumn = applySobjectTypeColumn(base, { sobjectExportDetails, objectManager });
    return relaxExportPermissionColumnsForFlex(withObjectColumn);
  }, [rows, variant, org, serverUrl, skipFrontdoorLogin, sobjectExportDetails]);

  const columns = useMemo(() => {
    if (findings.length === 0 || findingSurface === 'none') {
      return baseColumns;
    }

    if (findingSurface === 'field_permissions' && fieldHighlights) {
      return baseColumns.map((col) => {
        const key = typeof col.key === 'string' ? col.key : '';
        return mergeFindingCellClass(col, (row: RowWithKey) => {
          const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
          const objectApi = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
          const fieldApi = typeof row.Field === 'string' ? row.Field.trim() : '';
          if (!parentId || !objectApi || !fieldApi) {
            return undefined;
          }
          const severity = fieldPermissionCellSeverity(fieldHighlights, parentId, objectApi, fieldApi, key);
          if (severity === 'error') {
            return 'permission-finding-cell--error permission-finding-cell--clickable';
          }
          if (severity === 'warning') {
            return 'permission-finding-severity-cell--warning permission-finding-cell--clickable';
          }
          return undefined;
        });
      });
    }

    if (findingSurface === 'container_row' && containerSeverity) {
      return baseColumns.map((col) => {
        const key = typeof col.key === 'string' ? col.key : '';
        const isClickColumn = permissionSetClickColumns.includes(key);
        return mergeFindingCellClass(col, (row: RowWithKey) => {
          if (!isClickColumn) {
            return undefined;
          }
          const rowId = typeof row.Id === 'string' ? row.Id.trim() : '';
          if (!rowId) {
            return undefined;
          }
          const severity = containerSeverity.get(rowId);
          if (severity === 'error') {
            return 'permission-finding-cell--error permission-finding-cell--clickable';
          }
          if (severity === 'warning') {
            return 'permission-finding-severity-cell--warning permission-finding-cell--clickable';
          }
          return undefined;
        });
      });
    }

    if (findingSurface === 'assignment_row' && containerSeverity) {
      return baseColumns.map((col) => {
        const key = typeof col.key === 'string' ? col.key : '';
        const isClickColumn = assignmentClickColumns.includes(key);
        return mergeFindingCellClass(col, (row: RowWithKey) => {
          if (!isClickColumn) {
            return undefined;
          }
          const permissionSetId = typeof row.PermissionSetId === 'string' ? row.PermissionSetId.trim() : '';
          if (!permissionSetId) {
            return undefined;
          }
          const severity = containerSeverity.get(permissionSetId);
          if (severity === 'error') {
            return 'permission-finding-cell--error permission-finding-cell--clickable';
          }
          if (severity === 'warning') {
            return 'permission-finding-severity-cell--warning permission-finding-cell--clickable';
          }
          return undefined;
        });
      });
    }

    if (findingSurface === 'tab_visibility_row' && containerSeverity) {
      return baseColumns.map((col) => {
        const key = typeof col.key === 'string' ? col.key : '';
        const isClickColumn = tabVisibilityClickColumns.includes(key);
        return mergeFindingCellClass(col, (row: RowWithKey) => {
          if (!isClickColumn) {
            return undefined;
          }
          const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
          if (!parentId) {
            return undefined;
          }
          const severity = containerSeverity.get(parentId);
          if (severity === 'error') {
            return 'permission-finding-cell--error permission-finding-cell--clickable';
          }
          if (severity === 'warning') {
            return 'permission-finding-severity-cell--warning permission-finding-cell--clickable';
          }
          return undefined;
        });
      });
    }

    return baseColumns;
  }, [
    baseColumns,
    findings.length,
    findingSurface,
    fieldHighlights,
    containerSeverity,
    permissionSetClickColumns,
    assignmentClickColumns,
    tabVisibilityClickColumns,
  ]);

  const handleCellClick = useCallback(
    ({ row, column }: CellMouseArgs<RowWithKey, unknown>) => {
      if (findings.length === 0) {
        return;
      }
      const columnKey = typeof column.key === 'string' ? column.key : '';
      const columnLabel = typeof column.name === 'string' && column.name.trim().length > 0 ? column.name : columnKey;

      if (findingSurface === 'field_permissions' && fieldHighlights) {
        const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
        const objectApiName = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
        const fieldApiName = typeof row.Field === 'string' ? row.Field.trim() : '';
        if (!parentId || !objectApiName || !fieldApiName) {
          return;
        }
        const severity = fieldPermissionCellSeverity(fieldHighlights, parentId, objectApiName, fieldApiName, columnKey);
        if (!severity) {
          return;
        }
        const matches = listFindingsForFieldPermissionCell(findings, parentId, objectApiName, fieldApiName, columnKey);
        if (matches.length === 0) {
          return;
        }
        setModalState({
          kind: 'field',
          parentId,
          objectApiName,
          fieldApiName,
          columnKey,
          columnLabel,
          matches,
        });
        return;
      }

      if (findingSurface === 'container_row' && containerSeverity) {
        const rowId = typeof row.Id === 'string' ? row.Id.trim() : '';
        if (!rowId || !permissionSetClickColumns.includes(columnKey)) {
          return;
        }
        if (!containerSeverity.has(rowId)) {
          return;
        }
        const matches = listFindingsForExportContainer(findings, rowId);
        if (matches.length === 0) {
          return;
        }
        setModalState({
          kind: 'container',
          containerId: rowId,
          columnLabel,
          matches,
        });
        return;
      }

      if (findingSurface === 'assignment_row' && containerSeverity) {
        const permissionSetId = typeof row.PermissionSetId === 'string' ? row.PermissionSetId.trim() : '';
        if (!permissionSetId || !assignmentClickColumns.includes(columnKey)) {
          return;
        }
        if (!containerSeverity.has(permissionSetId)) {
          return;
        }
        const matches = listFindingsForExportContainer(findings, permissionSetId);
        if (matches.length === 0) {
          return;
        }
        setModalState({
          kind: 'container',
          containerId: permissionSetId,
          columnLabel,
          matches,
        });
        return;
      }

      if (findingSurface === 'tab_visibility_row' && containerSeverity) {
        const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
        if (!parentId || !tabVisibilityClickColumns.includes(columnKey)) {
          return;
        }
        if (!containerSeverity.has(parentId)) {
          return;
        }
        const matches = listFindingsForExportContainer(findings, parentId);
        if (matches.length === 0) {
          return;
        }
        setModalState({
          kind: 'container',
          containerId: parentId,
          columnLabel,
          matches,
        });
      }
    },
    [
      findings,
      findingSurface,
      fieldHighlights,
      containerSeverity,
      permissionSetClickColumns,
      assignmentClickColumns,
      tabVisibilityClickColumns,
    ],
  );

  const rowsMap = useMemo(() => new WeakMap(rows.map((row, index) => [row, `export-row-${index}`])), [rows]);
  const getRowKey = useCallback((row: PermissionExportRow) => rowsMap.get(row) ?? 'row', [rowsMap]);

  const fieldModalObjectSummary = useMemo(() => {
    if (!modalState || modalState.kind !== 'field') {
      return null;
    }
    return formatObjectLabelForModalSummary(modalState.objectApiName, sobjectExportDetails);
  }, [modalState, sobjectExportDetails]);

  if (!rows.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">No rows in this export slice.</ScopedNotification>
      </div>
    );
  }

  const showFindingClickHandler =
    findings.length > 0 &&
    (findingSurface === 'field_permissions' ||
      findingSurface === 'container_row' ||
      findingSurface === 'assignment_row' ||
      findingSurface === 'tab_visibility_row');

  return (
    <AutoFullHeightContainer
      fillHeight
      bottomBuffer={24}
      baseCss={css`
        min-height: 200px;
      `}
    >
      <DataTable
        org={org}
        serverUrl={serverUrl}
        skipFrontdoorLogin={skipFrontdoorLogin}
        columns={columns}
        data={rows}
        getRowKey={getRowKey}
        includeQuickFilter
        context={{ defaultApiVersion }}
        onCellClick={showFindingClickHandler ? handleCellClick : undefined}
      />

      {modalState?.kind === 'field' && (
        <PermissionAnalysisFindingsModal
          testId="permission-analysis-field-cell-issues"
          open
          title="Issues for this cell"
          tagline="From this job's permission export analysis, scoped to the field permission cell you clicked."
          onClose={() => setModalState(null)}
          findings={modalState.matches}
          summaryLine={
            <Fragment>
              <strong>{modalState.columnLabel}</strong>
              {' · '}
              {fieldModalObjectSummary?.displayLabel ? (
                fieldModalObjectSummary.showApiInParens ? (
                  <Fragment>
                    <strong>{fieldModalObjectSummary.displayLabel}</strong>
                    <span className="slds-text-color_weak">
                      {' '}
                      (<code>{modalState.objectApiName}</code>)
                    </span>
                  </Fragment>
                ) : (
                  <code>{fieldModalObjectSummary.displayLabel}</code>
                )
              ) : null}
              {' · '}
              <code>{modalState.fieldApiName}</code>
              {' · '}
              {containerLabelById?.get(modalState.parentId) ?? modalState.parentId} — {modalState.matches.length}{' '}
              {modalState.matches.length === 1 ? 'issue' : 'issues'}
            </Fragment>
          }
        />
      )}

      {modalState?.kind === 'container' && (
        <PermissionAnalysisFindingsModal
          testId="permission-analysis-container-issues"
          open
          title="Issues for this permission set"
          tagline="From this job's permission export analysis, scoped to the permission set (or profile) or tab-setting parent you clicked."
          onClose={() => setModalState(null)}
          findings={modalState.matches}
          summaryLine={
            <Fragment>
              <strong>{modalState.columnLabel}</strong>
              {' · '}
              {containerLabelById?.get(modalState.containerId) ?? modalState.containerId} — {modalState.matches.length}{' '}
              {modalState.matches.length === 1 ? 'issue' : 'issues'}
            </Fragment>
          }
        />
      )}
    </AutoFullHeightContainer>
  );
};

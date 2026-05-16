/* eslint-disable react-hooks/refs */
import { css } from '@emotion/react';
import type { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  DataTree,
  getProfileOrPermSetSetupUrl,
  getRowTypeFromValue,
  Grid,
  GridCol,
  Icon,
  KeyboardShortcut,
  Popover,
  ReadOnlyFormElement,
  SalesforceLogin,
  salesforceLoginAndRedirect,
  ScopedNotification,
  setColumnFromType,
  type ProfileOrPermSetRecordType,
} from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import {
  forwardRef,
  Fragment,
  FunctionComponent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import type { CellMouseArgs, RenderCellProps, RenderGroupCellProps } from 'react-data-grid';
import { usePermissionAnalysisExportMetadata } from './permission-analysis-export-metadata-context';
import { permissionAnalysisPermissionContainerGroupTitleLine } from './permission-analysis-tree-group-title';
import { permissionAnalysisAssignmentTypeLabelCss } from './permission-analysis-viewer-badge.styles';
import {
  buildFieldPermissionFindingCellHighlights,
  buildPermissionSetIdLabelMap,
  FIELD_PERMISSION_BOOLEAN_COLUMN_KEYS,
  fieldExportDetailLookupKey,
  fieldPermissionCellSeverity,
  fieldPermissionQualifiedFieldShortApi,
  formatObjectLabelForModalSummary,
  getExportColumnHeaderLabel,
  listFindingsForFieldPermissionCell,
  sortFieldPermissionExportRowsForAnalysisTree,
  type PermissionAnalysisFinding,
  type PermissionExportRow,
  type SobjectExportDetail,
} from './permission-export-result-view';
import { SobjectTypeCellContent } from './PermissionAnalysisExportGrid';
import { PermissionAnalysisFindingsModal } from './PermissionAnalysisFindingsModal';
import { buildPermissionSetTooltipFieldsFromExportRow, PermissionSetDetailPopoverContent } from './PermissionAnalysisPermissionSetsTree';

const TREE_GROUP_BY = ['_treePermSetGroupKey', '_treeObjectGroupKey'] as const;

const TREE_PERM_SET_MIN_PX = 140;
const TREE_PERM_SET_MAX_PX = 420;
const TREE_COL_PERM_SET = `minmax(${TREE_PERM_SET_MIN_PX}px, min(${TREE_PERM_SET_MAX_PX}px, 1.35fr))`;

const TREE_OBJECT_GROUP_WIDTH_PX = 236;

const TREE_FIELD_COL = `minmax(200px, min(320px, 1.25fr))`;
const TREE_COL_PERMISSION_BOOL = 'minmax(104px, 0.42fr)';

const TREE_MIN_PERM_SET = TREE_PERM_SET_MIN_PX;
const TREE_MIN_PERMISSION_BOOL = 104;

const TREE_ROW_HEIGHT_LEAF_PX = 35;
const TREE_ROW_HEIGHT_GROUP_PX = 68;

const OBJECT_TYPE_ACTION_BUTTON_CLASSNAME = 'slds-button slds-button_icon slds-button_icon-bare';

const PERMISSION_ANALYSIS_POPOVER_PANEL_PROPS = {
  onDoubleClick: (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  },
};

function resolveSetupTargetForFieldTreeParentRow(
  permissionSetId: string,
  row: PermissionExportRow | undefined,
): { recordType: ProfileOrPermSetRecordType; recordId: string } {
  if (!row) {
    return { recordType: 'PermissionSet', recordId: permissionSetId };
  }
  const profileId = typeof row.ProfileId === 'string' && row.ProfileId.trim().length > 0 ? row.ProfileId.trim() : null;
  const isProfileOwned = row.IsOwnedByProfile === true;
  if (isProfileOwned && profileId) {
    return { recordType: 'Profile', recordId: profileId };
  }
  return { recordType: 'PermissionSet', recordId: permissionSetId };
}

export type FieldPermissionTreeRow = PermissionExportRow & {
  _treePermSetGroupKey: string;
  _treeObjectGroupKey: string;
};

function buildFieldPermissionTreeRows(fieldPermissionRows: PermissionExportRow[]): FieldPermissionTreeRow[] {
  return fieldPermissionRows.map((row, index) => {
    const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
    const sobjectType = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
    return {
      ...row,
      _treePermSetGroupKey: parentId || `__missing_parent_${index}`,
      _treeObjectGroupKey: sobjectType || `__missing_object_${index}`,
    };
  });
}

function collectAllFieldPermissionExpandedGroupIds(rows: readonly PermissionExportRow[]): Set<unknown> {
  const ids = new Set<unknown>();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
    const sobjectType = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
    const permSetKey = parentId || `__missing_parent_${index}`;
    const objectKey = sobjectType || `__missing_object_${index}`;
    ids.add(permSetKey);
    ids.add(`${permSetKey}__${objectKey}`);
  }
  return ids;
}

function renderFieldPermissionPermissionSetGroupCell(
  labelByParentId: Map<string, string>,
  permissionSetRowById: Map<string, PermissionExportRow>,
  setupLogin: { org: SalesforceOrgUi; serverUrl: string; skipFrontDoorAuth: boolean },
  { groupKey, childRows, isExpanded, toggleGroup }: RenderGroupCellProps<FieldPermissionTreeRow>,
) {
  const id = String(groupKey);
  const exportLabel = labelByParentId.get(id) ?? id;
  const permSetRow = permissionSetRowById.get(id);
  const isProfileOwned = permSetRow?.IsOwnedByProfile === true;
  const titleLine = permissionAnalysisPermissionContainerGroupTitleLine(exportLabel, isProfileOwned);
  const typeKind = isProfileOwned ? 'profile' : 'permission_set';
  const typeCaption = isProfileOwned ? 'Profile' : 'Permission set';
  const detailFields = buildPermissionSetTooltipFieldsFromExportRow(permSetRow) ?? {
    label: exportLabel,
    name: '—',
    description: null,
    createdWhen: null,
    createdByName: null,
    lastModifiedWhen: null,
    lastModifiedByName: null,
  };
  const { recordType, recordId } = resolveSetupTargetForFieldTreeParentRow(id, permSetRow);
  const returnUrl = getProfileOrPermSetSetupUrl(recordType, recordId);
  const containerKind: 'Profile' | 'PermissionSet' = recordType === 'Profile' ? 'Profile' : 'PermissionSet';
  const detailSlug = id.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const canDeepLink = Boolean(setupLogin.org?.uniqueId && setupLogin.serverUrl);

  return (
    <div
      css={css`
        display: flex;
        align-items: flex-start;
        column-gap: 0.25rem;
        width: 100%;
        height: 100%;
        line-height: 1.35;
        overflow-wrap: anywhere;
        padding: 0.25rem 0.35rem;
        white-space: normal;
        word-break: break-word;
      `}
    >
      <button
        type="button"
        className="slds-button slds-button_reset slds-p-around_xx-small"
        title={isExpanded ? 'Collapse' : 'Expand'}
        aria-expanded={isExpanded}
        css={css`
          flex-shrink: 0;
          line-height: 1;
          margin-top: 0.125rem;
        `}
        onClick={toggleGroup}
      >
        <Icon
          type="utility"
          icon={isExpanded ? 'chevrondown' : 'chevronright'}
          className="slds-icon slds-icon-text-default slds-icon_x-small"
          omitContainer
          description={isExpanded ? 'Collapse' : 'Expand'}
        />
      </button>
      <Popover
        size="large"
        panelProps={PERMISSION_ANALYSIS_POPOVER_PANEL_PROPS}
        content={
          <PermissionSetDetailPopoverContent
            fields={detailFields}
            containerKind={containerKind}
            setupLogin={setupLogin}
            returnUrl={returnUrl}
            slug={detailSlug}
          />
        }
        buttonProps={{
          className: 'slds-button slds-button_reset slds-text-align_left',
        }}
        buttonStyle={{
          flex: 1,
          minWidth: 0,
          height: 'auto',
          alignItems: 'flex-start',
          display: 'flex',
          padding: 0,
        }}
      >
        <span
          css={css`
            flex: 1;
            min-width: 0;
            text-align: left;
          `}
          onClick={(event: MouseEvent<HTMLSpanElement>) => {
            if (event.shiftKey || event.ctrlKey || event.metaKey) {
              if (!canDeepLink) {
                return;
              }
              event.stopPropagation();
              event.preventDefault();
              salesforceLoginAndRedirect({
                serverUrl: setupLogin.serverUrl,
                org: setupLogin.org,
                returnUrl,
                skipFrontDoorAuth: setupLogin.skipFrontDoorAuth,
              });
            }
          }}
        >
          <p className="slds-text-body_small slds-m-bottom_xx-small">
            <span css={permissionAnalysisAssignmentTypeLabelCss(typeKind)}>{typeCaption}</span>
          </p>
          <span
            css={css`
              display: flex;
              align-items: baseline;
              flex-wrap: wrap;
              column-gap: 0.35rem;
              min-width: 0;
            `}
          >
            <span className="text-bold slds-truncate">{titleLine}</span>
            <span className="slds-text-body_small slds-text-color_weak slds-no-flex">({childRows.length})</span>
          </span>
        </span>
      </Popover>
    </div>
  );
}

interface FieldPermissionObjectGroupCellContentProps {
  groupKey: unknown;
  childRows: readonly FieldPermissionTreeRow[];
  isExpanded: boolean;
  toggleGroup: () => void;
  objectManager: { org: SalesforceOrgUi; serverUrl: string; skipFrontDoorAuth: boolean };
}

/**
 * Renders the per-object group header inside the field permissions tree.
 * Reads `sobjectExportDetails` via context so async label loads repaint this cell without rebuilding
 * the parent `columns` memo (which would force `useDataTable` to redo its INIT/set-filter pass).
 */
function FieldPermissionObjectGroupCellContent({
  groupKey,
  childRows,
  isExpanded,
  toggleGroup,
  objectManager,
}: FieldPermissionObjectGroupCellContentProps) {
  const { sobjectExportDetails } = usePermissionAnalysisExportMetadata();
  const apiName = String(groupKey).trim();
  if (!apiName) {
    return null;
  }
  const detail = sobjectExportDetails?.[apiName];
  return (
    <div
      css={css`
        display: flex;
        align-items: flex-start;
        column-gap: 0.25rem;
        width: 100%;
        height: 100%;
        padding: 0.125rem 0.35rem 0.25rem;
      `}
    >
      <button
        type="button"
        className="slds-button slds-button_reset slds-p-around_xx-small"
        title={isExpanded ? 'Collapse' : 'Expand'}
        aria-expanded={isExpanded}
        css={css`
          flex-shrink: 0;
          line-height: 1;
          margin-top: 0.125rem;
        `}
        onClick={toggleGroup}
      >
        <Icon
          type="utility"
          icon={isExpanded ? 'chevrondown' : 'chevronright'}
          className="slds-icon slds-icon-text-default slds-icon_x-small"
          omitContainer
          description={isExpanded ? 'Collapse' : 'Expand'}
        />
      </button>
      <div
        css={css`
          flex: 1;
          min-width: 0;
        `}
      >
        <p className="slds-text-body_small slds-m-bottom_xx-small slds-text-color_weak">Object</p>
        <div
          css={css`
            display: flex;
            align-items: center;
            column-gap: 0.35rem;
            flex-wrap: wrap;
          `}
        >
          <div
            css={css`
              flex: 1;
              min-width: 0;
            `}
          >
            <SobjectTypeCellContent apiName={apiName} detail={detail} objectManager={objectManager} />
          </div>
          <span className="slds-text-body_small slds-text-color_weak slds-no-flex">({childRows.length})</span>
          <SalesforceLogin
            org={objectManager.org}
            serverUrl={objectManager.serverUrl}
            skipFrontDoorAuth={objectManager.skipFrontDoorAuth}
            returnUrl={`/lightning/setup/ObjectManager/${encodeURIComponent(apiName)}/FieldsAndRelationships/view`}
            title={`Open Fields & Relationships for ${apiName}`}
            omitIcon
            className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
          </SalesforceLogin>
        </div>
      </div>
    </div>
  );
}

interface FieldPermissionFieldCellContentProps {
  row: FieldPermissionTreeRow | undefined;
  objectManager: { org: SalesforceOrgUi; serverUrl: string; skipFrontDoorAuth: boolean };
}

/**
 * Renders the Field column cell. Subscribes to metadata via context so a metadata batch repaints
 * just the visible cells without invalidating the parent `columns` memo (and dragging `useDataTable`
 * through a full set-filter / search-index rebuild).
 */
function FieldPermissionFieldCellContent({ row, objectManager }: FieldPermissionFieldCellContentProps) {
  const { sobjectExportDetails, fieldExportDetails } = usePermissionAnalysisExportMetadata();
  const obj = typeof row?.SobjectType === 'string' ? row.SobjectType.trim() : '';
  const short = row ? fieldPermissionQualifiedFieldShortApi(row) : '';
  const full = typeof row?.Field === 'string' ? row.Field.trim() : '';
  const lookupKey = obj && short ? fieldExportDetailLookupKey(obj, short) : '';
  const fd = lookupKey ? fieldExportDetails?.[lookupKey] : undefined;
  const label = fd?.label?.trim() ? fd.label.trim() : short || full;
  const apiLine = short || full;
  const descriptionText = fd?.description != null && String(fd.description).trim().length > 0 ? String(fd.description).trim() : null;
  const durableId = fd?.durableId?.trim() ? fd.durableId.trim() : null;
  const fieldSetupUrl =
    durableId && obj
      ? `/lightning/setup/ObjectManager/${encodeURIComponent(obj)}/FieldsAndRelationships/${encodeURIComponent(durableId)}/view`
      : null;
  const fieldSlug = `${obj}-${apiLine}`.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const canFieldDeepLink = Boolean(fieldSetupUrl && objectManager.org?.uniqueId && objectManager.serverUrl);
  const parentObjectLabel = obj && sobjectExportDetails?.[obj]?.label?.trim() ? String(sobjectExportDetails[obj].label).trim() : obj;
  const parentObjectSummary = obj ? `${parentObjectLabel} (${obj})` : '—';

  if (!label && !full) {
    return <div className="slds-truncate">—</div>;
  }

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
              {canFieldDeepLink && fieldSetupUrl ? (
                <SalesforceLogin
                  org={objectManager.org}
                  serverUrl={objectManager.serverUrl}
                  skipFrontDoorAuth={objectManager.skipFrontDoorAuth}
                  returnUrl={fieldSetupUrl}
                >
                  View in Salesforce
                </SalesforceLogin>
              ) : null}
              <Grid
                wrap
                gutters
                className={canFieldDeepLink ? 'slds-m-top_x-small' : undefined}
                css={css`
                  min-height: 80px;
                `}
              >
                <GridCol size={12}>
                  <ReadOnlyFormElement
                    id={`perm-analysis-field-${fieldSlug}-obj`}
                    label="Parent Object"
                    className="slds-p-bottom_x-small"
                    value={parentObjectSummary}
                    bottomBorder
                  />
                </GridCol>
                <GridCol size={12}>
                  <ReadOnlyFormElement
                    id={`perm-analysis-field-${fieldSlug}-api`}
                    label="Field API Name"
                    className="slds-p-bottom_x-small"
                    value={apiLine}
                    bottomBorder
                  />
                </GridCol>
                <GridCol size={12}>
                  <ReadOnlyFormElement
                    id={`perm-analysis-field-${fieldSlug}-label`}
                    label="Field Label"
                    className="slds-p-bottom_x-small"
                    value={label}
                    bottomBorder
                  />
                </GridCol>
                <GridCol size={12}>
                  <ReadOnlyFormElement
                    id={`perm-analysis-field-${fieldSlug}-desc`}
                    label="Description"
                    className="slds-p-bottom_x-small"
                    value={descriptionText ?? '—'}
                    bottomBorder
                  />
                </GridCol>
                {canFieldDeepLink ? (
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
            title={label !== apiLine ? `${label} (${apiLine})` : label}
            onClick={(event: MouseEvent<HTMLSpanElement>) => {
              if (event.shiftKey || event.ctrlKey || event.metaKey) {
                if (!canFieldDeepLink || !fieldSetupUrl) {
                  return;
                }
                event.stopPropagation();
                event.preventDefault();
                salesforceLoginAndRedirect({
                  serverUrl: objectManager.serverUrl,
                  org: objectManager.org,
                  returnUrl: fieldSetupUrl,
                  skipFrontDoorAuth: objectManager.skipFrontDoorAuth,
                });
              }
            }}
          >
            {label || apiLine}
          </span>
        </Popover>
      </div>
      {fieldSetupUrl ? (
        <div className="slds-col slds-no-flex">
          <SalesforceLogin
            org={objectManager.org}
            serverUrl={objectManager.serverUrl}
            skipFrontDoorAuth={objectManager.skipFrontDoorAuth}
            returnUrl={fieldSetupUrl}
            title="Open this field in Fields & Relationships"
            omitIcon
            className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
          >
            <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
          </SalesforceLogin>
        </div>
      ) : null}
    </div>
  );
}

function isFieldPermissionLeafRow(row: unknown): row is FieldPermissionTreeRow {
  if (row === null || typeof row !== 'object') {
    return false;
  }
  const record = row as Record<string, unknown>;
  return typeof record.ParentId === 'string' && record.ParentId.trim().length > 0;
}

interface CellFindingsModalState {
  parentId: string;
  objectApiName: string;
  fieldApiName: string;
  columnKey: string;
  columnLabel: string;
  matches: PermissionAnalysisFinding[];
}

interface CellFindingsModalHostHandle {
  open: (state: CellFindingsModalState) => void;
}

interface CellFindingsModalHostProps {
  labelByParentId: Map<string, string>;
  sobjectExportDetails?: Record<string, SobjectExportDetail>;
}

/**
 * Owns the cell-findings modal state in isolation so opening/closing the modal doesn't re-render
 * the field-permissions tree (which would cascade 1000+ Cell re-renders for large datasets).
 * The parent calls `open(state)` imperatively via the forwarded ref.
 */
const CellFindingsModalHost = forwardRef<CellFindingsModalHostHandle, CellFindingsModalHostProps>(
  ({ labelByParentId, sobjectExportDetails }, ref) => {
    const [state, setState] = useState<CellFindingsModalState | null>(null);

    useImperativeHandle(ref, () => ({ open: setState }), []);

    const objectSummary = useMemo(() => {
      if (!state) {
        return null;
      }
      return formatObjectLabelForModalSummary(state.objectApiName, sobjectExportDetails);
    }, [state, sobjectExportDetails]);

    if (!state) {
      return null;
    }
    return (
      <PermissionAnalysisFindingsModal
        testId="permission-analysis-field-cell-issues-tree"
        open
        title="Issues for this cell"
        tagline="From this job's permission export analysis, scoped to the field permission cell you clicked."
        onClose={() => setState(null)}
        findings={state.matches}
        summaryLine={
          <Fragment>
            <strong>{state.columnLabel}</strong>
            {' · '}
            {objectSummary?.displayLabel ? (
              objectSummary.showApiInParens ? (
                <Fragment>
                  <strong>{objectSummary.displayLabel}</strong>
                  <span className="slds-text-color_weak">
                    {' '}
                    (<code>{state.objectApiName}</code>)
                  </span>
                </Fragment>
              ) : (
                <code>{objectSummary.displayLabel}</code>
              )
            ) : null}
            {' · '}
            <code>{state.fieldApiName}</code>
            {' · '}
            {labelByParentId.get(state.parentId) ?? state.parentId} — {state.matches.length}{' '}
            {state.matches.length === 1 ? 'issue' : 'issues'}
          </Fragment>
        }
      />
    );
  },
);
CellFindingsModalHost.displayName = 'CellFindingsModalHost';

export interface PermissionAnalysisFieldPermissionsTreeProps {
  fieldPermissionRows: PermissionExportRow[];
  permissionSetRows: PermissionExportRow[];
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  sobjectExportDetails?: Record<string, SobjectExportDetail>;
  findings?: PermissionAnalysisFinding[];
}

/**
 * Field permissions grouped by profile or permission set, then by object; Read and Edit columns match object-level order.
 */
export const PermissionAnalysisFieldPermissionsTree: FunctionComponent<PermissionAnalysisFieldPermissionsTreeProps> = ({
  fieldPermissionRows,
  permissionSetRows,
  org,
  serverUrl,
  skipFrontdoorLogin,
  defaultApiVersion,
  sobjectExportDetails,
  findings = [],
}) => {
  const { fieldExportDetails } = usePermissionAnalysisExportMetadata();
  /**
   * Sort by API name only — keeps `sortedRows` identity stable across async metadata loads so
   * `treeRows`, `columns`, and the rdg row-array reference don't churn on each label batch.
   * Cells still re-display updated labels because cell renderers read metadata at render time.
   */
  const sortedRows = useMemo(
    () => sortFieldPermissionExportRowsForAnalysisTree(fieldPermissionRows, permissionSetRows),
    [fieldPermissionRows, permissionSetRows],
  );
  const treeRows = useMemo(() => buildFieldPermissionTreeRows(sortedRows), [sortedRows]);
  const labelByParentId = useMemo(() => buildPermissionSetIdLabelMap(permissionSetRows), [permissionSetRows]);
  const permissionSetRowById = useMemo(() => {
    const map = new Map<string, PermissionExportRow>();
    for (const row of permissionSetRows) {
      const rowId = typeof row.Id === 'string' ? row.Id.trim() : '';
      if (rowId) {
        map.set(rowId, row);
      }
    }
    return map;
  }, [permissionSetRows]);

  const findingCellHighlights = useMemo(() => buildFieldPermissionFindingCellHighlights(findings), [findings]);

  /**
   * Read finding highlights through a ref inside `cellClass` so the `columns` memo identity stays
   * stable when findings change. Otherwise every findings update invalidates `columns`, which forces
   * `useDataTable` to rebuild the per-row search index (~40K ops on 6729 rows) and re-render.
   */
  const findingCellHighlightsRef = useRef(findingCellHighlights);
  findingCellHighlightsRef.current = findingCellHighlights;

  /**
   * Same trick for async metadata: cells that need labels read them through context (see
   * `FieldPermissionObjectGroupCellContent` / `FieldPermissionFieldCellContent`) so a metadata
   * batch landing repaints just the visible cells. `getValue` runs outside of render (sort/filter
   * pipelines) and can't use hooks, so it reads through these refs instead.
   */
  const sobjectExportDetailsRef = useRef(sobjectExportDetails);
  sobjectExportDetailsRef.current = sobjectExportDetails;
  const fieldExportDetailsRef = useRef(fieldExportDetails);
  fieldExportDetailsRef.current = fieldExportDetails;

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<unknown>>(() => new Set());
  const cellFindingsModalHostRef = useRef<CellFindingsModalHostHandle>(null);

  /**
   * Reset expand-all only when the underlying job data actually changes (new analysis loaded).
   * Sorting / metadata refresh changes `treeRows` identity but not `fieldPermissionRows`, so
   * the user's manually-collapsed groups stick during initial metadata loading.
   */
  useEffect(() => {
    setExpandedGroupIds(collectAllFieldPermissionExpandedGroupIds(fieldPermissionRows));
  }, [fieldPermissionRows]);

  const objectManager = useMemo(() => ({ org, serverUrl, skipFrontDoorAuth: skipFrontdoorLogin }), [org, serverUrl, skipFrontdoorLogin]);

  const columns = useMemo((): ColumnWithFilter<FieldPermissionTreeRow>[] => {
    if (!treeRows.length) {
      return [];
    }
    const row0 = treeRows[0];

    const groupPermSetCol: ColumnWithFilter<FieldPermissionTreeRow> = {
      ...setColumnFromType<FieldPermissionTreeRow>('_treePermSetGroupKey', 'text'),
      name: 'Profile / Permission set',
      key: '_treePermSetGroupKey',
      field: '_treePermSetGroupKey',
      resizable: true,
      width: TREE_COL_PERM_SET,
      minWidth: TREE_MIN_PERM_SET,
      maxWidth: TREE_PERM_SET_MAX_PX,
      renderGroupCell: (props) => renderFieldPermissionPermissionSetGroupCell(labelByParentId, permissionSetRowById, objectManager, props),
      getValue: ({ row }) => {
        const id = row._treePermSetGroupKey;
        return labelByParentId.get(id) ?? id;
      },
    } as ColumnWithFilter<FieldPermissionTreeRow>;

    const groupObjectCol: ColumnWithFilter<FieldPermissionTreeRow> = {
      ...setColumnFromType<FieldPermissionTreeRow>('_treeObjectGroupKey', 'textOrSalesforceId'),
      name: 'Object',
      key: '_treeObjectGroupKey',
      field: '_treeObjectGroupKey',
      resizable: false,
      width: TREE_OBJECT_GROUP_WIDTH_PX,
      minWidth: TREE_OBJECT_GROUP_WIDTH_PX,
      maxWidth: TREE_OBJECT_GROUP_WIDTH_PX,
      renderGroupCell: ({ groupKey, childRows, isExpanded, toggleGroup }) => (
        <FieldPermissionObjectGroupCellContent
          groupKey={groupKey}
          childRows={childRows}
          isExpanded={isExpanded}
          toggleGroup={toggleGroup}
          objectManager={objectManager}
        />
      ),
      getValue: ({ row }) => {
        const api = row._treeObjectGroupKey;
        const detail = sobjectExportDetailsRef.current?.[api];
        const label = detail?.label?.trim() ? detail.label.trim() : api;
        return label;
      },
    } as ColumnWithFilter<FieldPermissionTreeRow>;

    const fieldCol: ColumnWithFilter<FieldPermissionTreeRow> = {
      ...setColumnFromType<FieldPermissionTreeRow>('Field', 'text'),
      name: 'Field',
      key: 'Field',
      field: 'Field',
      resizable: true,
      width: TREE_FIELD_COL,
      getValue: ({ row }) => {
        const obj = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
        const short = fieldPermissionQualifiedFieldShortApi(row);
        const full = typeof row.Field === 'string' ? row.Field.trim() : '';
        const key = obj && short ? fieldExportDetailLookupKey(obj, short) : '';
        const fd = key ? fieldExportDetailsRef.current?.[key] : undefined;
        const label = fd?.label?.trim() ? fd.label.trim() : short || full;
        return label || '—';
      },
      renderCell: (props: RenderCellProps<FieldPermissionTreeRow, unknown>) => (
        <FieldPermissionFieldCellContent row={props.row} objectManager={objectManager} />
      ),
    } as ColumnWithFilter<FieldPermissionTreeRow>;

    const permissionCols: ColumnWithFilter<FieldPermissionTreeRow>[] = [];
    for (const key of FIELD_PERMISSION_BOOLEAN_COLUMN_KEYS) {
      if (!(key in row0)) {
        continue;
      }
      const fieldType = getRowTypeFromValue(row0[key], false);
      const headerLabel = getExportColumnHeaderLabel(key);
      permissionCols.push({
        ...setColumnFromType<FieldPermissionTreeRow>(key, fieldType),
        name: headerLabel,
        key,
        field: key,
        resizable: true,
        width: TREE_COL_PERMISSION_BOOL,
        minWidth: TREE_MIN_PERMISSION_BOOL,
        cellClass: (row: FieldPermissionTreeRow) => {
          if (!isFieldPermissionLeafRow(row)) {
            return undefined;
          }
          if (key !== 'PermissionsRead' && key !== 'PermissionsEdit') {
            return undefined;
          }
          const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
          const sobjectType = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
          const fieldFull = typeof row.Field === 'string' ? row.Field.trim() : '';
          if (!parentId || !sobjectType || !fieldFull) {
            return undefined;
          }
          const severity = fieldPermissionCellSeverity(findingCellHighlightsRef.current, parentId, sobjectType, fieldFull, key);
          if (severity === 'error') {
            return 'permission-finding-cell--error permission-finding-cell--clickable';
          }
          if (severity === 'warning') {
            return 'permission-finding-severity-cell--warning permission-finding-cell--clickable';
          }
          return undefined;
        },
      } as ColumnWithFilter<FieldPermissionTreeRow>);
    }

    return [groupPermSetCol, groupObjectCol, fieldCol, ...permissionCols];
    // Reads intentionally routed through refs/context so the columns memo stays stable:
    // - `findingCellHighlights` via `findingCellHighlightsRef.current` inside `cellClass`
    // - `sobjectExportDetails` / `fieldExportDetails` via refs in `getValue` and via context in the
    //   `FieldPermissionObjectGroupCellContent` / `FieldPermissionFieldCellContent` cell components
    // Keeping all of those out of deps stops `useDataTable` from redoing its INIT pass and the
    // per-row search-index rebuild every time findings or async label metadata change.
  }, [treeRows, labelByParentId, permissionSetRowById, objectManager]);

  const getRowKey = useCallback((row: FieldPermissionTreeRow) => {
    if (typeof row.Id === 'string' && row.Id.length > 0) {
      return row.Id;
    }
    const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
    const obj = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
    const field = typeof row.Field === 'string' ? row.Field.trim() : '';
    return `${parentId}::${obj}::${field}`;
  }, []);

  const handleCellClick = useCallback(
    ({ row, column }: CellMouseArgs<FieldPermissionTreeRow, unknown>) => {
      if (!isFieldPermissionLeafRow(row)) {
        return;
      }
      const columnKey = typeof column.key === 'string' ? column.key : '';
      if (columnKey !== 'PermissionsRead' && columnKey !== 'PermissionsEdit') {
        return;
      }
      const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
      const objectApiName = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
      const fieldApiName = typeof row.Field === 'string' ? row.Field.trim() : '';
      if (!parentId || !objectApiName || !fieldApiName) {
        return;
      }
      const highlightSeverity = fieldPermissionCellSeverity(findingCellHighlights, parentId, objectApiName, fieldApiName, columnKey);
      if (!highlightSeverity) {
        return;
      }
      const matches = listFindingsForFieldPermissionCell(findings, parentId, objectApiName, fieldApiName, columnKey);
      if (matches.length === 0) {
        return;
      }
      const columnLabel = typeof column.name === 'string' && column.name.trim().length > 0 ? column.name : columnKey;
      cellFindingsModalHostRef.current?.open({
        parentId,
        objectApiName,
        fieldApiName,
        columnKey,
        columnLabel,
        matches,
      });
    },
    [findingCellHighlights, findings],
  );

  if (!fieldPermissionRows.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">No field permission rows in this export.</ScopedNotification>
      </div>
    );
  }

  return (
    <AutoFullHeightContainer
      fillHeight
      bottomBuffer={24}
      baseCss={css`
        min-height: 200px;
      `}
    >
      <DataTree
        org={org}
        serverUrl={serverUrl}
        skipFrontdoorLogin={skipFrontdoorLogin}
        columns={columns}
        data={treeRows}
        getRowKey={getRowKey}
        includeQuickFilter
        context={{ defaultApiVersion }}
        groupBy={[...TREE_GROUP_BY]}
        rowGrouper={groupBy}
        expandedGroupIds={expandedGroupIds}
        onExpandedGroupIdsChange={setExpandedGroupIds}
        rowHeight={({ type }) => (type === 'GROUP' ? TREE_ROW_HEIGHT_GROUP_PX : TREE_ROW_HEIGHT_LEAF_PX)}
        onCellClick={handleCellClick}
      />

      <CellFindingsModalHost ref={cellFindingsModalHostRef} labelByParentId={labelByParentId} sobjectExportDetails={sobjectExportDetails} />
    </AutoFullHeightContainer>
  );
};

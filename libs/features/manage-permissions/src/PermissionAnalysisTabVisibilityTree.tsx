import { css } from '@emotion/react';
import type { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  DataTree,
  Icon,
  SalesforceLogin,
  ScopedNotification,
  getProfileOrPermSetSetupUrl,
  getRowTypeFromValue,
  setColumnFromType,
} from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import type { RenderCellProps, RenderGroupCellProps } from 'react-data-grid';
import { permissionAnalysisAssignmentTypeLabelCss } from './permission-analysis-viewer-badge.styles';
import { PermissionAnalysisFindingsModal } from './PermissionAnalysisFindingsModal';
import {
  buildContainerIdFindingSeverity,
  buildPermissionSetIdLabelMap,
  formatTabSettingVisibilityDisplay,
  getExportColumnHeaderLabel,
  listFindingsForExportContainer,
  sortTabSettingExportRowsForAnalysisTree,
  type PermissionAnalysisFinding,
  type PermissionExportRow,
  type PermissionObjectFindingCellSeverity,
} from './permission-export-result-view';

const TREE_GROUP_BY = ['_treeParentGroupKey'] as const;

const TREE_PARENT_COL = `minmax(160px, min(380px, 1.35fr))`;
const TREE_TAB_COL = `minmax(180px, 1fr)`;
const TREE_VISIBILITY_COL = `minmax(120px, 0.45fr)`;

const TREE_ROW_HEIGHT_LEAF_PX = 35;
const TREE_ROW_HEIGHT_GROUP_PX = 68;

const OBJECT_TYPE_ACTION_BUTTON_CLASSNAME = 'slds-button slds-button_icon slds-button_icon-bare';

export type TabVisibilityTreeRow = PermissionExportRow & {
  _treeParentGroupKey: string;
  _treeTabKey: string;
};

function buildTabVisibilityTreeRows(rows: PermissionExportRow[]): TabVisibilityTreeRow[] {
  return rows.map((row, index) => {
    const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
    const tabName = typeof row.Name === 'string' ? row.Name.trim() : '';
    return {
      ...row,
      _treeParentGroupKey: parentId || `__missing_parent_${index}`,
      _treeTabKey: tabName || `__missing_tab_${index}`,
    };
  });
}

function collectAllParentGroupKeys(rows: TabVisibilityTreeRow[]): Set<string> {
  return new Set(rows.map((row) => row._treeParentGroupKey));
}

function tabTreeGroupTitleLine(exportLabel: string, isProfileOwned: boolean): string {
  if (isProfileOwned && exportLabel.startsWith('Profile: ')) {
    const rest = exportLabel.slice('Profile: '.length).trim();
    return rest.length > 0 ? rest : exportLabel;
  }
  return exportLabel;
}

function renderTabVisibilityGroupCell(
  labelByParentId: Map<string, string>,
  permissionSetRowById: Map<string, PermissionExportRow>,
  setupLogin: { org: SalesforceOrgUi; serverUrl: string; skipFrontDoorAuth: boolean },
  containerSeverity: Map<string, PermissionObjectFindingCellSeverity> | null,
  onOpenFindingsForParent: (parentId: string) => void,
  { groupKey, childRows, isExpanded, toggleGroup }: RenderGroupCellProps<TabVisibilityTreeRow>,
) {
  const id = String(groupKey);
  const exportLabel = labelByParentId.get(id) ?? id;
  const severity = containerSeverity?.get(id);
  const permSetRow = permissionSetRowById.get(id);
  const isProfileOwned = permSetRow?.IsOwnedByProfile === true;
  const titleLine = tabTreeGroupTitleLine(exportLabel, isProfileOwned);
  const typeKind = isProfileOwned ? 'profile' : 'permission_set';
  const typeCaption = isProfileOwned ? 'Profile' : 'Permission set';
  const profileId =
    permSetRow && typeof permSetRow.ProfileId === 'string' && permSetRow.ProfileId.trim().length > 0 ? permSetRow.ProfileId.trim() : null;
  const recordType = isProfileOwned && profileId ? 'Profile' : 'PermissionSet';
  const setupTargetId = recordType === 'Profile' && profileId ? profileId : id;
  const returnUrl = getProfileOrPermSetSetupUrl(recordType, setupTargetId);

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
        className="slds-button slds-button_reset slds-text-align_left"
        css={css`
          flex: 1;
          min-width: 0;
          line-height: 1.35;
          overflow-wrap: anywhere;
          white-space: normal;
          word-break: break-word;
        `}
        onClick={toggleGroup}
        title={exportLabel}
      >
        <span
          css={css`
            column-gap: 0.25rem;
            display: flex;
            align-items: flex-start;
          `}
        >
          <Icon
            type="utility"
            icon={isExpanded ? 'chevrondown' : 'chevronright'}
            className="slds-icon slds-icon-text-default slds-icon_x-small"
            css={css`
              flex-shrink: 0;
              margin-top: 0.125rem;
            `}
            omitContainer
            description={isExpanded ? 'Collapse' : 'Expand'}
          />
          <span
            css={css`
              flex: 1;
              min-width: 0;
              text-align: left;
            `}
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
        </span>
      </button>
      <div
        className="slds-no-flex"
        css={css`
          display: flex;
          align-items: center;
          column-gap: 0.125rem;
        `}
      >
        <SalesforceLogin
          org={setupLogin.org}
          serverUrl={setupLogin.serverUrl}
          skipFrontDoorAuth={setupLogin.skipFrontDoorAuth}
          returnUrl={returnUrl}
          title={recordType === 'Profile' ? 'Open this profile in Salesforce Setup' : 'Open this permission set in Salesforce Setup'}
          omitIcon
          className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
        </SalesforceLogin>
        {severity ? (
          <button
            type="button"
            className="slds-button slds-button_icon slds-button_icon-bare"
            title="View findings for this profile or permission set"
            onClick={(event) => {
              event.stopPropagation();
              onOpenFindingsForParent(id);
            }}
          >
            <Icon
              type="utility"
              icon={severity === 'error' ? 'error' : 'warning'}
              className={severity === 'error' ? 'slds-button__icon slds-icon-text-error' : 'slds-button__icon slds-icon-text-warning'}
              omitContainer
              description="View findings"
            />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export interface PermissionAnalysisTabVisibilityTreeProps {
  tabSettingRows: PermissionExportRow[];
  permissionSetRows: PermissionExportRow[];
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  findings?: PermissionAnalysisFinding[];
  containerLabelById?: Map<string, string>;
  /** Tooling `TabDefinition`: setting `Name` → human-readable `Label`. */
  tabLabelBySettingName?: ReadonlyMap<string, string>;
}

interface TabFindingsModalState {
  parentId: string;
  matches: PermissionAnalysisFinding[];
}

/**
 * Tab visibility (`PermissionSetTabSetting`) from the export, grouped by profile or permission set (`ParentId`),
 * with one leaf row per tab. Ordering matches the object-permissions tree: profiles first, then permission sets,
 * then tabs alphabetically by label when loaded, otherwise by API name.
 */
export const PermissionAnalysisTabVisibilityTree: FunctionComponent<PermissionAnalysisTabVisibilityTreeProps> = ({
  tabSettingRows,
  permissionSetRows,
  org,
  serverUrl,
  skipFrontdoorLogin,
  defaultApiVersion,
  findings = [],
  containerLabelById,
  tabLabelBySettingName,
}) => {
  const sortedRows = useMemo(
    () => sortTabSettingExportRowsForAnalysisTree(tabSettingRows, permissionSetRows, tabLabelBySettingName),
    [tabSettingRows, permissionSetRows, tabLabelBySettingName],
  );
  const treeRows = useMemo(() => buildTabVisibilityTreeRows(sortedRows), [sortedRows]);
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

  const containerSeverity = useMemo(() => {
    if (findings.length === 0) {
      return null;
    }
    return buildContainerIdFindingSeverity(findings);
  }, [findings]);

  const openFindingsForParent = useCallback(
    (parentId: string) => {
      const matches = listFindingsForExportContainer(findings, parentId);
      if (matches.length === 0) {
        return;
      }
      setFindingsModal({ parentId, matches });
    },
    [findings],
  );

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<unknown>>(() => new Set());
  const [findingsModal, setFindingsModal] = useState<TabFindingsModalState | null>(null);

  useEffect(() => {
    setExpandedGroupIds(collectAllParentGroupKeys(treeRows));
  }, [treeRows]);

  const setupLogin = useMemo(() => ({ org, serverUrl, skipFrontDoorAuth: skipFrontdoorLogin }), [org, serverUrl, skipFrontdoorLogin]);

  const columns = useMemo((): ColumnWithFilter<TabVisibilityTreeRow>[] => {
    if (!treeRows.length) {
      return [];
    }
    const row0 = treeRows[0];

    const parentCol: ColumnWithFilter<TabVisibilityTreeRow> = {
      ...setColumnFromType<TabVisibilityTreeRow>('_treeParentGroupKey', 'text'),
      name: 'Profile / Permission set',
      key: '_treeParentGroupKey',
      field: '_treeParentGroupKey',
      resizable: true,
      width: TREE_PARENT_COL,
      renderGroupCell: (props) =>
        renderTabVisibilityGroupCell(labelByParentId, permissionSetRowById, setupLogin, containerSeverity, openFindingsForParent, props),
      getValue: ({ row }) => {
        const parentKey = row._treeParentGroupKey;
        return labelByParentId.get(parentKey) ?? parentKey;
      },
    } as ColumnWithFilter<TabVisibilityTreeRow>;

    const visibilityHeader = getExportColumnHeaderLabel('Visibility');

    const tabCol: ColumnWithFilter<TabVisibilityTreeRow> = {
      ...setColumnFromType<TabVisibilityTreeRow>('Name', 'text'),
      name: 'Tab',
      key: 'Name',
      field: 'Name',
      resizable: true,
      width: TREE_TAB_COL,
      getValue: ({ row }) => {
        const api = typeof row.Name === 'string' ? row.Name.trim() : '';
        const label = tabLabelBySettingName?.get(api)?.trim();
        const display = label && label.length > 0 ? label : api;
        return display.length > 0 ? display : '—';
      },
      renderCell: (props: RenderCellProps<TabVisibilityTreeRow, unknown>) => {
        const api = typeof props.row?.Name === 'string' ? props.row.Name.trim() : '';
        if (api.length === 0) {
          return <div className="slds-truncate">—</div>;
        }
        const label = tabLabelBySettingName?.get(api)?.trim();
        const display = label && label.length > 0 ? label : api;
        const title = display !== api ? `${display} (${api})` : display;
        return (
          <div className="slds-truncate" title={title}>
            <span>{display}</span>
            {display !== api ? <span className="slds-text-body_small slds-text-color_weak slds-m-left_xx-small">({api})</span> : null}
          </div>
        );
      },
    } as ColumnWithFilter<TabVisibilityTreeRow>;

    const visibilityFieldType = getRowTypeFromValue(row0.Visibility, false);
    const visibilityCol: ColumnWithFilter<TabVisibilityTreeRow> = {
      ...setColumnFromType<TabVisibilityTreeRow>('Visibility', visibilityFieldType),
      name: visibilityHeader,
      key: 'Visibility',
      field: 'Visibility',
      resizable: true,
      width: TREE_VISIBILITY_COL,
      getValue: ({ row }) => formatTabSettingVisibilityDisplay(row.Visibility),
      renderCell: (props: RenderCellProps<TabVisibilityTreeRow, unknown>) => {
        const text = formatTabSettingVisibilityDisplay(props.row?.Visibility);
        return (
          <div className="slds-truncate" title={text}>
            {text}
          </div>
        );
      },
    } as ColumnWithFilter<TabVisibilityTreeRow>;

    return [parentCol, tabCol, visibilityCol];
  }, [treeRows, labelByParentId, permissionSetRowById, setupLogin, containerSeverity, openFindingsForParent, tabLabelBySettingName]);

  const getRowKey = useCallback((row: TabVisibilityTreeRow) => {
    if (typeof row.Id === 'string' && row.Id.length > 0) {
      return row.Id;
    }
    return `${row._treeParentGroupKey}::${row._treeTabKey}`;
  }, []);

  if (!tabSettingRows.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">No tab visibility rows in this export.</ScopedNotification>
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
      />

      {findingsModal && (
        <PermissionAnalysisFindingsModal
          testId="permission-analysis-tab-visibility-findings"
          open
          title="Findings for this permission container"
          tagline="From this job's permission export analysis, scoped to the profile or permission set that owns this tab setting."
          onClose={() => setFindingsModal(null)}
          findings={findingsModal.matches}
          summaryLine={
            <Fragment>
              <strong>{containerLabelById?.get(findingsModal.parentId) ?? findingsModal.parentId}</strong>
              {' — '}
              {findingsModal.matches.length} {findingsModal.matches.length === 1 ? 'finding' : 'findings'}
            </Fragment>
          }
        />
      )}
    </AutoFullHeightContainer>
  );
};

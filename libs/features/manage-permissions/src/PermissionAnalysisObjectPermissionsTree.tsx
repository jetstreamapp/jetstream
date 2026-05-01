import { css } from '@emotion/react';
import type { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  DataTree,
  Icon,
  ScopedNotification,
  getRowTypeFromValue,
  setColumnFromType,
} from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import type { RenderCellProps, RenderGroupCellProps } from 'react-data-grid';
import { SobjectTypeCellContent } from './PermissionAnalysisExportGrid';
import {
  getExportColumnHeaderLabel,
  sortedObjectPermissionBooleanKeys,
  type PermissionExportRow,
  type SobjectExportDetail,
} from './permission-export-result-view';

/** Only permission set is grouped; `TreeDataGrid` clears `renderCell` on every `groupBy` column, so object + actions live on a separate `SobjectType` column. */
const TREE_GROUP_BY = ['_treePermSetGroupKey'] as const;

const OMIT_FROM_LEAF_KEYS = new Set(['attributes', 'Id', 'ParentId', 'SobjectType', '_treePermSetGroupKey', '_treeObjectGroupKey']);

/** Permission set: grows with grid width but never exceeds {@link TREE_PERM_SET_MAX_PX}. */
const TREE_PERM_SET_MIN_PX = 140;
const TREE_PERM_SET_MAX_PX = 420;
const TREE_COL_PERM_SET = `minmax(${TREE_PERM_SET_MIN_PX}px, min(${TREE_PERM_SET_MAX_PX}px, 1.35fr))`;

/** Fixed-width object column (label + info + Object Manager), not a flexible `fr` track. */
/** Label + tooltip + optional Object Manager only (no info popover). */
const TREE_OBJECT_WIDTH_PX = 236;

/** Boolean permission cells can shrink to ~104px before headers feel too tight. */
const TREE_COL_PERMISSION_BOOL = 'minmax(104px, 0.42fr)';

const TREE_MIN_PERM_SET = TREE_PERM_SET_MIN_PX;
const TREE_MIN_PERMISSION_BOOL = 104;

/** Default data row height; group rows are taller so wrapped permission set names fit. */
const TREE_ROW_HEIGHT_LEAF_PX = 35;
const TREE_ROW_HEIGHT_GROUP_PX = 60;

export type ObjectPermissionTreeRow = PermissionExportRow & {
  _treePermSetGroupKey: string;
  _treeObjectGroupKey: string;
};

function permissionSetRowLabel(row: PermissionExportRow): string {
  const label = typeof row.Label === 'string' && row.Label.trim() ? row.Label.trim() : null;
  const name = typeof row.Name === 'string' && row.Name.trim() ? row.Name.trim() : null;
  const profileBlock = row.Profile;
  const profileName =
    profileBlock &&
    typeof profileBlock === 'object' &&
    profileBlock !== null &&
    typeof (profileBlock as { Name?: unknown }).Name === 'string'
      ? String((profileBlock as { Name: string }).Name).trim()
      : null;
  const isProfile = row.IsOwnedByProfile === true;
  if (isProfile && profileName) {
    return `Profile: ${profileName}`;
  }
  return label ?? name ?? (typeof row.Id === 'string' ? row.Id : 'Permission set');
}

function buildParentIdToPermissionSetLabel(permissionSets: PermissionExportRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of permissionSets) {
    const id = row.Id;
    if (typeof id !== 'string' || id.trim().length === 0) {
      continue;
    }
    map.set(id.trim(), permissionSetRowLabel(row));
  }
  return map;
}

function buildObjectPermissionTreeRows(objectPermissionRows: PermissionExportRow[]): ObjectPermissionTreeRow[] {
  return objectPermissionRows.map((row, index) => {
    const parentId = typeof row.ParentId === 'string' ? row.ParentId.trim() : '';
    const sobjectType = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
    return {
      ...row,
      _treePermSetGroupKey: parentId || `__missing_parent_${index}`,
      _treeObjectGroupKey: sobjectType || `__missing_object_${index}`,
    };
  });
}

function collectAllPermissionSetGroupIds(rows: ObjectPermissionTreeRow[]): Set<string> {
  return new Set(rows.map((row) => row._treePermSetGroupKey));
}

function renderPermissionSetGroupCell(
  labelByParentId: Map<string, string>,
  { groupKey, childRows, isExpanded, toggleGroup }: RenderGroupCellProps<ObjectPermissionTreeRow>,
) {
  const id = String(groupKey);
  const label = labelByParentId.get(id) ?? id;
  return (
    <button
      type="button"
      className="slds-button slds-button_reset slds-text-align_left"
      css={css`
        width: 100%;
        height: 100%;
        align-items: flex-start;
        column-gap: 0.25rem;
        display: flex;
        line-height: 1.35;
        overflow-wrap: anywhere;
        padding: 0.25rem 0.35rem;
        white-space: normal;
        word-break: break-word;
      `}
      onClick={toggleGroup}
      title={label}
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
        <span>{label}</span>
        <span className="slds-text-body_small slds-text-color_weak slds-m-left_xx-small">({childRows.length})</span>
      </span>
    </button>
  );
}

export interface PermissionAnalysisObjectPermissionsTreeProps {
  objectPermissionRows: PermissionExportRow[];
  permissionSetRows: PermissionExportRow[];
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  sobjectExportDetails?: Record<string, SobjectExportDetail>;
}

/**
 * Object permissions from the export, grouped by permission set (ParentId), with Object + actions
 * and CRUD / View All / Modify All columns on leaf rows.
 */
export const PermissionAnalysisObjectPermissionsTree: FunctionComponent<PermissionAnalysisObjectPermissionsTreeProps> = ({
  objectPermissionRows,
  permissionSetRows,
  org,
  serverUrl,
  skipFrontdoorLogin,
  defaultApiVersion,
  sobjectExportDetails,
}) => {
  const treeRows = useMemo(() => buildObjectPermissionTreeRows(objectPermissionRows), [objectPermissionRows]);
  const labelByParentId = useMemo(() => buildParentIdToPermissionSetLabel(permissionSetRows), [permissionSetRows]);

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<unknown>>(() => new Set());

  useEffect(() => {
    setExpandedGroupIds(collectAllPermissionSetGroupIds(treeRows));
  }, [treeRows]);

  const objectManager = useMemo(() => ({ org, serverUrl, skipFrontDoorAuth: skipFrontdoorLogin }), [org, serverUrl, skipFrontdoorLogin]);

  const columns = useMemo((): ColumnWithFilter<ObjectPermissionTreeRow>[] => {
    if (!treeRows.length) {
      return [];
    }
    const row0 = treeRows[0];
    const groupPermSetCol: ColumnWithFilter<ObjectPermissionTreeRow> = {
      ...setColumnFromType<ObjectPermissionTreeRow>('_treePermSetGroupKey', 'text'),
      name: 'Permission Set',
      key: '_treePermSetGroupKey',
      field: '_treePermSetGroupKey',
      resizable: true,
      width: TREE_COL_PERM_SET,
      minWidth: TREE_MIN_PERM_SET,
      maxWidth: TREE_PERM_SET_MAX_PX,
      renderGroupCell: (props) => renderPermissionSetGroupCell(labelByParentId, props),
      getValue: ({ row }) => {
        const id = row._treePermSetGroupKey;
        return labelByParentId.get(id) ?? id;
      },
    } as ColumnWithFilter<ObjectPermissionTreeRow>;

    const objectCol: ColumnWithFilter<ObjectPermissionTreeRow> = {
      ...setColumnFromType<ObjectPermissionTreeRow>('SobjectType', 'textOrSalesforceId'),
      name: 'Object',
      key: 'SobjectType',
      field: 'SobjectType',
      resizable: false,
      width: TREE_OBJECT_WIDTH_PX,
      minWidth: TREE_OBJECT_WIDTH_PX,
      maxWidth: TREE_OBJECT_WIDTH_PX,
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
      renderCell: (props: RenderCellProps<ObjectPermissionTreeRow, unknown>) => {
        const raw = props.row?.SobjectType;
        const apiName = typeof raw === 'string' ? raw.trim() : '';
        if (!apiName) {
          return <div className="slds-truncate">—</div>;
        }
        const detail = sobjectExportDetails?.[apiName];
        return <SobjectTypeCellContent apiName={apiName} detail={detail} objectManager={objectManager} />;
      },
    } as ColumnWithFilter<ObjectPermissionTreeRow>;

    const permissionCols: ColumnWithFilter<ObjectPermissionTreeRow>[] = [];
    for (const key of sortedObjectPermissionBooleanKeys(treeRows)) {
      if (OMIT_FROM_LEAF_KEYS.has(key)) {
        continue;
      }
      const fieldType = getRowTypeFromValue(row0[key], false);
      const headerLabel = getExportColumnHeaderLabel(key);
      permissionCols.push({
        ...setColumnFromType<ObjectPermissionTreeRow>(key, fieldType),
        name: headerLabel,
        key,
        field: key,
        resizable: true,
        width: TREE_COL_PERMISSION_BOOL,
        minWidth: TREE_MIN_PERMISSION_BOOL,
      } as ColumnWithFilter<ObjectPermissionTreeRow>);
    }

    return [groupPermSetCol, objectCol, ...permissionCols];
  }, [treeRows, labelByParentId, sobjectExportDetails, objectManager]);

  const getRowKey = useCallback((row: ObjectPermissionTreeRow) => {
    if (typeof row.Id === 'string' && row.Id.length > 0) {
      return row.Id;
    }
    return `${row._treePermSetGroupKey}::${row._treeObjectGroupKey}`;
  }, []);

  if (!objectPermissionRows.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">No object permission rows in this export.</ScopedNotification>
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
    </AutoFullHeightContainer>
  );
};

import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { ensureBoolean, groupByFlat, orderValues, pluralizeFromNumber } from '@jetstream/shared/utils';
import type { ContextMenuItem } from '@jetstream/types';
import {
  BulkActionCheckbox,
  DirtyRow,
  FieldPermissionDefinitionMap,
  FieldPermissionItem,
  FieldPermissionTypes,
  ObjectPermissionDefinitionMap,
  ObjectPermissionItem,
  ObjectPermissionTypes,
  PermissionManagerTableContext,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
  PermissionTableCellExtended,
  PermissionTableFieldCell,
  PermissionTableFieldCellPermission,
  PermissionTableObjectCell,
  PermissionTableObjectCellPermission,
  PermissionTableSummaryRow,
  PermissionTableSystemPermissionCell,
  PermissionTableSystemPermissionCellPermission,
  PermissionTableTabVisibilityCell,
  PermissionTableTabVisibilityCellPermission,
  PermissionType,
  PermissionTypes,
  SystemPermissionDefinitionMap,
  SystemPermissionItem,
  SystemPermissionTypes,
  TabVisibilityPermissionDefinitionMap,
  TabVisibilityPermissionItem,
  TabVisibilityPermissionTypes,
} from '@jetstream/types';
import type { RenderCellProps, RenderSummaryCellProps } from '@jetstream/ui';
import {
  Checkbox,
  ColumnWithFilter,
  ContextAction,
  ContextMenuActionData,
  copyGenericTableDataToClipboard,
  DataTableGenericContext,
  Grid,
  Icon,
  Modal,
  Popover,
  PopoverRef,
  SearchInput,
  setColumnFromType,
  SummaryFilterRenderer,
  Tooltip,
} from '@jetstream/ui';
import classNames from 'classnames';
import startCase from 'lodash/startCase';
import { Fragment, useContext, useMemo, useRef, useState } from 'react';
import { PermissionColumnGroupHeader } from '../PermissionColumnGroupHeader';
import {
  OBJECT_PERMISSIONS_UNSUPPORTED_MESSAGE,
  supportsViewAllModifyAll,
  VIEW_ALL_MODIFY_ALL_UNSUPPORTED_MESSAGE,
} from './object-permission-support';
import { FIELD_AUDIT_COLUMNS, isFieldAuditColumnKey } from './permission-manager-field-audit-columns';
import {
  SYSTEM_PERMISSION_DEPENDENCY_TOOLTIP,
  SYSTEM_PERMISSION_DEPENDENT_CLOSURE,
  SYSTEM_PERMISSION_REQUIRED_CLOSURE,
} from './system-permission-dependencies';

type PermissionTypeColumn<T> = T extends 'object'
  ? ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>
  : T extends 'field'
    ? ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>
    : T extends 'tabVisibility'
      ? ColumnWithFilter<PermissionTableTabVisibilityCell, PermissionTableSummaryRow>
      : T extends 'systemPermission'
        ? ColumnWithFilter<PermissionTableSystemPermissionCell, PermissionTableSummaryRow>
        : never;

type PermissionActionType<T> = T extends 'object'
  ? 'Create' | 'Read' | 'Edit' | 'Delete' | 'ViewAll' | 'ModifyAll' | 'ViewAllFields'
  : T extends 'field'
    ? 'Read' | 'Edit'
    : T extends 'tabVisibility'
      ? 'Available' | 'Visible'
      : T extends 'systemPermission'
        ? 'Enabled'
        : never;

type PermissionActionAction<T> = T extends 'object'
  ? ObjectPermissionTypes
  : T extends 'field'
    ? FieldPermissionTypes
    : T extends 'tabVisibility'
      ? TabVisibilityPermissionTypes
      : T extends 'systemPermission'
        ? SystemPermissionTypes
        : never;

/**
 * True when the permission is View All / Modify All on an object that does not support it. Every path
 * that writes a permission value routes through this so a bulk action can never set what the checkbox
 * refuses to set.
 */
function isBlockedViewAllModifyAll(which: PermissionTypes, row: PermissionTableCellExtended): boolean {
  if (which !== 'viewAll' && which !== 'modifyAll') {
    return false;
  }
  return 'allowViewAllModifyAllPermission' in row && !row.allowViewAllModifyAllPermission;
}

/**
 * True when the row's object has no `ObjectPermissions` record to write to (field-only objects like
 * PricebookEntry/Task). Every path that writes an object permission value routes through this so a bulk
 * action can never set what the checkbox refuses to set.
 */
function isBlockedObjectPermission(row: PermissionTableCellExtended): boolean {
  return 'allowObjectPermission' in row && !row.allowObjectPermission;
}

function setObjectValue(which: ObjectPermissionTypes, row: PermissionTableObjectCell, permissionId: string, value: boolean) {
  if (isBlockedViewAllModifyAll(which, row) || isBlockedObjectPermission(row)) {
    return row;
  }
  const newRow = { ...row, permissions: { ...row.permissions, [permissionId]: { ...row.permissions[permissionId] } } };
  const permission = newRow.permissions[permissionId];
  if (which === 'create') {
    permission.create = value;
    setObjectDependencies(permission, value, ['read'], []);
  } else if (which === 'read') {
    permission.read = value;
    setObjectDependencies(permission, value, [], ['create', 'edit', 'delete', 'viewAll', 'modifyAll']);
  } else if (which === 'edit') {
    permission.edit = value;
    setObjectDependencies(permission, value, ['read'], ['delete', 'modifyAll']);
  } else if (which === 'delete') {
    permission.delete = value;
    setObjectDependencies(permission, value, ['read', 'edit'], ['modifyAll']);
  } else if (which === 'viewAll') {
    permission.viewAll = value;
    setObjectDependencies(permission, value, ['read'], ['modifyAll']);
  } else if (which === 'modifyAll') {
    permission.modifyAll = value;
    setObjectDependencies(permission, value, ['read', 'edit', 'delete', 'viewAll'], []);
  } else if (which === 'viewAllFields') {
    permission.viewAllFields = value;
    setObjectDependencies(permission, value, [], []);
  }
  return newRow;
}

function setFieldValue(which: FieldPermissionTypes, row: PermissionTableFieldCell, permissionId: string, value: boolean) {
  const newRow = { ...row, permissions: { ...row.permissions, [permissionId]: { ...row.permissions[permissionId] } } };
  const permission = newRow.permissions[permissionId];
  if (which === 'read') {
    permission.read = value;
    setFieldDependencies(permission, value, [], ['edit']);
  } else if (row.allowEditPermission) {
    permission.edit = value;
    setFieldDependencies(permission, value, ['read'], []);
  }
  return newRow;
}

function setTabVisibilityValue(
  which: TabVisibilityPermissionTypes,
  row: PermissionTableTabVisibilityCell,
  permissionId: string,
  value: boolean,
) {
  const newRow = { ...row, permissions: { ...row.permissions, [permissionId]: { ...row.permissions[permissionId] } } };
  const permission = newRow.permissions[permissionId];
  if (which === 'available') {
    permission.available = value;
    setTabVisibilityDependencies(permission, value, [], ['visible']);
  } else if (which === 'visible') {
    permission.visible = value;
    setTabVisibilityDependencies(permission, value, ['available'], []);
  }
  return newRow;
}

function setSystemPermissionValue(
  which: SystemPermissionTypes,
  row: PermissionTableSystemPermissionCell,
  permissionId: string,
  value: boolean,
) {
  const newRow = { ...row, permissions: { ...row.permissions, [permissionId]: { ...row.permissions[permissionId] } } };
  const permission = newRow.permissions[permissionId];
  if (which === 'enabled') {
    permission.enabled = value;
    setSystemPermissionDependencies(permission);
  }
  return newRow;
}

/**
 * Set dependent fields based on what selections are made
 */
function setObjectDependencies(
  permission: PermissionTableObjectCellPermission,
  value: boolean,
  setIfTrue: ObjectPermissionTypes[],
  setIfFalse: ObjectPermissionTypes[],
) {
  if (value) {
    setIfTrue.forEach((prop) => (permission[prop] = value));
  } else {
    setIfFalse.forEach((prop) => (permission[prop] = value));
  }
  permission.createIsDirty = permission.create !== permission.record.create;
  permission.readIsDirty = permission.read !== permission.record.read;
  permission.editIsDirty = permission.edit !== permission.record.edit;
  permission.deleteIsDirty = permission.delete !== permission.record.delete;
  permission.viewAllIsDirty = permission.viewAll !== permission.record.viewAll;
  permission.modifyAllIsDirty = permission.modifyAll !== permission.record.modifyAll;
  permission.viewAllFieldsIsDirty = permission.viewAllFields !== permission.record.viewAllFields;
}

/**
 * Set dependent fields based on what selections are made
 */
function setFieldDependencies(
  permission: PermissionTableFieldCellPermission,
  value: boolean,
  setIfTrue: FieldPermissionTypes[],
  setIfFalse: FieldPermissionTypes[],
) {
  if (value) {
    setIfTrue.forEach((prop) => (permission[prop] = value));
  } else {
    setIfFalse.forEach((prop) => (permission[prop] = value));
  }
  permission.readIsDirty = permission.read !== permission.record.read;
  permission.editIsDirty = permission.edit !== permission.record.edit;
}

function setTabVisibilityDependencies(
  permission: PermissionTableTabVisibilityCellPermission,
  value: boolean,
  setIfTrue: TabVisibilityPermissionTypes[],
  setIfFalse: TabVisibilityPermissionTypes[],
) {
  if (value) {
    setIfTrue.forEach((prop) => (permission[prop] = value));
  } else {
    setIfFalse.forEach((prop) => (permission[prop] = value));
  }
  permission.availableIsDirty = permission.available !== permission.record.available;
  permission.visibleIsDirty = permission.visible !== permission.record.visible;
}

// System permissions have no interdependencies exposed via the API (Salesforce enforces them
// server-side), so this only recomputes the dirty flag against the originally loaded value.
function setSystemPermissionDependencies(permission: PermissionTableSystemPermissionCellPermission) {
  permission.enabledIsDirty = permission.enabled !== permission.record.enabled;
}

// export function resetGridChanges(options: {
//   rows: PermissionTableFieldCell[] | PermissionTableObjectCell[] | PermissionTableTabVisibilityCell[];
//   type: PermissionType;
// });
// eslint-disable-next-line no-redeclare
export function resetGridChanges({
  rows,
  type,
}:
  | { rows: PermissionTableObjectCell[]; type: 'object' }
  | { rows: PermissionTableFieldCell[]; type: 'field' }
  | { rows: PermissionTableTabVisibilityCell[]; type: 'tabVisibility' }
  | { rows: PermissionTableSystemPermissionCell[]; type: 'systemPermission' }) {
  if (type === 'object') {
    return rows.map((row) => {
      row = { ...row };
      Object.keys(row.permissions).forEach((permissionKey) => {
        const permission = row.permissions[permissionKey];
        if (
          permission.createIsDirty ||
          permission.readIsDirty ||
          permission.editIsDirty ||
          permission.deleteIsDirty ||
          permission.viewAllIsDirty ||
          permission.modifyAllIsDirty ||
          permission.viewAllFieldsIsDirty
        ) {
          permission.create = permission.createIsDirty ? !permission.create : permission.create;
          permission.read = permission.readIsDirty ? !permission.read : permission.read;
          permission.edit = permission.editIsDirty ? !permission.edit : permission.edit;
          permission.delete = permission.deleteIsDirty ? !permission.delete : permission.delete;
          permission.viewAll = permission.viewAllIsDirty ? !permission.viewAll : permission.viewAll;
          permission.modifyAll = permission.modifyAllIsDirty ? !permission.modifyAll : permission.modifyAll;
          permission.viewAllFields = permission.viewAllFieldsIsDirty ? !permission.viewAllFields : permission.viewAllFields;
          permission.createIsDirty = false;
          permission.readIsDirty = false;
          permission.editIsDirty = false;
          permission.deleteIsDirty = false;
          permission.viewAllIsDirty = false;
          permission.modifyAllIsDirty = false;
          permission.viewAllFieldsIsDirty = false;
        }
      });
      return row;
    });
  } else if (type === 'field') {
    return rows.map((row) => {
      Object.keys(row.permissions).forEach((permissionKey) => {
        let permission = row.permissions[permissionKey];
        if (permission.readIsDirty || permission.editIsDirty) {
          permission = { ...permission };
          row.permissions[permissionKey] = permission;
          permission.read = permission.readIsDirty ? !permission.read : permission.read;
          permission.edit = permission.editIsDirty ? !permission.edit : permission.edit;
          permission.readIsDirty = false;
          permission.editIsDirty = false;
        }
      });
      return row;
    });
  } else if (type === 'tabVisibility') {
    return rows.map((row) => {
      Object.keys(row.permissions).forEach((permissionKey) => {
        let permission = row.permissions[permissionKey];
        if (permission.visibleIsDirty) {
          permission = { ...permission };
          row.permissions[permissionKey] = permission;
          permission.available = permission.availableIsDirty ? !permission.available : permission.available;
          permission.visible = permission.visibleIsDirty ? !permission.visible : permission.visible;
          permission.availableIsDirty = false;
          permission.visibleIsDirty = false;
        }
      });
      return row;
    });
  } else if (type === 'systemPermission') {
    return rows.map((row) => {
      Object.keys(row.permissions).forEach((permissionKey) => {
        let permission = row.permissions[permissionKey];
        if (permission.enabledIsDirty) {
          permission = { ...permission };
          row.permissions[permissionKey] = permission;
          permission.enabled = !permission.enabled;
          permission.enabledIsDirty = false;
        }
      });
      return row;
    });
  }
}

export function getDirtyObjectPermissions(dirtyRows: Record<string, DirtyRow<PermissionTableObjectCell>>) {
  return Object.values(dirtyRows).flatMap(({ row }) =>
    Object.values(row.permissions).filter(
      (permission) =>
        permission.createIsDirty ||
        permission.readIsDirty ||
        permission.editIsDirty ||
        permission.deleteIsDirty ||
        permission.viewAllIsDirty ||
        permission.modifyAllIsDirty ||
        permission.viewAllFieldsIsDirty,
    ),
  );
}

export function getDirtyFieldPermissions(dirtyRows: Record<string, DirtyRow<PermissionTableFieldCell>>) {
  return Object.values(dirtyRows).flatMap(({ row }) =>
    Object.values(row.permissions).filter((permission) => permission.readIsDirty || permission.editIsDirty),
  );
}

export function getDirtyTabVisibilityPermissions(dirtyRows: Record<string, DirtyRow<PermissionTableTabVisibilityCell>>) {
  return Object.values(dirtyRows).flatMap(({ row }) =>
    Object.values(row.permissions).filter((permission) => permission.availableIsDirty || permission.visibleIsDirty),
  );
}

export function getDirtySystemPermissions(dirtyRows: Record<string, DirtyRow<PermissionTableSystemPermissionCell>>) {
  return Object.values(dirtyRows).flatMap(({ row }) => Object.values(row.permissions).filter((permission) => permission.enabledIsDirty));
}

export function getObjectColumns(
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  profilesById: Record<string, PermissionSetWithProfileRecord>,
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>,
) {
  const newColumns: ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>[] = [
    {
      ...(setColumnFromType('tableLabel', 'text') as any),
      name: 'Object',
      key: 'tableLabel',
      frozen: true,
      width: 300,
      // No `getValue` — `tableLabel` is already `Label (ApiName)`, so filtering, search and copy all
      // read the row value directly.
      summaryCellClass: 'bg-color-gray-dark no-outline',
      renderSummaryCell: ({ row }) => {
        if (row.type === 'HEADING') {
          return <ColumnSearchFilterSummary />;
        } else if (row.type === 'ACTION') {
          return <ColumnSearchFilter />;
        }
        return undefined;
      },
      cellClass: (row) => {
        if (!row.allowObjectPermission) {
          return 'slds-text-color_weak';
        }
      },
    },
    {
      name: '',
      key: '_ROW_ACTION',
      width: 100,
      resizable: false,
      frozen: true,
      renderCell: RowActionRenderer as any,
      summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
      renderSummaryCell: ({ row }) => {
        if (row.type === 'ACTION') {
          return <BulkActionRenderer />;
        }
        return undefined;
      },
    },
  ];
  // Create column groups for profiles
  selectedProfiles.forEach((profileId) => {
    const profile = profilesById[profileId];
    (['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll', 'viewAllFields'] as const).forEach((permissionType, i) => {
      newColumns.push(
        getColumnForProfileOrPermSet({
          isFirstItem: i === 0,
          permissionType: 'object',
          id: profileId,
          type: 'Profile',
          label: profile?.Profile?.Name || '',
          actionType: startCase(permissionType) as 'Create' | 'Read' | 'Edit' | 'Delete' | 'ViewAll' | 'ModifyAll' | 'ViewAllFields',
          actionKey: permissionType,
        }),
      );
    });
  });
  // Create column groups for permission sets
  selectedPermissionSets.forEach((permissionSetId) => {
    const permissionSet = permissionSetsById[permissionSetId];
    (['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll', 'viewAllFields'] as const).forEach((permissionType, i) => {
      newColumns.push(
        getColumnForProfileOrPermSet({
          isFirstItem: i === 0,
          permissionType: 'object',
          id: permissionSetId,
          type: 'Permission Set',
          label: permissionSet?.Name || '',
          actionType: startCase(permissionType) as 'Create' | 'Read' | 'Edit' | 'Delete' | 'ViewAll' | 'ModifyAll' | 'ViewAllFields',
          actionKey: permissionType,
        }),
      );
    });
  });
  return newColumns;
}

export function getObjectRows(selectedSObjects: string[], objectPermissionMap: Record<string, ObjectPermissionDefinitionMap>) {
  const rows: PermissionTableObjectCell[] = [];
  orderValues(selectedSObjects).forEach((sobject) => {
    const objectPermission = objectPermissionMap[sobject];

    const currRow: PermissionTableObjectCell = {
      key: sobject,
      sobject,
      apiName: objectPermission.apiName,
      label: objectPermission.label,
      tableLabel: `${objectPermission.label} (${objectPermission.apiName})`,
      allowEditPermission: true,
      allowViewAllModifyAllPermission: supportsViewAllModifyAll(objectPermission.apiName),
      allowObjectPermission: objectPermission.supportsObjectPermissions,
      permissions: {},
    };

    objectPermission.permissionKeys.forEach((key) => {
      const item = objectPermission.permissions[key];
      currRow.permissions[key] = getRowObjectPermissionFromObjectPermissionItem(key, sobject, item);
    });

    rows.push(currRow);
  });
  return rows;
}

function getRowObjectPermissionFromObjectPermissionItem(
  key: string,
  sobject: string,
  item: ObjectPermissionItem,
): PermissionTableObjectCellPermission {
  return {
    rowKey: sobject,
    parentId: key,
    sobject,
    create: item.create,
    read: item.read,
    edit: item.edit,
    delete: item.delete,
    viewAll: item.viewAll,
    modifyAll: item.modifyAll,
    viewAllFields: item.viewAllFields,
    record: item,
    createIsDirty: false,
    readIsDirty: false,
    editIsDirty: false,
    deleteIsDirty: false,
    viewAllIsDirty: false,
    modifyAllIsDirty: false,
    viewAllFieldsIsDirty: false,
    errorMessage: item.errorMessage,
  };
}

export function updateObjectRowsAfterSave(
  rows: PermissionTableObjectCell[],
  objectPermissionMap: Record<string, ObjectPermissionDefinitionMap>,
): PermissionTableObjectCell[] {
  return rows.map((oldRow) => {
    const row = { ...oldRow };
    objectPermissionMap[row.key].permissionKeys.forEach((key) => {
      row.permissions = { ...row.permissions };
      const objectPermission = objectPermissionMap[row.key].permissions[key];
      if (objectPermission.errorMessage) {
        row.permissions[key] = { ...row.permissions[key], errorMessage: objectPermission.errorMessage };
      } else {
        row.permissions[key] = getRowObjectPermissionFromObjectPermissionItem(key, row.apiName, objectPermission);
      }
    });
    return row;
  });
}

/**
 * The optional created/modified columns. Values are read straight off the row by key, so these keys must match
 * the flattened properties on `PermissionTableFieldCell`.
 *
 * These are plain data columns - no `renderGroupCell` or `renderSummaryCell`, so the grid leaves their group and
 * summary cells empty - and deliberately not `editable`, which also keeps them out of paste targets.
 */
function getFieldAuditColumns(): ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>[] {
  const auditSummaryCellClass = ({ type }: PermissionTableSummaryRow) => (type === 'HEADING' ? 'bg-color-gray' : null);
  return FIELD_AUDIT_COLUMNS.map(({ key, label, type }) => ({
    ...(setColumnFromType(key, type) as any),
    name: label,
    key,
    width: type === 'date' ? 170 : 150,
    resizable: true,
    // Timestamps are near-unique per row, so a SET filter would build a distinct value list the size of the table
    ...(type === 'date' ? { filters: ['DATE'] } : {}),
    summaryCellClass: auditSummaryCellClass,
  }));
}

export function getFieldColumns(
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  profilesById: Record<string, PermissionSetWithProfileRecord>,
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>,
) {
  const newColumns: ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>[] = [
    {
      ...(setColumnFromType('sobject', 'text') as any),
      name: 'Object',
      key: 'sobject',
      // Grouping is by sobject. Because the permission columns supply their own `renderGroupCell` (the
      // per-column checked counts), the grid no longer renders its fallback full-width header — so this
      // column owns the group row's expand toggle + object name + child count.
      width: 200,
      resizable: true,
      cellClass: 'bg-color-gray-dark',
      summaryCellClass: 'bg-color-gray-dark',
      // In the group header only, span Object + Field + row-action so the object name has room. Returns
      // undefined for data/summary rows, so those cells stay one column wide.
      colSpan: (args) => (args.type === 'GROUP' ? 3 : undefined),
      renderGroupCell: ({ groupKey, childRows, isExpanded, toggleGroup }) => (
        <button
          type="button"
          className="jgrid-group-toggle slds-button_reset slds-grid slds-grid_vertical-align-center"
          onClick={toggleGroup}
          tabIndex={-1}
        >
          <Icon
            type="utility"
            icon={isExpanded ? 'chevrondown' : 'chevronright'}
            className="slds-icon slds-icon-text-default slds-icon_x-small slds-m-right_xx-small"
          />
          <span className="jgrid-group-toggle-label slds-truncate" title={String(groupKey ?? '')}>
            {groupKey === null || groupKey === undefined ? '—' : String(groupKey)}
          </span>
          <span className="slds-text-body_small slds-text-color_weak slds-m-left_x-small">({formatNumber(childRows.length)})</span>
        </button>
      ),
    },
    {
      ...setColumnFromType('tableLabel', 'text'),
      name: 'Field',
      key: 'tableLabel',
      frozen: true,
      width: 300,
      resizable: true,
      summaryCellClass: 'bg-color-gray-dark no-outline',
      renderSummaryCell: ({ row }) => {
        if (row.type === 'HEADING') {
          return <ColumnSearchFilterSummary />;
        } else if (row.type === 'ACTION') {
          return <ColumnSearchFilter />;
        }
        return undefined;
      },
    },
    {
      name: '',
      key: '_ROW_ACTION',
      width: 100,
      resizable: false,
      frozen: true,
      renderCell: RowActionRenderer,
      summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
      renderSummaryCell: ({ row }) => {
        if (row.type === 'ACTION') {
          return <BulkActionRenderer />;
        }
        return undefined;
      },
    },
    // Audit columns. Always built, then filtered out by the caller unless the user has opted in - keeping the
    // builder unaware of visibility means the export path gets all of them without having to ask.
    // They sit after the frozen block (`tableLabel` + `_ROW_ACTION`) so the frozen columns stay contiguous, and
    // ahead of the permission groups so they are not stranded behind a long horizontal scroll.
    ...getFieldAuditColumns(),
  ];

  // Create column groups for profiles
  selectedProfiles.forEach((profileId, _i) => {
    const profile = profilesById[profileId];
    (['read', 'edit'] as const).forEach((permissionType, i) => {
      newColumns.push(
        getColumnForProfileOrPermSet({
          isFirstItem: i === 0,
          permissionType: 'field',
          id: profileId,
          type: 'Profile',
          label: profile?.Profile?.Name || '',
          actionType: startCase(permissionType) as 'Read' | 'Edit',
          actionKey: permissionType,
        }),
      );
    });
  });
  // Create column groups for permission sets
  selectedPermissionSets.forEach((permissionSetId, _i) => {
    const permissionSet = permissionSetsById[permissionSetId];
    (['read', 'edit'] as const).forEach((permissionType, i) => {
      newColumns.push(
        getColumnForProfileOrPermSet({
          isFirstItem: i === 0,
          permissionType: 'field',
          id: permissionSetId,
          type: 'Permission Set',
          label: permissionSet?.Name || '',
          actionType: startCase(permissionType) as 'Read' | 'Edit',
          actionKey: permissionType,
        }),
      );
    });
  });
  return newColumns;
}

function getColumnForProfileOrPermSet<T extends PermissionType>({
  permissionType,
  isFirstItem,
  id,
  label,
  type,
  actionType,
  actionKey,
}: {
  permissionType: T;
  isFirstItem: boolean;
  id: string;
  label: string;
  type: 'Profile' | 'Permission Set';
  actionType: PermissionActionType<T>;
  actionKey: PermissionActionAction<T>;
}): PermissionTypeColumn<T> {
  const numItems = permissionType === 'object' ? 7 : permissionType === 'systemPermission' ? 1 : 2;
  const maxLabelWidth = Math.max((actionType.length + 3) * 7.5, 116);
  const profileOrPermSetWidth = (`${label} (${type})`.length * 7.5) / numItems;
  const colWidth = Math.max(maxLabelWidth, profileOrPermSetWidth);
  const column: ColumnWithFilter<PermissionTableCellExtended, PermissionTableSummaryRow> = {
    name: `${label} (${type})`,
    key: `${id}-${actionKey}`,
    width: colWidth,
    filters: ['BOOLEAN_SET'],
    // Only the first column of each group renders a header cell — the rest are covered by its colSpan.
    // It must be non-sortable because a sortable header wraps its label in a <button>, and the group header
    // hosts a popover trigger (also a button). Nothing is lost: sorting reads row["<id>-<action>"], which
    // never exists on these rows, so it was already a no-op. Filtering uses `getValue` and is unaffected.
    ...(isFirstItem
      ? {
          sortable: false,
          renderHeaderCell: () => <PermissionColumnGroupHeader id={id} label={label} type={type} />,
        }
      : {}),
    // Paste/clear eligibility only (no popup editor): mirrors the checkbox's own disabled logic so
    // pasted true/false values can never land on cells the user couldn't click.
    editable: (row) => {
      if (permissionType === 'tabVisibility' && 'canSetPermission' in row && !row.canSetPermission) {
        return false;
      }
      if (permissionType === 'object' && 'allowObjectPermission' in row && !row.allowObjectPermission) {
        return false;
      }
      if (isBlockedViewAllModifyAll(actionKey as PermissionTypes, row)) {
        return false;
      }
      if (actionKey === 'edit' && 'allowEditPermission' in row && !row.allowEditPermission) {
        return false;
      }
      return true;
    },
    cellClass: (row) => {
      if (permissionType === 'object') {
        if ('allowObjectPermission' in row && !row.allowObjectPermission) {
          return 'is-disabled';
        }
        const permission = row.permissions[id] as PermissionTableObjectCellPermission;
        if (
          (actionKey === 'create' && permission.createIsDirty) ||
          (actionKey === 'read' && permission.readIsDirty) ||
          (actionKey === 'edit' && permission.editIsDirty) ||
          (actionKey === 'delete' && permission.deleteIsDirty) ||
          (actionKey === 'viewAll' && permission.viewAllIsDirty) ||
          (actionKey === 'modifyAll' && permission.modifyAllIsDirty) ||
          (actionKey === 'viewAllFields' && permission.viewAllFieldsIsDirty)
        ) {
          return 'active-item-yellow-bg';
        }
      } else if (permissionType === 'field') {
        const permission = row.permissions[id] as PermissionTableFieldCellPermission;
        if ((actionKey === 'read' && permission.readIsDirty) || (actionKey === 'edit' && permission.editIsDirty)) {
          return 'active-item-yellow-bg';
        }
      } else if (permissionType === 'tabVisibility') {
        if ('canSetPermission' in row && !row.canSetPermission) {
          return 'is-disabled';
        }
        const permission = row.permissions[id] as PermissionTableTabVisibilityCellPermission;
        if ((actionKey === 'available' && permission.availableIsDirty) || (actionKey === 'visible' && permission.visibleIsDirty)) {
          return 'active-item-yellow-bg';
        }
      } else if (permissionType === 'systemPermission') {
        const permission = row.permissions[id] as PermissionTableSystemPermissionCellPermission;
        if (permission.enabledIsDirty) {
          return 'active-item-yellow-bg';
        }
      }
      return '';
    },
    colSpan: (args) => {
      if (args.type === 'HEADER' && isFirstItem) {
        return numItems;
      }
      // If the row is not editable, then we don't want to show the checkbox
      if (args.type === 'ROW' && permissionType === 'tabVisibility' && 'canSetPermission' in args.row && !args.row.canSetPermission) {
        return numItems;
      }
      if (args.type === 'ROW' && permissionType === 'object' && 'allowObjectPermission' in args.row && !args.row.allowObjectPermission) {
        return numItems;
      }
      return undefined;
    },
    renderCell: ({ row, commitEdit }) => {
      // If the row is not editable, then we don't want to show the checkbox
      if (permissionType === 'tabVisibility' && 'canSetPermission' in row && !row.canSetPermission) {
        return null;
      }
      // Objects that only support field-level security have no object permissions to set
      if (permissionType === 'object' && 'allowObjectPermission' in row && !row.allowObjectPermission) {
        return (
          <div className="slds-text-color_weak slds-text-body_small slds-p-left_x-small">{OBJECT_PERMISSIONS_UNSUPPORTED_MESSAGE}</div>
        );
      }

      const errorMessage = row.permissions[id].errorMessage;
      const value = (row.permissions[id] as any)[actionKey] as boolean;

      function handleChange(value: boolean) {
        if (permissionType === 'object') {
          const newRow = setObjectValue(actionKey as PermissionActionAction<'object'>, row as PermissionTableObjectCell, id, value);
          commitEdit(newRow);
        } else if (permissionType === 'field') {
          const newRow = setFieldValue(actionKey as PermissionActionAction<'field'>, row as PermissionTableFieldCell, id, value);
          commitEdit(newRow);
        } else if (permissionType === 'tabVisibility') {
          const newRow = setTabVisibilityValue(
            actionKey as PermissionActionAction<'tabVisibility'>,
            row as PermissionTableTabVisibilityCell,
            id,
            value,
          );
          commitEdit(newRow);
        } else if (permissionType === 'systemPermission') {
          const newRow = setSystemPermissionValue(
            actionKey as PermissionActionAction<'systemPermission'>,
            row as PermissionTableSystemPermissionCell,
            id,
            value,
          );
          commitEdit(newRow);
        }
      }

      const unsupportedViewAllModifyAll = isBlockedViewAllModifyAll(actionKey as PermissionTypes, row);
      const disabled = unsupportedViewAllModifyAll || (actionKey === 'edit' && 'allowEditPermission' in row && !row.allowEditPermission);

      const checkbox = (
        <input
          type="checkbox"
          id={`${row.key}-${id}-${actionKey}`}
          checked={value}
          tabIndex={-1}
          // The visible context lives in the column-group header far above and the row label far to
          // the left — name each checkbox with both so arrowing down a column announces which
          // object/field/tab/permission is being toggled, and for which profile/permission set
          aria-label={`${actionType} ${row.label} for ${label} (${type})`}
          // Grid arrow navigation focuses the checkbox itself (APG single-widget cell) so its role,
          // checked state, and toggle affordance are announced
          {...(disabled ? {} : { 'data-grid-inner-focus': true })}
          // Stop the click from also reaching the wrapping div's onClick — otherwise a direct click
          // (or programmatic keyboard activation) toggles via both handlers. onChange owns the toggle.
          onClick={(ev) => ev.stopPropagation()}
          onChange={(ev) => {
            handleChange(ev.target.checked);
          }}
          disabled={disabled}
        ></input>
      );

      return (
        <div className="slds-align_absolute-center h-100">
          {unsupportedViewAllModifyAll ? (
            <Tooltip ariaRole="label" content={VIEW_ALL_MODIFY_ALL_UNSUPPORTED_MESSAGE}>
              {checkbox}
            </Tooltip>
          ) : (
            checkbox
          )}
          {errorMessage && (
            <div
              css={css`
                position: fixed;
                margin-left: 40px;
              `}
            >
              <Tooltip
                id={`tooltip-${row.key}-${id}-${actionKey}`}
                content={
                  <div>
                    <strong>{errorMessage}</strong>
                  </div>
                }
              >
                <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small" />
              </Tooltip>
            </div>
          )}
        </div>
      );
    },
    getValue: ({ row }) => (row.permissions[id] as any)[actionKey as any],
    summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
    renderSummaryCell: (args) => {
      if (args.row.type === 'HEADING') {
        return <SummaryFilterRenderer columnKey={`${id}-${actionKey}`} label={actionType} />;
      }
      return (
        <PinnedSelectAllRendererWrapper
          {...(args as RenderSummaryCellProps<any, unknown>)}
          contextLabel={`${actionType} for ${label} (${type})`}
        />
      );
    },
    // On grouped tables (field permissions) the group header shows how many of the group's child rows
    // have this permission checked. Object/tab tables aren't grouped, so this never renders there.
    renderGroupCell: ({ childRows }) => {
      const checkedCount = childRows.reduce((total, childRow) => total + ((childRow.permissions[id] as any)?.[actionKey] ? 1 : 0), 0);
      return <GroupCheckedCount checkedCount={checkedCount} totalCount={childRows.length} />;
    },
  };
  return column as PermissionTypeColumn<T>;
}

/** Group-header summary for a permission column: how many child rows have it checked, out of the total. */
function GroupCheckedCount({ checkedCount, totalCount }: { checkedCount: number; totalCount: number }) {
  return (
    <div
      className="slds-align_absolute-center h-100 slds-text-body_small"
      title={`${formatNumber(checkedCount)} of ${formatNumber(totalCount)} checked`}
    >
      <span className={checkedCount > 0 ? 'slds-text-color_default' : 'slds-text-color_weak'}>
        {formatNumber(checkedCount)}
        <span className="slds-text-color_weak">{` / ${formatNumber(totalCount)}`}</span>
      </span>
    </div>
  );
}

// Field-name column copy scoped to the right-clicked object; the unique-objects copy for the object column.
const COPY_COL_OBJECT = 'COPY_COL_OBJECT';
const COPY_COL_OBJECTS_UNIQUE = 'COPY_COL_OBJECTS_UNIQUE';

/**
 * Per-cell context menu for the field-permissions table. Only the Object, Field and audit columns get a menu
 * (the Read/Edit checkbox columns are skipped), and the only actions are column copies.
 */
export function getFieldPermissionContextMenuItems(data: ContextMenuActionData<PermissionTableFieldCell>): ContextMenuItem[] {
  if (data.column.key === 'sobject') {
    // The object value repeats once per field — copy the de-duplicated list of object names.
    return [{ label: 'Copy column (All Objects)', value: COPY_COL_OBJECTS_UNIQUE }];
  }
  if (data.column.key === 'tableLabel' || isFieldAuditColumnKey(data.column.key)) {
    // Field and audit columns: the values for the clicked object, or for every object.
    return [
      { label: `Copy column (${data.row.sobject})`, value: COPY_COL_OBJECT },
      { label: 'Copy column (All Objects)', value: 'COPY_COL' },
    ];
  }
  return [];
}

export function handleFieldPermissionContextMenuAction(item: ContextMenuItem, data: ContextMenuActionData<PermissionTableFieldCell>): void {
  const fields = data.columns.map((column) => column.key);
  if (item.value === COPY_COL_OBJECT) {
    const rowsForObject = data.rows.filter((row) => row.sobject === data.row.sobject);
    copyGenericTableDataToClipboard('COPY_COL', fields, { ...data, rows: rowsForObject });
    return;
  }
  if (item.value === COPY_COL_OBJECTS_UNIQUE) {
    const seen = new Set<string>();
    const uniqueRows = data.rows.filter((row) => {
      if (seen.has(row.sobject)) {
        return false;
      }
      seen.add(row.sobject);
      return true;
    });
    copyGenericTableDataToClipboard('COPY_COL', fields, { ...data, rows: uniqueRows });
    return;
  }
  copyGenericTableDataToClipboard(item.value as ContextAction, fields, data);
}

export function getFieldRows(
  selectedSObjects: string[],
  fieldsByObject: Record<string, string[]>,
  fieldPermissionMap: Record<string, FieldPermissionDefinitionMap>,
) {
  const rows: PermissionTableFieldCell[] = [];
  orderValues(selectedSObjects).forEach((sobject) => {
    fieldsByObject[sobject]?.forEach((fieldKey) => {
      const fieldPermission = fieldPermissionMap[fieldKey];

      const currRow: PermissionTableFieldCell = {
        key: fieldKey,
        sobject,
        apiName: fieldPermission.apiName,
        label: fieldPermission.label,
        tableLabel: `${fieldPermission.label} (${fieldPermission.apiName})`,
        type: fieldPermission.metadata.DataType,
        // Compound fields (e.x. BillingAddress) show up as non-editable, but they are editable
        allowEditPermission: fieldPermission.metadata.IsCompound || fieldPermission.metadata.IsUpdatable,
        // Absent for standard fields, which have no audit data in Salesforce
        ...fieldPermission.auditMetadata,
        permissions: {},
      };

      fieldPermission.permissionKeys.forEach((key) => {
        const item = fieldPermission.permissions[key];
        currRow.permissions[key] = getRowFieldPermissionFromFieldPermissionItem(key, sobject, fieldPermission.apiName, item);
      });

      rows.push(currRow);
    });
  });
  return rows;
}

function getRowFieldPermissionFromFieldPermissionItem(
  key: string,
  sobject: string,
  field: string,
  item: FieldPermissionItem,
): PermissionTableFieldCellPermission {
  return {
    rowKey: sobject,
    parentId: key,
    sobject,
    field,
    read: item.read,
    edit: item.edit,
    record: item,
    readIsDirty: false,
    editIsDirty: false,
    errorMessage: item.errorMessage,
  };
}

/**
 * For rows with error messages on the fieldMap, this will retain the current state but add the error message
 * For other rows, everything is reset
 * @param rows
 * @param fieldPermissionsMap
 */
export function updateFieldRowsAfterSave(
  rows: PermissionTableFieldCell[],
  fieldPermissionsMap: Record<string, FieldPermissionDefinitionMap>,
): PermissionTableFieldCell[] {
  return rows.map((oldRow) => {
    const row = { ...oldRow };
    fieldPermissionsMap[row.key].permissionKeys.forEach((key) => {
      row.permissions = { ...row.permissions };
      const objectPermission = fieldPermissionsMap[row.key].permissions[key];
      if (objectPermission.errorMessage) {
        row.permissions[key] = { ...row.permissions[key], errorMessage: objectPermission.errorMessage };
      } else {
        row.permissions[key] = getRowFieldPermissionFromFieldPermissionItem(key, row.sobject, row.apiName, objectPermission);
      }
    });
    return row;
  });
}

export function getTabVisibilityColumns(
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  profilesById: Record<string, PermissionSetWithProfileRecord>,
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>,
) {
  const newColumns: ColumnWithFilter<PermissionTableTabVisibilityCell, PermissionTableSummaryRow>[] = [
    {
      ...(setColumnFromType('tableLabel', 'text') as any),
      name: 'Object',
      key: 'tableLabel',
      frozen: true,
      width: 300,
      // No `getValue` — `tableLabel` is already `Label (ApiName)`, so filtering, search and copy all
      // read the row value directly.
      summaryCellClass: 'bg-color-gray-dark no-outline',
      renderSummaryCell: ({ row }) => {
        if (row.type === 'HEADING') {
          return <ColumnSearchFilterSummary />;
        } else if (row.type === 'ACTION') {
          return <ColumnSearchFilter />;
        }
        return undefined;
      },
      cellClass: (row) => {
        if ('canSetPermission' in row && !row.canSetPermission) {
          return 'slds-text-color_weak';
        }
      },
    },
    {
      name: '',
      key: '_ROW_ACTION',
      width: 100,
      resizable: false,
      frozen: true,
      renderCell: (props) => {
        if (!props.row.canSetPermission) {
          return (
            <div className="slds-m-left_x-large">
              <Tooltip
                content={
                  <div>
                    <strong>This object does not have a Tab.</strong>
                  </div>
                }
              >
                <Icon type="utility" icon="warning" className="slds-icon slds-icon-text-warning slds-icon_xx-small" />
              </Tooltip>
            </div>
          );
        }
        return <RowActionRenderer {...(props as RenderCellProps<PermissionTableCellExtended, PermissionTableSummaryRow>)} />;
      },
      summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
      renderSummaryCell: ({ row }) => {
        if (row.type === 'ACTION') {
          return <BulkActionRenderer />;
        }
        return undefined;
      },
    },
  ];
  // Create column groups for profiles
  selectedProfiles.forEach((profileId) => {
    const profile = profilesById[profileId];
    (['available', 'visible'] as const).forEach((actionKey, i) => {
      newColumns.push(
        getColumnForProfileOrPermSet({
          isFirstItem: i === 0,
          permissionType: 'tabVisibility',
          id: profileId,
          type: 'Profile',
          label: profile?.Profile?.Name || '',
          actionType: startCase(actionKey) as 'Available' | 'Visible',
          actionKey,
        }),
      );
    });
  });
  // Create column groups for permission sets
  selectedPermissionSets.forEach((permissionSetId) => {
    const permissionSet = permissionSetsById[permissionSetId];
    (['available', 'visible'] as const).forEach((actionKey, i) => {
      newColumns.push(
        getColumnForProfileOrPermSet({
          isFirstItem: i === 0,
          permissionType: 'tabVisibility',
          id: permissionSetId,
          type: 'Permission Set',
          label: permissionSet?.Name || '',
          actionType: startCase(actionKey) as 'Available' | 'Visible',
          actionKey,
        }),
      );
    });
  });
  return newColumns;
}

export function getTabVisibilityRows(
  selectedSObjects: string[],
  tabVisibilityPermissionMap: Record<string, TabVisibilityPermissionDefinitionMap>,
) {
  const rows: PermissionTableTabVisibilityCell[] = [];
  orderValues(selectedSObjects).forEach((sobject) => {
    const fieldPermission = tabVisibilityPermissionMap[sobject];

    const currRow: PermissionTableTabVisibilityCell = {
      key: sobject,
      sobject,
      apiName: fieldPermission.apiName,
      label: fieldPermission.label,
      tableLabel: `${fieldPermission.label} (${fieldPermission.apiName})`,
      canSetPermission: fieldPermission.canSetPermission,
      permissions: {},
    };

    fieldPermission.permissionKeys.forEach((key) => {
      const item = fieldPermission.permissions[key];
      currRow.permissions[key] = getRowTabVisibilityPermissionFromFieldPermissionItem(key, sobject, item);
    });

    rows.push(currRow);
  });
  return rows;
}

export function updateTabVisibilityRowsAfterSave(
  rows: PermissionTableTabVisibilityCell[],
  tabVisibilityPermissionsMap: Record<string, TabVisibilityPermissionDefinitionMap>,
): PermissionTableTabVisibilityCell[] {
  return rows.map((oldRow) => {
    const row = { ...oldRow };
    tabVisibilityPermissionsMap[row.key].permissionKeys.forEach((key) => {
      row.permissions = { ...row.permissions };
      const objectPermission = tabVisibilityPermissionsMap[row.key].permissions[key];
      if (objectPermission.errorMessage) {
        row.permissions[key] = { ...row.permissions[key], errorMessage: objectPermission.errorMessage };
      } else {
        row.permissions[key] = getRowTabVisibilityPermissionFromFieldPermissionItem(key, row.sobject, objectPermission);
      }
    });
    return row;
  });
}

function getRowTabVisibilityPermissionFromFieldPermissionItem(
  key: string,
  sobject: string,
  item: TabVisibilityPermissionItem,
): PermissionTableTabVisibilityCellPermission {
  return {
    rowKey: sobject,
    parentId: key,
    sobject,
    visible: item.visible,
    available: item.available,
    visibleIsDirty: false,
    availableIsDirty: false,
    record: item,
    errorMessage: item.errorMessage,
  };
}

export function getSystemPermissionColumns(
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  profilesById: Record<string, PermissionSetWithProfileRecord>,
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>,
) {
  const newColumns: ColumnWithFilter<PermissionTableSystemPermissionCell, PermissionTableSummaryRow>[] = [
    {
      ...(setColumnFromType('tableLabel', 'text') as any),
      name: 'System Permission',
      key: 'tableLabel',
      frozen: true,
      width: 300,
      resizable: true,
      renderCell: ({ row }) => {
        const requires = SYSTEM_PERMISSION_DEPENDENCY_TOOLTIP[row.apiName];
        return (
          <div className="slds-grid slds-grid_vertical-align-center slds-truncate" title={row.tableLabel}>
            <span className="slds-truncate">{row.tableLabel}</span>
            {requires && (
              <Tooltip
                id={`tooltip-requires-${row.key}`}
                content={
                  <div>
                    <strong>Requires: </strong>
                    {requires}
                  </div>
                }
              >
                <Icon type="utility" icon="info" className="slds-icon slds-icon-text-default slds-icon_xx-small slds-m-left_xx-small" />
              </Tooltip>
            )}
          </div>
        );
      },
      summaryCellClass: 'bg-color-gray-dark no-outline',
      renderSummaryCell: ({ row }) => {
        if (row.type === 'HEADING') {
          return <ColumnSearchFilterSummary />;
        } else if (row.type === 'ACTION') {
          return <ColumnSearchFilter />;
        }
        return undefined;
      },
    },
    {
      name: '',
      key: '_ROW_ACTION',
      width: 100,
      resizable: false,
      frozen: true,
      renderCell: RowActionRenderer as any,
      summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
      renderSummaryCell: ({ row }) => {
        if (row.type === 'ACTION') {
          return <BulkActionRenderer />;
        }
        return undefined;
      },
    },
  ];
  // one checkbox column per profile, then per permission set
  selectedProfiles.forEach((profileId) => {
    const profile = profilesById[profileId];
    newColumns.push(
      getColumnForProfileOrPermSet({
        isFirstItem: true,
        permissionType: 'systemPermission',
        id: profileId,
        type: 'Profile',
        label: profile?.Profile?.Name || '',
        actionType: 'Enabled',
        actionKey: 'enabled',
      }),
    );
  });
  selectedPermissionSets.forEach((permissionSetId) => {
    const permissionSet = permissionSetsById[permissionSetId];
    newColumns.push(
      getColumnForProfileOrPermSet({
        isFirstItem: true,
        permissionType: 'systemPermission',
        id: permissionSetId,
        type: 'Permission Set',
        label: permissionSet?.Name || '',
        actionType: 'Enabled',
        actionKey: 'enabled',
      }),
    );
  });
  return newColumns;
}

export function getSystemPermissionRows(systemPermissionMap: Record<string, SystemPermissionDefinitionMap>) {
  const rows: PermissionTableSystemPermissionCell[] = [];
  Object.values(systemPermissionMap)
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((systemPermission) => {
      const currRow: PermissionTableSystemPermissionCell = {
        key: systemPermission.apiName,
        sobject: systemPermission.apiName,
        apiName: systemPermission.apiName,
        label: systemPermission.label,
        tableLabel: `${systemPermission.label} (${systemPermission.apiName})`,
        permissions: {},
      };

      systemPermission.permissionKeys.forEach((key) => {
        const item = systemPermission.permissions[key];
        currRow.permissions[key] = getRowSystemPermissionFromItem(key, systemPermission.apiName, item);
      });

      rows.push(currRow);
    });
  return rows;
}

function getRowSystemPermissionFromItem(
  key: string,
  apiName: string,
  item: SystemPermissionItem,
): PermissionTableSystemPermissionCellPermission {
  return {
    rowKey: apiName,
    parentId: key,
    sobject: apiName,
    field: apiName,
    enabled: item.enabled,
    enabledIsDirty: false,
    record: item,
    errorMessage: item.errorMessage,
  };
}

export function updateSystemPermissionRowsAfterSave(
  rows: PermissionTableSystemPermissionCell[],
  systemPermissionMap: Record<string, SystemPermissionDefinitionMap>,
): PermissionTableSystemPermissionCell[] {
  return rows.map((oldRow) => {
    const row = { ...oldRow };
    systemPermissionMap[row.key].permissionKeys.forEach((key) => {
      row.permissions = { ...row.permissions };
      const systemPermission = systemPermissionMap[row.key].permissions[key];
      if (systemPermission.errorMessage) {
        row.permissions[key] = { ...row.permissions[key], errorMessage: systemPermission.errorMessage };
      } else {
        row.permissions[key] = getRowSystemPermissionFromItem(key, row.apiName, systemPermission);
      }
    });
    return row;
  });
}

/**
 * Apply Salesforce's system-permission dependency rules across rows within each column
 * (profile/permission set). System permissions live on separate rows but depend on one another, so a
 * change to one cell must ripple to the matching cells of the permissions it requires / that require it:
 * enabling a permission enables everything it requires; disabling one disables everything that requires it.
 *
 * `changedRows` are the rows handed to this update: the single-cell edit path forwards just the edited
 * row(s), while bulk/column actions and the post-save reset pass their own (often full) computed row
 * sets. We diff each against `prevRows` to find enable/disable transitions, then cascade. Returns the
 * full row set plus `affectedKeys` — every row in `changedRows` plus any cascade targets — so the caller
 * recomputes dirty state only for those rows. When the caller passes the full set (e.g. the post-save
 * reset), this spans every row, which is what lets that path clear dirty state for all saved rows.
 */
export function applySystemPermissionDependencies(
  prevRows: PermissionTableSystemPermissionCell[],
  changedRows: PermissionTableSystemPermissionCell[],
): { rows: PermissionTableSystemPermissionCell[]; affectedKeys: Set<string> } {
  const prevByKey = groupByFlat(prevRows, 'key');
  const changedByKey = groupByFlat(changedRows, 'key');

  // working copy: changed rows swapped in, all others still reference the previous row
  const working: Record<string, PermissionTableSystemPermissionCell> = {};
  prevRows.forEach((row) => (working[row.key] = changedByKey[row.key] ?? row));

  const affectedKeys = new Set<string>(Object.keys(changedByKey));
  // changed rows are already fresh objects from the edit; only cascade targets need cloning
  const clonedForCascade = new Set<string>();

  function cloneCascadeTarget(key: string): PermissionTableSystemPermissionCell {
    if (!clonedForCascade.has(key)) {
      working[key] = { ...working[key], permissions: { ...working[key].permissions } };
      clonedForCascade.add(key);
    }
    return working[key];
  }

  changedRows.forEach((changedRow) => {
    const prevRow = prevByKey[changedRow.key];
    if (!prevRow) {
      return;
    }
    Object.keys(changedRow.permissions).forEach((parentId) => {
      const newValue = changedRow.permissions[parentId]?.enabled;
      const oldValue = prevRow.permissions[parentId]?.enabled;
      if (newValue === oldValue) {
        return;
      }
      // enabling -> pull in required permissions; disabling -> drop dependents
      const targets = newValue ? SYSTEM_PERMISSION_REQUIRED_CLOSURE[changedRow.key] : SYSTEM_PERMISSION_DEPENDENT_CLOSURE[changedRow.key];
      targets?.forEach((targetKey) => {
        const targetRow = working[targetKey];
        // dependency may not exist in this org (license/feature gated) — nothing to toggle
        const cell = targetRow?.permissions[parentId];
        if (!cell || cell.enabled === newValue) {
          return;
        }
        const row = cloneCascadeTarget(targetKey);
        const newCell: PermissionTableSystemPermissionCellPermission = { ...cell, enabled: newValue };
        newCell.enabledIsDirty = newCell.enabled !== newCell.record.enabled;
        row.permissions[parentId] = newCell;
        affectedKeys.add(targetKey);
      });
    });
  });

  return { rows: prevRows.map((row) => working[row.key]), affectedKeys };
}

/**
 *
 * JSX Components
 *
 */

export function getConfirmationModalContent(
  dirtyObjectCount: number,
  dirtyFieldCount: number,
  dirtyTabVisibilityCount: number,
  dirtySystemPermissionCount: number,
) {
  return (
    <div>
      <p>You have made changes to:</p>
      <ul>
        {[
          {
            dirty: !!dirtyObjectCount,
            jsx: (
              <strong>
                {dirtyObjectCount} Object {pluralizeFromNumber('Permission', dirtyObjectCount)}
              </strong>
            ),
          },
          {
            dirty: !!dirtyFieldCount,
            jsx: (
              <strong>
                {dirtyFieldCount} Field {pluralizeFromNumber('Permission', dirtyFieldCount)}
              </strong>
            ),
          },
          {
            dirty: !!dirtyTabVisibilityCount,
            jsx: (
              <strong>
                {dirtyTabVisibilityCount} Tab Visibility {pluralizeFromNumber('Permission', dirtyTabVisibilityCount)}
              </strong>
            ),
          },
          {
            dirty: !!dirtySystemPermissionCount,
            jsx: (
              <strong>
                {dirtySystemPermissionCount} System {pluralizeFromNumber('Permission', dirtySystemPermissionCount)}
              </strong>
            ),
          },
        ]
          .filter(({ dirty }) => dirty)
          .map(({ jsx }, i) => (
            <li key={i}>{jsx}</li>
          ))}
      </ul>
    </div>
  );
}

/**
 * Performs bulk action against a column
 */
export function updateRowsFromColumnAction<TRows extends PermissionTableCellExtended>(
  type: PermissionType,
  action: 'selectAll' | 'unselectAll' | 'reset',
  which: PermissionTypes,
  id: string,
  rows: TRows[],
): TRows[] {
  const newRows = [...rows];
  return newRows.map((row, _index) => {
    if (isBlockedObjectPermission(row)) {
      return row;
    }
    // Reset restores the saved value, so it stays allowed even where the permission cannot be set
    if (action !== 'reset' && isBlockedViewAllModifyAll(which, row)) {
      return row;
    }
    row = { ...row };
    let newValue = action === 'selectAll';
    row.permissions = { ...row.permissions };
    row.permissions = { ...row.permissions, [id]: { ...row.permissions[id] } } as any; // FIXME: why do we need any?
    if (type === 'object') {
      const permission = row.permissions[id] as PermissionTableObjectCellPermission;
      if (which === 'create') {
        newValue = action === 'reset' ? permission.record.create : newValue;
        permission.create = newValue;
        setObjectDependencies(permission, newValue, ['read'], []);
      } else if (which === 'read') {
        newValue = action === 'reset' ? permission.record.read : newValue;
        permission.read = newValue;
        setObjectDependencies(permission, newValue, [], ['create', 'edit', 'delete', 'viewAll', 'modifyAll']);
      } else if (which === 'edit') {
        newValue = action === 'reset' ? permission.record.edit : newValue;
        permission.edit = newValue;
        setObjectDependencies(permission, newValue, ['read'], ['delete', 'modifyAll']);
      } else if (which === 'delete') {
        newValue = action === 'reset' ? permission.record.delete : newValue;
        permission.delete = newValue;
        setObjectDependencies(permission, newValue, ['read', 'edit'], ['modifyAll']);
      } else if (which === 'viewAll') {
        newValue = action === 'reset' ? permission.record.viewAll : newValue;
        permission.viewAll = newValue;
        setObjectDependencies(permission, newValue, ['read'], ['modifyAll']);
      } else if (which === 'modifyAll') {
        newValue = action === 'reset' ? permission.record.modifyAll : newValue;
        permission.modifyAll = newValue;
        setObjectDependencies(permission, newValue, ['read', 'edit', 'delete', 'viewAll'], []);
      } else if (which === 'viewAllFields') {
        newValue = action === 'reset' ? permission.record.viewAllFields : newValue;
        permission.viewAllFields = newValue;
        permission.viewAllFieldsIsDirty = permission.viewAllFields !== permission.record.viewAllFields;
        setObjectDependencies(permission, newValue, [], []);
      }
    } else if (type === 'field') {
      const permission = row.permissions[id] as PermissionTableFieldCellPermission;
      if (which === 'read') {
        newValue = action === 'reset' ? permission.record.read : newValue;
        permission.read = newValue;
        setFieldDependencies(permission, newValue, [], ['edit']);
      } else if ('allowEditPermission' in row && row.allowEditPermission) {
        newValue = action === 'reset' ? permission.record.edit : newValue;
        permission.edit = newValue;
        setFieldDependencies(permission, newValue, ['read'], []);
      }
    } else if (type === 'tabVisibility' && (!('canSetPermission' in row) || row.canSetPermission)) {
      const permission = row.permissions[id] as PermissionTableTabVisibilityCellPermission;
      if (which === 'available') {
        newValue = action === 'reset' ? permission.record.available : newValue;
        permission.available = newValue;
        setTabVisibilityDependencies(permission, newValue, [], ['visible']);
      } else if (which === 'visible') {
        newValue = action === 'reset' ? permission.record.visible : newValue;
        permission.visible = newValue;
        setTabVisibilityDependencies(permission, newValue, ['available'], []);
      }
    } else if (type === 'systemPermission') {
      const permission = row.permissions[id] as PermissionTableSystemPermissionCellPermission;
      if (which === 'enabled') {
        newValue = action === 'reset' ? permission.record.enabled : newValue;
        permission.enabled = newValue;
        setSystemPermissionDependencies(permission);
      }
    }
    return row;
  });
}

export function updateRowsFromRowAction<TRows extends PermissionTableCellExtended>(
  type: PermissionType,
  checkboxesById: Record<string, BulkActionCheckbox>,
  rows: TRows[],
): TRows[] {
  const newRows = [...rows];
  return newRows.map((row) => {
    row = { ...row };
    row.permissions = { ...row.permissions };
    for (const permissionId in row.permissions) {
      row.permissions = { ...row.permissions, [permissionId]: { ...row.permissions[permissionId] } } as any;
      if (type === 'object' && !isBlockedObjectPermission(row)) {
        const permission = row.permissions[permissionId] as PermissionTableObjectCellPermission;
        permission.create = checkboxesById['create'].value;
        permission.read = checkboxesById['read'].value;

        permission.edit = checkboxesById['edit'].value;
        permission.delete = checkboxesById['delete'].value;
        if (!isBlockedViewAllModifyAll('viewAll', row)) {
          permission.viewAll = checkboxesById['viewAll'].value;
          permission.modifyAll = checkboxesById['modifyAll'].value;
        }
        permission.viewAllFields = checkboxesById['viewAllFields'].value;

        permission.createIsDirty = permission.create !== permission.record.create;
        permission.readIsDirty = permission.read !== permission.record.read;
        permission.editIsDirty = permission.edit !== permission.record.edit;
        permission.deleteIsDirty = permission.delete !== permission.record.delete;
        permission.viewAllIsDirty = permission.viewAll !== permission.record.viewAll;
        permission.modifyAllIsDirty = permission.modifyAll !== permission.record.modifyAll;
        permission.viewAllFieldsIsDirty = permission.viewAllFields !== permission.record.viewAllFields;
      } else if (type === 'field') {
        const permission = row.permissions[permissionId] as PermissionTableFieldCellPermission;
        permission.read = checkboxesById['read'].value;
        if ('allowEditPermission' in row && row.allowEditPermission) {
          permission.edit = checkboxesById['edit'].value;
        }
        permission.readIsDirty = permission.read !== permission.record.read;
        permission.editIsDirty = permission.edit !== permission.record.edit;
      } else if (type === 'tabVisibility' && (!('canSetPermission' in row) || row.canSetPermission)) {
        const permission = row.permissions[permissionId] as PermissionTableTabVisibilityCellPermission;
        permission.available = checkboxesById['available'].value;
        permission.visible = checkboxesById['visible'].value;

        permission.availableIsDirty = permission.available !== permission.record.available;
        permission.visibleIsDirty = permission.visible !== permission.record.visible;
      } else if (type === 'systemPermission') {
        const permission = row.permissions[permissionId] as PermissionTableSystemPermissionCellPermission;
        permission.enabled = checkboxesById['enabled'].value;
        permission.enabledIsDirty = permission.enabled !== permission.record.enabled;
      }
    }
    return row;
  });
}

export function resetRow<TRows extends PermissionTableCellExtended>(type: PermissionType, rows: TRows[]): TRows[] {
  const newRows = [...rows];
  return newRows.map((row) => {
    row = { ...row };
    row.permissions = { ...row.permissions };
    for (const permissionId in row.permissions) {
      row.permissions = { ...row.permissions, [permissionId]: { ...row.permissions[permissionId] } } as any;
      if (type === 'object') {
        const permission = row.permissions[permissionId] as PermissionTableObjectCellPermission;

        if (permission.createIsDirty) {
          permission.create = !permission.create;
        }
        if (permission.readIsDirty) {
          permission.read = !permission.read;
        }
        if (permission.editIsDirty) {
          permission.edit = !permission.edit;
        }
        if (permission.deleteIsDirty) {
          permission.delete = !permission.delete;
        }
        if (permission.viewAllIsDirty) {
          permission.viewAll = !permission.viewAll;
        }
        if (permission.modifyAllIsDirty) {
          permission.modifyAll = !permission.modifyAll;
        }
        if (permission.viewAllFieldsIsDirty) {
          permission.viewAllFields = !permission.viewAllFields;
        }

        permission.createIsDirty = false;
        permission.readIsDirty = false;
        permission.editIsDirty = false;
        permission.deleteIsDirty = false;
        permission.viewAllIsDirty = false;
        permission.modifyAllIsDirty = false;
        permission.viewAllFieldsIsDirty = false;
      } else if (type === 'field') {
        const permission = row.permissions[permissionId] as PermissionTableFieldCellPermission;
        if (permission.readIsDirty) {
          permission.read = !permission.read;
        }
        if (permission.editIsDirty) {
          permission.edit = !permission.edit;
        }

        permission.readIsDirty = false;
        permission.editIsDirty = false;
      } else if (type === 'tabVisibility' && (!('canSetPermission' in row) || row.canSetPermission)) {
        const permission = row.permissions[permissionId] as PermissionTableTabVisibilityCellPermission;
        if (permission.availableIsDirty) {
          permission.available = !permission.available;
        }
        if (permission.visibleIsDirty) {
          permission.visible = !permission.visible;
        }

        permission.availableIsDirty = false;
        permission.visibleIsDirty = false;
      } else if (type === 'systemPermission') {
        const permission = row.permissions[permissionId] as PermissionTableSystemPermissionCellPermission;
        if (permission.enabledIsDirty) {
          permission.enabled = !permission.enabled;
        }
        permission.enabledIsDirty = false;
      }
    }
    return row;
  });
}

/**
 * Pinned row selection renderer
 */
export const PinnedSelectAllRendererWrapper = ({
  column,
  contextLabel,
}: RenderSummaryCellProps<any, unknown> & { contextLabel?: string }) => {
  const { onColumnAction, announce } = useContext(DataTableGenericContext) as PermissionManagerTableContext;
  // e.g. "Read for Admin (Profile)" — every column renders these same three buttons, so the
  // accessible names and the outcome announcement must say which column they act on
  const scopedSuffix = contextLabel ? `: ${contextLabel}` : '';

  function handleSelection(action: 'selectAll' | 'unselectAll' | 'reset') {
    onColumnAction(action, column.key);
    const outcome =
      action === 'selectAll'
        ? `Selected all visible rows${scopedSuffix}`
        : action === 'unselectAll'
          ? `Unselected all visible rows${scopedSuffix}`
          : `Reset visible rows to previous selection${scopedSuffix}`;
    announce(outcome);
  }

  return (
    <div
      className="slds-grid slds-grid_gutter slds-grid_align-center w-100"
      css={css`
        margin-top: 3px;
      `}
    >
      <button
        className="slds-button slds-button_icon slds-button_icon-border"
        tabIndex={-1}
        title={`Select all visible rows${scopedSuffix}`}
        onClick={() => handleSelection('selectAll')}
      >
        <Icon type="utility" icon="multi_select_checkbox" className="slds-button__icon slds-button__icon_small" omitContainer />
        <span className="slds-assistive-text">Select all visible rows{scopedSuffix}</span>
      </button>
      <button
        className="slds-button slds-button_icon slds-button_icon-border"
        tabIndex={-1}
        title={`Unselect all visible rows${scopedSuffix}`}
        onClick={() => handleSelection('unselectAll')}
      >
        <Icon type="utility" icon="steps" className="slds-button__icon slds-button__icon_small" omitContainer />
        <span className="slds-assistive-text">Unselect all visible rows{scopedSuffix}</span>
      </button>
      <button
        className="slds-button slds-button_icon slds-button_icon-border"
        tabIndex={-1}
        title={`Reset visible rows to previous selection${scopedSuffix}`}
        onClick={() => handleSelection('reset')}
      >
        <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_small" omitContainer />
        <span className="slds-assistive-text">Reset visible rows to previous selection{scopedSuffix}</span>
      </button>
    </div>
  );
};

/**
 * Apply pasted (or Delete-cleared) cell values to permission rows. `cells` come from the grid's paste
 * pipeline, already restricted to editable cells; column keys are `<profileOrPermSetId>-<actionKey>`.
 * Values coerce through `ensureBoolean` ('' — the Delete/clear fill — unchecks). Returns the input row
 * array with updated row objects substituted, ready for the tables' `onBulkUpdate`.
 */
export function applyPastedPermissionCells<T extends PermissionTableCellExtended>(
  permissionType: PermissionType,
  visibleRows: T[],
  cells: { rowKey: string; columnKey: string; value: string }[],
): T[] {
  const rowIndexByKey = new Map(visibleRows.map((row, index) => [row.key, index]));
  const updatedRows = [...visibleRows];
  cells.forEach(({ rowKey, columnKey, value }) => {
    const rowIndex = rowIndexByKey.get(rowKey);
    if (rowIndex === undefined) {
      return;
    }
    const separatorIndex = columnKey.lastIndexOf('-');
    const permissionId = columnKey.slice(0, separatorIndex);
    const actionKey = columnKey.slice(separatorIndex + 1);
    const row = updatedRows[rowIndex];
    if (!row.permissions[permissionId]) {
      return;
    }
    const newValue = ensureBoolean(value.trim());
    if (permissionType === 'object') {
      updatedRows[rowIndex] = setObjectValue(actionKey as ObjectPermissionTypes, row as any, permissionId, newValue) as unknown as T;
    } else if (permissionType === 'field') {
      updatedRows[rowIndex] = setFieldValue(actionKey as FieldPermissionTypes, row as any, permissionId, newValue) as unknown as T;
    } else if (permissionType === 'tabVisibility') {
      updatedRows[rowIndex] = setTabVisibilityValue(
        actionKey as TabVisibilityPermissionTypes,
        row as any,
        permissionId,
        newValue,
      ) as unknown as T;
    } else if (permissionType === 'systemPermission') {
      updatedRows[rowIndex] = setSystemPermissionValue('enabled', row as any, permissionId, newValue) as unknown as T;
    }
  });
  return updatedRows;
}

/**
 * * Checkbox list for the row / bulk action popovers. Omit `row` for the table-wide bulk action, which
 * spans a mix of rows — per-row restrictions are enforced when the change is applied instead.
 */
function defaultRowActionCheckboxes(type: PermissionType, row?: PermissionTableCellExtended): BulkActionCheckbox[] {
  const allowEditPermission = !row || !('allowEditPermission' in row) || row.allowEditPermission;
  const allowViewAllModifyAll = !row || !isBlockedViewAllModifyAll('viewAll', row);
  const allowObjectPermission = !row || !isBlockedObjectPermission(row);
  if (type === 'object') {
    return [
      { id: 'create', label: 'Create', value: false, disabled: !allowObjectPermission },
      { id: 'read', label: 'Read', value: false, disabled: !allowObjectPermission },
      { id: 'edit', label: 'Edit', value: false, disabled: !allowObjectPermission || !allowEditPermission },
      { id: 'delete', label: 'Delete', value: false, disabled: !allowObjectPermission },
      { id: 'viewAll', label: 'View All', value: false, disabled: !allowObjectPermission || !allowViewAllModifyAll },
      { id: 'modifyAll', label: 'Modify All', value: false, disabled: !allowObjectPermission || !allowViewAllModifyAll },
      { id: 'viewAllFields', label: 'View All Fields', value: false, disabled: !allowObjectPermission },
    ];
  } else if (type === 'field') {
    return [
      { id: 'read', label: 'Read', value: false, disabled: false },
      { id: 'edit', label: 'Edit', value: false, disabled: !allowEditPermission },
    ];
  } else if (type === 'tabVisibility') {
    return [
      { id: 'available', label: 'Available', value: false, disabled: false },
      { id: 'visible', label: 'Visible', value: false, disabled: false },
    ];
  } else if (type === 'systemPermission') {
    return [{ id: 'enabled', label: 'Enabled', value: false, disabled: false }];
  } else {
    throw new Error(`Invalid type ${type}`);
  }
}

export function updateCheckboxDependencies(
  which: PermissionTypes,
  type: PermissionType,
  checkboxesById: Record<string, BulkActionCheckbox>,
  value: boolean,
) {
  if (type === 'object') {
    if (which === 'create') {
      checkboxesById['create'] = { ...checkboxesById['create'], value };
      if (checkboxesById['create'].value) {
        checkboxesById['read'].value = true;
      }
    } else if (which === 'read') {
      checkboxesById['read'] = { ...checkboxesById['read'], value };
      if (!checkboxesById['read'].value) {
        checkboxesById['create'].value = false;
        checkboxesById['edit'].value = false;
        checkboxesById['delete'].value = false;
        checkboxesById['viewAll'].value = false;
        checkboxesById['modifyAll'].value = false;
      }
    } else if (which === 'edit') {
      checkboxesById['edit'] = { ...checkboxesById['edit'], value };
      if (checkboxesById['edit'].value) {
        checkboxesById['read'].value = true;
      } else {
        checkboxesById['delete'].value = false;
        checkboxesById['modifyAll'].value = false;
      }
    } else if (which === 'delete') {
      checkboxesById['delete'] = { ...checkboxesById['delete'], value };
      if (checkboxesById['delete'].value) {
        checkboxesById['read'].value = true;
        checkboxesById['edit'].value = true;
      } else {
        checkboxesById['modifyAll'].value = false;
      }
    } else if (which === 'viewAll') {
      checkboxesById['viewAll'] = { ...checkboxesById['viewAll'], value };
      if (checkboxesById['viewAll'].value) {
        checkboxesById['read'].value = true;
      } else {
        checkboxesById['modifyAll'].value = false;
      }
    } else if (which === 'modifyAll') {
      checkboxesById['modifyAll'] = { ...checkboxesById['modifyAll'], value };
      if (checkboxesById['modifyAll'].value) {
        checkboxesById['read'].value = true;
        checkboxesById['edit'].value = true;
        checkboxesById['delete'].value = true;
        checkboxesById['viewAll'].value = true;
      }
    } else if (which === 'viewAllFields') {
      checkboxesById['viewAllFields'] = { ...checkboxesById['viewAllFields'], value };
    }
  } else if (type === 'field') {
    if (which === 'read') {
      checkboxesById['read'] = { ...checkboxesById['read'], value };
      if (!checkboxesById['read'].value) {
        checkboxesById['edit'].value = false;
      }
    } else if (which === 'edit') {
      checkboxesById['edit'] = { ...checkboxesById['edit'], value };
      if (checkboxesById['edit'].value) {
        checkboxesById['read'].value = true;
      }
    }
  } else if (type === 'tabVisibility') {
    if (which === 'available') {
      checkboxesById['available'] = { ...checkboxesById['available'], value };
      if (!checkboxesById['available'].value) {
        checkboxesById['visible'].value = false;
      }
    } else if (which === 'visible') {
      checkboxesById['visible'] = { ...checkboxesById['visible'], value };
      if (checkboxesById['visible'].value) {
        checkboxesById['available'].value = true;
      }
    }
  } else if (type === 'systemPermission') {
    if (which === 'enabled') {
      checkboxesById['enabled'] = { ...checkboxesById['enabled'], value };
    }
  }
}

/**
 * Row action renderer
 *
 * This component provides a popover that the user can open to make changes that apply to an entire row
 * PermissionTableObjectCell, PermissionTableSummaryRow
 * readonly renderCell?: Maybe<(props: RenderCellProps<TRow, TSummaryRow>) => ReactNode>;
 */
export const RowActionRenderer = ({ commitEdit, row }: RenderCellProps<PermissionTableCellExtended, PermissionTableSummaryRow>) => {
  const { type } = useContext(DataTableGenericContext) as PermissionManagerTableContext;
  const popoverRef = useRef<PopoverRef>(null);
  const [checkboxes, setCheckboxes] = useState<BulkActionCheckbox[]>(() => {
    return defaultRowActionCheckboxes(type, row);
  });

  /**
   * Set all dependencies when fields change
   */
  function handleChange(which: PermissionTypes, value: boolean) {
    const checkboxesById = groupByFlat(checkboxes, 'id');
    updateCheckboxDependencies(which, type, checkboxesById, value);
    if (type === 'object') {
      setCheckboxes([
        checkboxesById['create'],
        checkboxesById['read'],
        checkboxesById['edit'],
        checkboxesById['delete'],
        checkboxesById['viewAll'],
        checkboxesById['modifyAll'],
        checkboxesById['viewAllFields'],
      ]);
    } else if (type === 'field') {
      setCheckboxes([checkboxesById['read'], checkboxesById['edit']]);
    } else if (type === 'tabVisibility') {
      setCheckboxes([checkboxesById['available'], checkboxesById['visible']]);
    } else if (type === 'systemPermission') {
      setCheckboxes([checkboxesById['enabled']]);
    }
  }

  function handleSave() {
    const checkboxesById = groupByFlat(checkboxes, 'id');
    const [updatedRow] = updateRowsFromRowAction(type, checkboxesById, [row]);
    commitEdit(updatedRow);
  }

  function handleReset() {
    const [updatedRow] = resetRow(type, [row]);
    commitEdit(updatedRow);
  }

  function handlePopoverChange(isOpen: boolean) {
    if (!isOpen) {
      setCheckboxes(defaultRowActionCheckboxes(type, row));
    }
  }

  function handleOpen() {
    popoverRef.current?.open();
  }

  return (
    <Popover
      ref={popoverRef}
      size={type === 'object' ? 'large' : 'medium'}
      placement="bottom"
      onChange={handlePopoverChange}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" id="background-jobs" title="Background Jobs">
            Apply change to row
          </h2>
        </header>
      }
      footer={
        <footer className="slds-popover__footer slds-grid slds-grid_align-center">
          <button className="slds-button slds-button_neutral" onClick={handleReset}>
            Reset Row
          </button>
          <button className="slds-button slds-button_brand" onClick={handleSave}>
            Apply to Row
          </button>
        </footer>
      }
      content={
        <div>
          <p className="slds-text-align_center slds-m-bottom_small">This change will apply to all selected profiles and permission sets</p>

          <Grid align="center" wrap>
            {checkboxes.map((item) => (
              <Checkbox
                key={item.id}
                id={item.id}
                checked={item.value}
                label={item.label}
                disabled={item.disabled}
                onChange={(value) => handleChange(item.id, value)}
              />
            ))}
          </Grid>
        </div>
      }
      buttonProps={{
        className: 'slds-button slds-button_stretch',
        tabIndex: -1,
        onChange: handleOpen,
        // Focused directly during grid navigation so "Edit Row, button" (and Enter to open) is announced
        'data-grid-inner-focus': true,
      }}
      buttonStyle={{ lineHeight: '1rem' }}
    >
      Edit Row
    </Popover>
  );
};

/**
 * Bulk Row action renderer
 *
 * This component provides a modal that the user can open to make changes that apply to an entire visible table
 */
export const ColumnSearchFilter = () => {
  const {
    filterValue: initialFilterValue,
    hasErrors,
    errorsOnly,
    onFilterRows,
    onToggleErrorsOnly,
  } = useContext(DataTableGenericContext) as PermissionManagerTableContext;
  return (
    <Grid verticalAlign="center">
      <div className="slds-grow">
        <SearchInput id="column-filter" value={initialFilterValue || ''} placeholder="Filter..." onChange={onFilterRows} />
      </div>
      {/* Only offered once a save has produced errors — otherwise it would always filter to nothing */}
      {hasErrors && onToggleErrorsOnly && (
        <Tooltip className="slds-m-left_x-small" content={errorsOnly ? 'Show all rows' : 'Show only rows with errors'}>
          <button
            type="button"
            aria-pressed={!!errorsOnly}
            className={classNames('slds-button slds-button_icon slds-button_icon-border', {
              'slds-is-selected': errorsOnly,
            })}
            tabIndex={-1}
            onClick={() => onToggleErrorsOnly(!errorsOnly)}
          >
            {/* `slds-is-selected` gives the button a blue background and its own white icon fill, so the
                error color is only applied while the toggle is off */}
            <Icon
              type="utility"
              icon="error"
              className={classNames('slds-button__icon slds-button__icon_small', { 'slds-icon-text-error': !errorsOnly })}
              omitContainer
            />
            <span className="slds-assistive-text">{errorsOnly ? 'Show all rows' : 'Show only rows with errors'}</span>
          </button>
        </Tooltip>
      )}
    </Grid>
  );
};

export const ColumnSearchFilterSummary = () => {
  const { type, rows, totalCount } = useContext(DataTableGenericContext) as PermissionManagerTableContext;
  if (!Array.isArray(rows) || !totalCount || rows.length === totalCount) {
    return null;
  }
  return (
    <p className="slds-text-body_small slds-text-color_weak">
      Showing {formatNumber(rows.length)} of {formatNumber(totalCount)} {pluralizeFromNumber(type, totalCount)}
    </p>
  );
};

/**
 * Bulk Row action renderer
 *
 * This component provides a modal that the user can open to make changes that apply to an entire visible table
 */
export const BulkActionRenderer = () => {
  const { type, rows, onBulkAction } = useContext(DataTableGenericContext) as PermissionManagerTableContext;
  const [isOpen, setIsOpen] = useState(false);
  const [checkboxes, setCheckboxes] = useState(() => defaultRowActionCheckboxes(type));

  const rowCount = useMemo(
    () => rows.filter((row) => (!('canSetPermission' in row) || row.canSetPermission) && !isBlockedObjectPermission(row)).length,
    [rows],
  );

  /**
   * Set all dependencies when fields change
   */
  function handleChange(which: PermissionTypes, value: boolean) {
    const checkboxesById = groupByFlat(checkboxes, 'id');
    updateCheckboxDependencies(which, type, checkboxesById, value);
    if (type === 'object') {
      setCheckboxes([
        checkboxesById['create'],
        checkboxesById['read'],
        checkboxesById['edit'],
        checkboxesById['delete'],
        checkboxesById['viewAll'],
        checkboxesById['modifyAll'],
        checkboxesById['viewAllFields'],
      ]);
    } else if (type === 'field') {
      setCheckboxes([checkboxesById['read'], checkboxesById['edit']]);
    } else if (type === 'tabVisibility') {
      setCheckboxes([checkboxesById['available'], checkboxesById['visible']]);
    } else if (type === 'systemPermission') {
      setCheckboxes([checkboxesById['enabled']]);
    }
  }

  function handleSave() {
    const checkboxesById = groupByFlat(checkboxes, 'id');
    const updatedRows = updateRowsFromRowAction(type, checkboxesById, rows);
    onBulkAction(updatedRows);
    handleClose();
  }

  function handleOpen() {
    setCheckboxes(defaultRowActionCheckboxes(type));
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
  }

  return (
    <Fragment>
      {isOpen && (
        <Modal
          header="Apply bulk change"
          footer={
            <Fragment>
              <button className="slds-button slds-button_neutral" onClick={() => handleClose()}>
                Cancel
              </button>
              <button className="slds-button slds-button_brand" onClick={handleSave} disabled={rowCount === 0}>
                Apply to All Visible Rows
              </button>
            </Fragment>
          }
          closeOnEsc
          closeOnBackdropClick
          onClose={() => handleClose()}
        >
          <div>
            <p className="slds-text-align_center slds-m-bottom_small">
              This change will apply to{' '}
              <strong>
                {formatNumber(rowCount)} {pluralizeFromNumber(type, rowCount)}
              </strong>{' '}
              and all selected profiles and permission sets
            </p>

            <Grid align="center" wrap>
              {checkboxes.map((item) => (
                <Checkbox
                  key={item.id}
                  id={item.id}
                  checked={item.value}
                  label={item.label}
                  disabled={item.disabled}
                  onChange={(value) => handleChange(item.id, value)}
                />
              ))}
            </Grid>
          </div>
        </Modal>
      )}
      <button className="slds-button slds-button_stretch" data-grid-inner-focus onClick={() => handleOpen()}>
        Edit All
      </button>
    </Fragment>
  );
};

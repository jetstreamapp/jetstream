import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { groupByFlat, orderValues, pluralizeFromNumber } from '@jetstream/shared/utils';
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
  PermissionTableTabVisibilityCell,
  PermissionTableTabVisibilityCellPermission,
  PermissionType,
  PermissionTypes,
  TabVisibilityPermissionDefinitionMap,
  TabVisibilityPermissionItem,
  TabVisibilityPermissionTypes,
} from '@jetstream/types';
import {
  Checkbox,
  ColumnWithFilter,
  DataTableGenericContext,
  Grid,
  Icon,
  Modal,
  Popover,
  PopoverRef,
  SearchInput,
  SummaryFilterRenderer,
  Tooltip,
  setColumnFromType,
} from '@jetstream/ui';
import startCase from 'lodash/startCase';
import { Fragment, useContext, useMemo, useRef, useState } from 'react';
import { RenderCellProps, RenderSummaryCellProps } from 'react-data-grid';

type PermissionTypeColumn<T> = T extends 'object'
  ? ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>
  : T extends 'field'
  ? ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>
  : T extends 'tabVisibility'
  ? ColumnWithFilter<PermissionTableTabVisibilityCell, PermissionTableSummaryRow>
  : never;

type PermissionActionType<T> = T extends 'object'
  ? 'Create' | 'Read' | 'Edit' | 'Delete' | 'ViewAll' | 'ModifyAll'
  : T extends 'field'
  ? 'Read' | 'Edit'
  : T extends 'tabVisibility'
  ? 'Available' | 'Visible'
  : never;

type PermissionActionAction<T> = T extends 'object'
  ? ObjectPermissionTypes
  : T extends 'field'
  ? FieldPermissionTypes
  : T extends 'tabVisibility'
  ? TabVisibilityPermissionTypes
  : never;

function setObjectValue(which: ObjectPermissionTypes, row: PermissionTableObjectCell, permissionId: string, value: boolean) {
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
  value: boolean
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

/**
 * Set dependent fields based on what selections are made
 */
function setObjectDependencies(
  permission: PermissionTableObjectCellPermission,
  value: boolean,
  setIfTrue: ObjectPermissionTypes[],
  setIfFalse: ObjectPermissionTypes[]
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
}

/**
 * Set dependent fields based on what selections are made
 */
function setFieldDependencies(
  permission: PermissionTableFieldCellPermission,
  value: boolean,
  setIfTrue: FieldPermissionTypes[],
  setIfFalse: FieldPermissionTypes[]
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
  setIfFalse: TabVisibilityPermissionTypes[]
) {
  if (value) {
    setIfTrue.forEach((prop) => (permission[prop] = value));
  } else {
    setIfFalse.forEach((prop) => (permission[prop] = value));
  }
  permission.availableIsDirty = permission.available !== permission.record.available;
  permission.visibleIsDirty = permission.visible !== permission.record.visible;
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
  | { rows: PermissionTableTabVisibilityCell[]; type: 'tabVisibility' }) {
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
          permission.modifyAllIsDirty
        ) {
          permission.create = permission.createIsDirty ? !permission.create : permission.create;
          permission.read = permission.readIsDirty ? !permission.read : permission.read;
          permission.edit = permission.editIsDirty ? !permission.edit : permission.edit;
          permission.delete = permission.deleteIsDirty ? !permission.delete : permission.delete;
          permission.viewAll = permission.viewAllIsDirty ? !permission.viewAll : permission.viewAll;
          permission.modifyAll = permission.modifyAllIsDirty ? !permission.modifyAll : permission.modifyAll;
          permission.createIsDirty = false;
          permission.readIsDirty = false;
          permission.editIsDirty = false;
          permission.deleteIsDirty = false;
          permission.viewAllIsDirty = false;
          permission.modifyAllIsDirty = false;
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
        permission.modifyAllIsDirty
    )
  );
}

export function getDirtyFieldPermissions(dirtyRows: Record<string, DirtyRow<PermissionTableFieldCell>>) {
  return Object.values(dirtyRows).flatMap(({ row }) =>
    Object.values(row.permissions).filter((permission) => permission.readIsDirty || permission.editIsDirty)
  );
}

export function getDirtyTabVisibilityPermissions(dirtyRows: Record<string, DirtyRow<PermissionTableTabVisibilityCell>>) {
  return Object.values(dirtyRows).flatMap(({ row }) =>
    Object.values(row.permissions).filter((permission) => permission.availableIsDirty || permission.visibleIsDirty)
  );
}

export function getObjectColumns(
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  profilesById: Record<string, PermissionSetWithProfileRecord>,
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>
) {
  const newColumns: ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>[] = [
    {
      ...(setColumnFromType('tableLabel', 'text') as any),
      name: 'Object',
      key: 'tableLabel',
      frozen: true,
      width: 300,
      getValue: ({ column, row }) => {
        const data: PermissionTableFieldCell = row[column.key as keyof PermissionTableObjectCell] as any;
        return data && `${data.label} (${data.apiName})`;
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
  // Create column groups for profiles
  selectedProfiles.forEach((profileId) => {
    const profile = profilesById[profileId];
    (['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'] as const).forEach((permissionType, i) => {
      newColumns.push(
        getColumnForProfileOrPermSet({
          isFirstItem: i === 0,
          permissionType: 'object',
          id: profileId,
          type: 'Profile',
          label: profile?.Profile?.Name || '',
          actionType: startCase(permissionType) as 'Create' | 'Read' | 'Edit' | 'Delete' | 'ViewAll' | 'ModifyAll',
          actionKey: permissionType,
        })
      );
    });
  });
  // Create column groups for permission sets
  selectedPermissionSets.forEach((permissionSetId) => {
    const permissionSet = permissionSetsById[permissionSetId];
    (['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'] as const).forEach((permissionType, i) => {
      newColumns.push(
        getColumnForProfileOrPermSet({
          isFirstItem: i === 0,
          permissionType: 'object',
          id: permissionSetId,
          type: 'Permission Set',
          label: permissionSet?.Name || '',
          actionType: startCase(permissionType) as 'Create' | 'Read' | 'Edit' | 'Delete' | 'ViewAll' | 'ModifyAll',
          actionKey: permissionType,
        })
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
      sobject: sobject,
      apiName: objectPermission.apiName,
      label: objectPermission.label,
      tableLabel: `${objectPermission.label} (${objectPermission.apiName})`,
      allowEditPermission: true,
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
  item: ObjectPermissionItem
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
    record: item,
    createIsDirty: false,
    readIsDirty: false,
    editIsDirty: false,
    deleteIsDirty: false,
    viewAllIsDirty: false,
    modifyAllIsDirty: false,
    errorMessage: item.errorMessage,
  };
}

export function updateObjectRowsAfterSave(
  rows: PermissionTableObjectCell[],
  objectPermissionMap: Record<string, ObjectPermissionDefinitionMap>
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

export function getFieldColumns(
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  profilesById: Record<string, PermissionSetWithProfileRecord>,
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>
) {
  const newColumns: ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>[] = [
    {
      ...(setColumnFromType('sobject', 'text') as any),
      name: 'Object',
      key: 'sobject',
      width: 85,
      cellClass: 'bg-color-gray-dark',
      summaryCellClass: 'bg-color-gray-dark',
      renderGroupCell: ({ isExpanded }) => (
        <Grid align="end" verticalAlign="center" className="h-100">
          <Icon
            icon={isExpanded ? 'chevrondown' : 'chevronright'}
            type="utility"
            className="slds-icon slds-icon-text-default slds-icon_x-small"
            title="Toggle collapse"
          />
        </Grid>
      ),
    },
    {
      ...setColumnFromType('tableLabel', 'text'),
      name: 'Field',
      key: 'tableLabel',
      frozen: true,
      width: 300,
      renderGroupCell: ({ groupKey, childRows, toggleGroup }) => (
        <>
          <button className="slds-button" onClick={toggleGroup}>
            {groupKey as string}
          </button>
          <span className="slds-m-left_xx-small slds-text-body_small slds-text-color_weak">({childRows.length})</span>
        </>
      ),
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
  ];

  // Create column groups for profiles
  selectedProfiles.forEach((profileId, i) => {
    const profile = profilesById[profileId];
    (['read', 'edit'] as const).forEach((permissionType, i) => {
      newColumns.push(
        getColumnForProfileOrPermSet({
          isFirstItem: i === 0,
          permissionType: 'field',
          id: profileId,
          type: 'Profile',
          label: profile.Profile.Name,
          actionType: startCase(permissionType) as 'Read' | 'Edit',
          actionKey: permissionType,
        })
      );
    });
  });
  // Create column groups for permission sets
  selectedPermissionSets.forEach((permissionSetId, i) => {
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
        })
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
  const numItems = permissionType === 'object' ? 6 : 2;
  const colWidth = Math.max(116, (`${label} (${type})`.length * 7.5) / numItems);
  const column: ColumnWithFilter<PermissionTableCellExtended, PermissionTableSummaryRow> = {
    name: `${label} (${type})`,
    key: `${id}-${actionKey}`,
    width: colWidth,
    filters: ['BOOLEAN_SET'],
    cellClass: (row) => {
      if (permissionType === 'object') {
        const permission = row.permissions[id] as PermissionTableObjectCellPermission;
        if (
          (actionKey === 'create' && permission.createIsDirty) ||
          (actionKey === 'read' && permission.readIsDirty) ||
          (actionKey === 'edit' && permission.editIsDirty) ||
          (actionKey === 'delete' && permission.deleteIsDirty) ||
          (actionKey === 'viewAll' && permission.viewAllIsDirty) ||
          (actionKey === 'modifyAll' && permission.modifyAllIsDirty)
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
      return undefined;
    },
    renderCell: ({ row, onRowChange }) => {
      // If the row is not editable, then we don't want to show the checkbox
      if (permissionType === 'tabVisibility' && 'canSetPermission' in row && !row.canSetPermission) {
        return null;
      }

      const errorMessage = row.permissions[id].errorMessage;
      const value = (row.permissions[id] as any)[actionKey] as boolean;

      function handleChange(value: boolean) {
        if (permissionType === 'object') {
          const newRow = setObjectValue(actionKey as PermissionActionAction<'object'>, row as PermissionTableObjectCell, id, value);
          onRowChange(newRow);
        } else if (permissionType === 'field') {
          const newRow = setFieldValue(actionKey as PermissionActionAction<'field'>, row as PermissionTableFieldCell, id, value);
          onRowChange(newRow);
        } else if (permissionType === 'tabVisibility') {
          const newRow = setTabVisibilityValue(
            actionKey as PermissionActionAction<'tabVisibility'>,
            row as PermissionTableTabVisibilityCell,
            id,
            value
          );
          onRowChange(newRow);
        }
      }

      const disabled = actionKey === 'edit' && 'allowEditPermission' in row && !row.allowEditPermission;

      return (
        <div className="slds-align_absolute-center h-100" onClick={() => !disabled && handleChange(!value)}>
          <input
            type="checkbox"
            id={`${row.key}-${id}-${actionKey}`}
            checked={value}
            onChange={(ev) => {
              ev.stopPropagation();
              handleChange(ev.target.checked);
            }}
            disabled={disabled}
          ></input>
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
    getValue: ({ column, row }) => (row.permissions[id] as any)[actionKey as any],
    summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
    renderSummaryCell: (args) => {
      if (args.row.type === 'HEADING') {
        return <SummaryFilterRenderer columnKey={`${id}-${actionKey}`} label={actionType} />;
      }
      return <PinnedSelectAllRendererWrapper {...(args as RenderSummaryCellProps<any, unknown>)} />;
    },
  };
  return column as PermissionTypeColumn<T>;
}

export function getFieldRows(
  selectedSObjects: string[],
  fieldsByObject: Record<string, string[]>,
  fieldPermissionMap: Record<string, FieldPermissionDefinitionMap>
) {
  const rows: PermissionTableFieldCell[] = [];
  orderValues(selectedSObjects).forEach((sobject) => {
    fieldsByObject[sobject]?.forEach((fieldKey) => {
      const fieldPermission = fieldPermissionMap[fieldKey];

      const currRow: PermissionTableFieldCell = {
        key: fieldKey,
        sobject: sobject,
        apiName: fieldPermission.apiName,
        label: fieldPermission.label,
        tableLabel: `${fieldPermission.label} (${fieldPermission.apiName})`,
        type: fieldPermission.metadata.DataType,
        // formula fields and auto-number fields do not allow editing
        allowEditPermission: fieldPermission.metadata.IsCompound || fieldPermission.metadata.IsCreatable,
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
  item: FieldPermissionItem
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
  fieldPermissionsMap: Record<string, FieldPermissionDefinitionMap>
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
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>
) {
  const newColumns: ColumnWithFilter<PermissionTableTabVisibilityCell, PermissionTableSummaryRow>[] = [
    {
      ...(setColumnFromType('tableLabel', 'text') as any),
      name: 'Object',
      key: 'tableLabel',
      frozen: true,
      width: 300,
      getValue: ({ column, row }) => {
        const data: PermissionTableTabVisibilityCell = row[column.key as keyof PermissionTableTabVisibilityCell] as any;
        return data && `${data.label} (${data.apiName})`;
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
          label: profile.Profile.Name,
          actionType: startCase(actionKey) as 'Available' | 'Visible',
          actionKey,
        })
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
        })
      );
    });
  });
  return newColumns;
}

export function getTabVisibilityRows(
  selectedSObjects: string[],
  tabVisibilityPermissionMap: Record<string, TabVisibilityPermissionDefinitionMap>
) {
  const rows: PermissionTableTabVisibilityCell[] = [];
  orderValues(selectedSObjects).forEach((sobject) => {
    const fieldPermission = tabVisibilityPermissionMap[sobject];

    const currRow: PermissionTableTabVisibilityCell = {
      key: sobject,
      sobject: sobject,
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
  tabVisibilityPermissionsMap: Record<string, TabVisibilityPermissionDefinitionMap>
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
  item: TabVisibilityPermissionItem
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

/**
 *
 * JSX Components
 *
 */

export function getConfirmationModalContent(dirtyObjectCount: number, dirtyFieldCount: number, dirtyTabVisibilityCount: number) {
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
  rows: TRows[]
): TRows[] {
  const newRows = [...rows];
  return newRows.map((row, index) => {
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
    }
    return row;
  });
}

export function updateRowsFromRowAction<TRows extends PermissionTableCellExtended>(
  type: PermissionType,
  checkboxesById: Record<string, BulkActionCheckbox>,
  rows: TRows[]
): TRows[] {
  const newRows = [...rows];
  return newRows.map((row) => {
    row = { ...row };
    row.permissions = { ...row.permissions };
    for (const permissionId in row.permissions) {
      row.permissions = { ...row.permissions, [permissionId]: { ...row.permissions[permissionId] } } as any;
      if (type === 'object') {
        const permission = row.permissions[permissionId] as PermissionTableObjectCellPermission;
        permission.create = checkboxesById['create'].value;
        permission.read = checkboxesById['read'].value;

        permission.edit = checkboxesById['edit'].value;
        permission.delete = checkboxesById['delete'].value;
        permission.viewAll = checkboxesById['viewAll'].value;
        permission.modifyAll = checkboxesById['modifyAll'].value;

        permission.createIsDirty = permission.create !== permission.record.create;
        permission.readIsDirty = permission.read !== permission.record.read;
        permission.editIsDirty = permission.edit !== permission.record.edit;
        permission.deleteIsDirty = permission.delete !== permission.record.delete;
        permission.viewAllIsDirty = permission.viewAll !== permission.record.viewAll;
        permission.modifyAllIsDirty = permission.modifyAll !== permission.record.modifyAll;
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

        permission.createIsDirty = false;
        permission.readIsDirty = false;
        permission.editIsDirty = false;
        permission.deleteIsDirty = false;
        permission.viewAllIsDirty = false;
        permission.modifyAllIsDirty = false;
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
      }
    }
    return row;
  });
}

/**
 * Pinned row selection renderer
 */
export const PinnedSelectAllRendererWrapper = ({ column }: RenderSummaryCellProps<any, unknown>) => {
  const { onColumnAction } = useContext(DataTableGenericContext) as PermissionManagerTableContext;

  function handleSelection(action: 'selectAll' | 'unselectAll' | 'reset') {
    onColumnAction(action, column.key);
  }

  return (
    <div
      className="slds-grid slds-grid_gutter slds-grid_align-center"
      css={css`
        margin-top: 3px;
      `}
    >
      <button
        className="slds-button slds-button_icon slds-button_icon-border"
        aria-hidden="true"
        tabIndex={-1}
        title={`Select all visible rows`}
        onClick={() => handleSelection('selectAll')}
      >
        <Icon type="utility" icon="multi_select_checkbox" className="slds-button__icon slds-button__icon_small" omitContainer />
        <span className="slds-assistive-text">Select all visible rows</span>
      </button>
      <button
        className="slds-button slds-button_icon slds-button_icon-border"
        aria-hidden="true"
        tabIndex={-1}
        title={`Unselect all visible rows`}
        onClick={() => handleSelection('unselectAll')}
      >
        <Icon type="utility" icon="steps" className="slds-button__icon slds-button__icon_small" omitContainer />
        <span className="slds-assistive-text">Unselect all visible rows</span>
      </button>
      <button
        className="slds-button slds-button_icon slds-button_icon-border"
        aria-hidden="true"
        tabIndex={-1}
        title={`Reset visible rows to previous selection`}
        onClick={() => handleSelection('reset')}
      >
        <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_small" omitContainer />
        <span className="slds-assistive-text">Reset visible rows to previous selection</span>
      </button>
    </div>
  );
};

function defaultRowActionCheckboxes(type: PermissionType, allowEditPermission: boolean): BulkActionCheckbox[] {
  if (type === 'object') {
    return [
      { id: 'create', label: 'Create', value: false, disabled: false },
      { id: 'read', label: 'Read', value: false, disabled: false },
      { id: 'edit', label: 'Edit', value: false, disabled: !allowEditPermission },
      { id: 'delete', label: 'Delete', value: false, disabled: false },
      { id: 'viewAll', label: 'View All', value: false, disabled: false },
      { id: 'modifyAll', label: 'Modify All', value: false, disabled: false },
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
  } else {
    throw new Error(`Invalid type ${type}`);
  }
}

export function updateCheckboxDependencies(
  which: PermissionTypes,
  type: PermissionType,
  checkboxesById: Record<string, BulkActionCheckbox>,
  value: boolean
) {
  if (type === 'object') {
    if (which === 'create') {
      checkboxesById['create'] = { ...checkboxesById['create'], value: value };
      if (checkboxesById['create'].value) {
        checkboxesById['read'].value = true;
      }
    } else if (which === 'read') {
      checkboxesById['read'] = { ...checkboxesById['read'], value: value };
      if (!checkboxesById['read'].value) {
        checkboxesById['create'].value = false;
        checkboxesById['edit'].value = false;
        checkboxesById['delete'].value = false;
        checkboxesById['viewAll'].value = false;
        checkboxesById['modifyAll'].value = false;
      }
    } else if (which === 'edit') {
      checkboxesById['edit'] = { ...checkboxesById['edit'], value: value };
      if (checkboxesById['edit'].value) {
        checkboxesById['read'].value = true;
      } else {
        checkboxesById['delete'].value = false;
        checkboxesById['modifyAll'].value = false;
      }
    } else if (which === 'delete') {
      checkboxesById['delete'] = { ...checkboxesById['delete'], value: value };
      if (checkboxesById['delete'].value) {
        checkboxesById['read'].value = true;
        checkboxesById['edit'].value = true;
      } else {
        checkboxesById['modifyAll'].value = false;
      }
    } else if (which === 'viewAll') {
      checkboxesById['viewAll'] = { ...checkboxesById['viewAll'], value: value };
      if (checkboxesById['viewAll'].value) {
        checkboxesById['read'].value = true;
      } else {
        checkboxesById['modifyAll'].value = false;
      }
    } else if (which === 'modifyAll') {
      checkboxesById['modifyAll'] = { ...checkboxesById['modifyAll'], value: value };
      if (checkboxesById['modifyAll'].value) {
        checkboxesById['read'].value = true;
        checkboxesById['edit'].value = true;
        checkboxesById['delete'].value = true;
        checkboxesById['viewAll'].value = true;
      }
    }
  } else if (type === 'field') {
    if (which === 'read') {
      checkboxesById['read'] = { ...checkboxesById['read'], value: value };
      if (!checkboxesById['read'].value) {
        checkboxesById['edit'].value = false;
      }
    } else if (which === 'edit') {
      checkboxesById['edit'] = { ...checkboxesById['edit'], value: value };
      if (checkboxesById['edit'].value) {
        checkboxesById['read'].value = true;
      }
    }
  } else if (type === 'tabVisibility') {
    if (which === 'available') {
      checkboxesById['available'] = { ...checkboxesById['available'], value: value };
      if (!checkboxesById['available'].value) {
        checkboxesById['visible'].value = false;
      }
    } else if (which === 'visible') {
      checkboxesById['visible'] = { ...checkboxesById['visible'], value: value };
      if (checkboxesById['visible'].value) {
        checkboxesById['available'].value = true;
      }
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
export const RowActionRenderer = ({
  column,
  onRowChange,
  row,
}: RenderCellProps<PermissionTableCellExtended, PermissionTableSummaryRow>) => {
  const { type } = useContext(DataTableGenericContext) as PermissionManagerTableContext;
  const popoverRef = useRef<PopoverRef>(null);
  const [checkboxes, setCheckboxes] = useState<BulkActionCheckbox[]>(() => {
    return defaultRowActionCheckboxes(type, 'allowEditPermission' in row ? row?.allowEditPermission : true);
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
      ]);
    } else if (type === 'field') {
      setCheckboxes([checkboxesById['read'], checkboxesById['edit']]);
    } else if (type === 'tabVisibility') {
      setCheckboxes([checkboxesById['available'], checkboxesById['visible']]);
    }
  }

  function handleSave() {
    const checkboxesById = groupByFlat(checkboxes, 'id');
    const [updatedRow] = updateRowsFromRowAction(type, checkboxesById, [row]);
    onRowChange(updatedRow);
  }

  function handleReset() {
    const [updatedRow] = resetRow(type, [row]);
    onRowChange(updatedRow);
  }

  function handlePopoverChange(isOpen: boolean) {
    if (!isOpen) {
      setCheckboxes(defaultRowActionCheckboxes(type, 'allowEditPermission' in row ? row.allowEditPermission : true));
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
        onChange: handleOpen,
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
  const { onFilterRows } = useContext(DataTableGenericContext) as PermissionManagerTableContext;
  return <SearchInput id="column-filter" value="" placeholder="Filter..." onChange={onFilterRows} />;
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
  const [checkboxes, setCheckboxes] = useState(defaultRowActionCheckboxes(type, true));

  const rowCount = useMemo(() => rows.filter((row) => !('canSetPermission' in row) || row.canSetPermission).length, [rows]);

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
      ]);
    } else if (type === 'field') {
      setCheckboxes([checkboxesById['read'], checkboxesById['edit']]);
    } else if (type === 'tabVisibility') {
      setCheckboxes([checkboxesById['available'], checkboxesById['visible']]);
    }
  }

  function handleSave() {
    const checkboxesById = groupByFlat(checkboxes, 'id');
    const updatedRows = updateRowsFromRowAction(type, checkboxesById, rows);
    onBulkAction(updatedRows);
    handleClose();
  }

  function handleOpen() {
    setCheckboxes(defaultRowActionCheckboxes(type, true));
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
      <button className="slds-button slds-button_stretch" onClick={() => handleOpen()}>
        Edit All
      </button>
    </Fragment>
  );
};

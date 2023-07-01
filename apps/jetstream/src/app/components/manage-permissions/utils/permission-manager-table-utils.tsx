import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { getMapOf, orderStringsBy, pluralizeFromNumber } from '@jetstream/shared/utils';
import { MapOf, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
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
import { Fragment, FunctionComponent, useContext, useRef, useState } from 'react';
import { RenderCellProps, RenderSummaryCellProps } from 'react-data-grid';
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
  PermissionTableFieldCell,
  PermissionTableFieldCellPermission,
  PermissionTableObjectCell,
  PermissionTableObjectCellPermission,
  PermissionTableSummaryRow,
  PermissionType,
} from './permission-manager-types';

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

export function resetGridChanges(options: { rows: PermissionTableFieldCell[] | PermissionTableObjectCell[]; type: PermissionType });
export function resetGridChanges({
  rows,
  type,
}: { rows: PermissionTableObjectCell[]; type: 'object' } | { rows: PermissionTableFieldCell[]; type: 'field' }) {
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
  } else {
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
  }
}

export function getDirtyObjectPermissions(dirtyRows: MapOf<DirtyRow<PermissionTableObjectCell>>) {
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

export function getDirtyFieldPermissions(dirtyRows: MapOf<DirtyRow<PermissionTableFieldCell>>) {
  return Object.values(dirtyRows).flatMap(({ row }) =>
    Object.values(row.permissions).filter((permission) => permission.readIsDirty || permission.editIsDirty)
  );
}

export function getObjectColumns(
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  profilesById: MapOf<PermissionSetWithProfileRecord>,
  permissionSetsById: MapOf<PermissionSetNoProfileRecord>
) {
  const newColumns: ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>[] = [
    {
      ...setColumnFromType('tableLabel', 'text'),
      name: 'Object',
      key: 'tableLabel',
      frozen: true,
      width: 300,
      getValue: ({ column, row }) => {
        const data: PermissionTableFieldCell = row[column.key];
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
  selectedProfiles.forEach((profileId) => {
    const profile = profilesById[profileId];
    (['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'] as const).forEach((permissionType, i) => {
      newColumns.push(
        getColumnForProfileOrPermSet({
          isFirstItem: i === 0,
          permissionType: 'object',
          id: profileId,
          type: 'Profile',
          label: profile.Profile.Name,
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

export function getObjectRows(selectedSObjects: string[], objectPermissionMap: MapOf<ObjectPermissionDefinitionMap>) {
  const rows: PermissionTableObjectCell[] = [];
  orderStringsBy(selectedSObjects).forEach((sobject) => {
    const objectPermission = objectPermissionMap[sobject];

    const currRow: PermissionTableObjectCell = {
      key: sobject,
      sobject: sobject,
      apiName: objectPermission.apiName,
      label: objectPermission.label,
      tableLabel: `${objectPermission.label} (${objectPermission.apiName})`,
      // FIXME: are there circumstances where it should be read-only?
      // // formula fields and auto-number fields do not allow editing
      allowEditPermission: true, // objectPermission.metadata.IsCompound || objectPermission.metadata.IsCreatable,
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
  objectPermissionMap: MapOf<ObjectPermissionDefinitionMap>
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
  profilesById: MapOf<PermissionSetWithProfileRecord>,
  permissionSetsById: MapOf<PermissionSetNoProfileRecord>
) {
  const newColumns: ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>[] = [
    {
      ...setColumnFromType('sobject', 'text'),
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

type PermissionTypeColumn<T> = T extends 'object'
  ? ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>
  : T extends 'field'
  ? ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>
  : never;

type PermissionActionType<T> = T extends 'object'
  ? 'Create' | 'Read' | 'Edit' | 'Delete' | 'ViewAll' | 'ModifyAll'
  : T extends 'field'
  ? 'Read' | 'Edit'
  : never;

type PermissionActionAction<T> = T extends 'object' ? ObjectPermissionTypes : T extends 'field' ? FieldPermissionTypes : never;

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
  const column: ColumnWithFilter<PermissionTableObjectCell | PermissionTableFieldCell, PermissionTableSummaryRow> = {
    name: `${label} (${type})`,
    key: `${id}-${actionKey}`,
    width: colWidth,
    filters: ['BOOLEAN_SET'],
    cellClass: (row) => {
      const permission = row.permissions[id];
      if ((actionKey === 'read' && permission.readIsDirty) || (actionKey === 'edit' && permission.editIsDirty)) {
        return 'active-item-yellow-bg';
      }
      return '';
    },
    colSpan: (args) => (args.type === 'HEADER' && isFirstItem ? numItems : undefined),
    renderCell: ({ row, onRowChange }) => {
      const errorMessage = row.permissions[id].errorMessage;
      const value = row.permissions[id][actionKey as any];

      function handleChange(value: boolean) {
        if (permissionType === 'object') {
          const newRow = setObjectValue(actionKey, row as PermissionTableObjectCell, id, value);
          onRowChange(newRow);
        } else {
          const newRow = setFieldValue(actionKey as PermissionActionAction<'field'>, row as PermissionTableFieldCell, id, value);
          onRowChange(newRow);
        }
      }

      const disabled = actionKey === 'edit' && !row.allowEditPermission;

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
          {/* Rendering this custom checkbox was really slow, lot's of DOM elements */}
          {/* <Checkbox
            id={`${row.key}-${id}-${actionKey}`}
            checked={value}
            label="value"
            hideLabel
            readOnly={actionKey === 'edit' && !row.allowEditPermission}
            onChange={handleChange}
          /> */}
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
    getValue: ({ column, row }) => row.permissions[id][actionKey as any],
    summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
    renderSummaryCell: (args) => {
      if (args.row.type === 'HEADING') {
        return <SummaryFilterRenderer columnKey={`${id}-${actionKey}`} label={actionType} />;
      }
      return <PinnedSelectAllRendererWrapper {...args} />;
    },
  };
  return column as PermissionTypeColumn<T>;
}

export function getFieldRows(
  selectedSObjects: string[],
  fieldsByObject: MapOf<string[]>,
  fieldPermissionMap: MapOf<FieldPermissionDefinitionMap>
) {
  const rows: PermissionTableFieldCell[] = [];
  orderStringsBy(selectedSObjects).forEach((sobject) => {
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
  fieldPermissionsMap: MapOf<FieldPermissionDefinitionMap>
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

/**
 *
 * JSX Components
 *
 */

export function getConfirmationModalContent(dirtyObjectCount: number, dirtyFieldCount: number) {
  let output;
  const dirtyObj = (
    <Fragment>
      <strong>
        {dirtyObjectCount} Object {pluralizeFromNumber('Permission', dirtyObjectCount)}
      </strong>
    </Fragment>
  );
  const dirtyField = (
    <Fragment>
      <strong>
        {dirtyFieldCount} Field {pluralizeFromNumber('Permission', dirtyFieldCount)}
      </strong>
    </Fragment>
  );
  if (dirtyObjectCount && dirtyFieldCount) {
    output = (
      <Fragment>
        {dirtyObj} and {dirtyField}
      </Fragment>
    );
  } else if (dirtyObjectCount) {
    output = dirtyObj;
  } else {
    output = dirtyField;
  }
  return (
    <div>
      <p>You have made changes to {output}.</p>
    </div>
  );
}

/**
 * Performs bulk action against a column
 */
export function updateRowsFromColumnAction<TRows extends PermissionTableObjectCell | PermissionTableFieldCell>(
  type: PermissionType,
  action: 'selectAll' | 'unselectAll' | 'reset',
  which: ObjectPermissionTypes | FieldPermissionTypes,
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
    } else {
      const permission = row.permissions[id] as PermissionTableFieldCellPermission;
      if (which === 'read') {
        newValue = action === 'reset' ? permission.record.read : newValue;
        permission.read = newValue;
        setFieldDependencies(permission, newValue, [], ['edit']);
      } else if (row.allowEditPermission) {
        newValue = action === 'reset' ? permission.record.edit : newValue;
        permission.edit = newValue;
        setFieldDependencies(permission, newValue, ['read'], []);
      }
    }
    return row;
  });
}

export function updateRowsFromRowAction<TRows extends PermissionTableObjectCell | PermissionTableFieldCell>(
  type: PermissionType,
  checkboxesById: MapOf<BulkActionCheckbox>,
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
        // TODO: can all the fields below always be set?
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
      } else {
        const permission = row.permissions[permissionId] as PermissionTableFieldCellPermission;
        permission.read = checkboxesById['read'].value;
        if (row.allowEditPermission) {
          permission.edit = checkboxesById['edit'].value;
        }
        permission.readIsDirty = permission.read !== permission.record.read;
        permission.editIsDirty = permission.edit !== permission.record.edit;
      }
    }
    return row;
  });
}

/**
 * Pinned row selection renderer
 */
export const PinnedSelectAllRendererWrapper: FunctionComponent<RenderSummaryCellProps<any, unknown>> = ({ column }) => {
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
  } else {
    return [
      { id: 'read', label: 'Read', value: false, disabled: false },
      { id: 'edit', label: 'Edit', value: false, disabled: !allowEditPermission },
    ];
  }
}

export function updateCheckboxDependencies(
  which: ObjectPermissionTypes,
  type: PermissionType,
  checkboxesById: MapOf<BulkActionCheckbox>,
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
  } else {
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
  }
}

function getDirtyCount({ row, type }: { row: PermissionTableObjectCell | PermissionTableFieldCell; type: PermissionType });
function getDirtyCount({
  row,
  type,
}: { row: PermissionTableObjectCell; type: 'object' } | { row: PermissionTableFieldCell; type: 'field' }): number {
  let dirtyCount = 0;
  if (type === 'object') {
    // const data: PermissionTableObjectCell = rowNode.data;
    dirtyCount = Object.values(row.permissions).reduce((output, permission) => {
      output += permission.createIsDirty ? 1 : 0;
      output += permission.readIsDirty ? 1 : 0;
      output += permission.editIsDirty ? 1 : 0;
      output += permission.deleteIsDirty ? 1 : 0;
      output += permission.viewAllIsDirty ? 1 : 0;
      output += permission.modifyAllIsDirty ? 1 : 0;
      return output;
    }, 0);
  } else {
    dirtyCount = Object.values(row.permissions).reduce((output, permission) => {
      output += permission.readIsDirty ? 1 : 0;
      output += permission.editIsDirty ? 1 : 0;
      return output;
    }, 0);
  }
  return dirtyCount;
}

/**
 * Row action renderer
 *
 * This component provides a popover that the user can open to make changes that apply to an entire row
 */
export const RowActionRenderer: FunctionComponent<RenderCellProps<PermissionTableObjectCell | PermissionTableFieldCell>> = ({
  column,
  onRowChange,
  row,
}) => {
  const { type } = useContext(DataTableGenericContext) as PermissionManagerTableContext;
  const popoverRef = useRef<PopoverRef>(null);
  const [dirtyItemCount, setDirtyItemCount] = useState(0);
  const [checkboxes, setCheckboxes] = useState<BulkActionCheckbox[]>(defaultRowActionCheckboxes(type, row?.allowEditPermission));

  /**
   * Set all dependencies when fields change
   */
  function handleChange(which: ObjectPermissionTypes, value: boolean) {
    const checkboxesById = getMapOf(checkboxes, 'id');
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
    } else {
      setCheckboxes([checkboxesById['read'], checkboxesById['edit']]);
    }
  }

  function handleSave() {
    const checkboxesById = getMapOf(checkboxes, 'id');
    const [updatedRow] = updateRowsFromRowAction(type, checkboxesById, [row]);
    onRowChange(updatedRow);
    setDirtyItemCount(getDirtyCount({ row, type }));
  }

  // TODO: honor which rows to apply to
  function handleReset() {
    setDirtyItemCount(getDirtyCount({ row, type }));
  }

  function handlePopoverChange(isOpen: boolean) {
    if (isOpen) {
      setDirtyItemCount(getDirtyCount({ row, type }));
    } else {
      setCheckboxes(defaultRowActionCheckboxes(type, row.allowEditPermission));
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
          <button className="slds-button slds-button_neutral" onClick={handleReset} disabled={dirtyItemCount === 0}>
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

  /**
   * Set all dependencies when fields change
   */
  function handleChange(which: ObjectPermissionTypes, value: boolean) {
    const checkboxesById = getMapOf(checkboxes, 'id');
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
    } else {
      setCheckboxes([checkboxesById['read'], checkboxesById['edit']]);
    }
  }

  function handleSave() {
    const checkboxesById = getMapOf(checkboxes, 'id');
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
              <button className="slds-button slds-button_brand" onClick={handleSave} disabled={rows.length === 0}>
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
                {formatNumber(rows.length)} {pluralizeFromNumber(type, rows.length)}
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

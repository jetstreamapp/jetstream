/** @jsx jsx */
import {
  CellClassParams,
  CellKeyPressEvent,
  ColDef,
  ColGroupDef,
  GridApi,
  ICellRendererParams,
  RowNode,
  SuppressKeyboardEventParams,
  ValueGetterParams,
  ValueSetterParams,
} from '@ag-grid-community/core';
import { css, jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { formatNumber, isArrowKey, isEnterOrSpace, isTabKey } from '@jetstream/shared/ui-utils';
import { getMapOf, orderStringsBy, pluralizeFromNumber } from '@jetstream/shared/utils';
import { MapOf, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
import { Checkbox, Grid, Icon, Input, Modal, Popover, Tooltip } from '@jetstream/ui';
import { isFunction } from 'lodash';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import {
  BulkActionCheckbox,
  DirtyRow,
  FieldPermissionDefinitionMap,
  FieldPermissionItem,
  FieldPermissionTypes,
  ObjectPermissionDefinitionMap,
  ObjectPermissionItem,
  ObjectPermissionTypes,
  PermissionTableCell,
  PermissionTableFieldCell,
  PermissionTableFieldCellPermission,
  PermissionTableObjectCell,
  PermissionTableObjectCellPermission,
  PermissionType,
} from './permission-manager-types';

function suppressKeyboardEventOnPinnedInput({ node, event }: SuppressKeyboardEventParams) {
  return node.isRowPinned() && !isArrowKey(event as any) && !isTabKey(event as any);
}

export function getObjectValue(which: ObjectPermissionTypes) {
  return ({ node, data, colDef }: ValueGetterParams) => {
    if (node.isRowPinned()) {
      return;
    }
    return (data as PermissionTableObjectCell).permissions?.[colDef.field]?.[which] || false;
  };
}

/**
 * This provides enter/space to toggle field selection
 */
export function handleOnCellPressed({ event, node, column, colDef, value, context }: CellKeyPressEvent) {
  if (colDef.cellRenderer === 'booleanEditableRenderer' && isEnterOrSpace(event as any)) {
    event.preventDefault();
    event.stopPropagation();
    if (isFunction(context.isReadOnly) && !context.isReadOnly({ value, node, column, colDef })) {
      node.setDataValue(column.getColId(), !value);
    }
  }
}

export function setObjectValue(which: ObjectPermissionTypes) {
  return ({ node, colDef, newValue }: ValueSetterParams) => {
    if (node.isRowPinned()) {
      return;
    }
    const data: PermissionTableObjectCell = node.data;
    const permission = data.permissions[colDef.field];
    if (which === 'create') {
      permission.create = newValue;
      setObjectDependencies(permission, newValue, ['read'], []);
    } else if (which === 'read') {
      permission.read = newValue;
      setObjectDependencies(permission, newValue, [], ['create', 'edit', 'delete', 'viewAll', 'modifyAll']);
    } else if (which === 'edit') {
      permission.edit = newValue;
      setObjectDependencies(permission, newValue, ['read'], ['delete', 'modifyAll']);
    } else if (which === 'delete') {
      permission.delete = newValue;
      setObjectDependencies(permission, newValue, ['read', 'edit'], ['modifyAll']);
    } else if (which === 'viewAll') {
      permission.viewAll = newValue;
      setObjectDependencies(permission, newValue, ['read'], ['modifyAll']);
    } else if (which === 'modifyAll') {
      permission.modifyAll = newValue;
      setObjectDependencies(permission, newValue, ['read', 'edit', 'delete', 'viewAll'], []);
    }
    return true;
  };
}

export function getFieldValue(which: ObjectPermissionTypes | FieldPermissionTypes) {
  return ({ node, data, colDef }: ValueGetterParams) => {
    if (node.isRowPinned()) {
      return;
    }
    return (data as PermissionTableFieldCell).permissions?.[colDef.field]?.[which] || false;
  };
}

export function setFieldValue(which: FieldPermissionTypes) {
  return ({ node, colDef, newValue }: ValueSetterParams) => {
    if (node.isRowPinned()) {
      return;
    }
    const data: PermissionTableFieldCell = node.data;
    const permission = data.permissions[colDef.field];
    if (which === 'read') {
      permission.read = newValue;
      setFieldDependencies(permission, newValue, [], ['edit']);
    } else if (data.allowEditPermission) {
      permission.edit = newValue;
      setFieldDependencies(permission, newValue, ['read'], []);
    }
    return true;
  };
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

export function getObjectDirtyValue(which: ObjectPermissionTypes) {
  return ({ node, colDef }: CellClassParams) => {
    if (node.isRowPinned()) {
      return;
    }
    const data: PermissionTableObjectCell = node.data;
    const permission = data.permissions[colDef.field];
    return (
      (which === 'create' && permission.createIsDirty) ||
      (which === 'read' && permission.readIsDirty) ||
      (which === 'edit' && permission.editIsDirty) ||
      (which === 'delete' && permission.deleteIsDirty) ||
      (which === 'viewAll' && permission.viewAllIsDirty) ||
      (which === 'modifyAll' && permission.modifyAllIsDirty)
    );
  };
}

export function getFieldDirtyValue(which: FieldPermissionTypes) {
  return ({ node, colDef }: CellClassParams) => {
    if (node.isRowPinned()) {
      return;
    }
    const data: PermissionTableFieldCell = node.data;
    const permission = data.permissions[colDef.field];
    return (which === 'read' && permission.readIsDirty) || (which === 'edit' && permission.editIsDirty);
  };
}

export function isFullWidthCell(rowNode: RowNode) {
  return rowNode.data.fullWidthRow;
}

export function resetGridChanges(gridApi: GridApi, type: PermissionType) {
  const itemsToUpdate = [];
  gridApi.forEachNodeAfterFilterAndSort((rowNode, index) => {
    if (type === 'object') {
      const data: PermissionTableObjectCell = rowNode.data;
      if (!data.fullWidthRow && !rowNode.isRowPinned()) {
        const dirtyPermissions = Object.values(data.permissions).filter(
          (permission) =>
            permission.createIsDirty ||
            permission.readIsDirty ||
            permission.editIsDirty ||
            permission.deleteIsDirty ||
            permission.viewAllIsDirty ||
            permission.modifyAllIsDirty
        );
        if (dirtyPermissions.length) {
          dirtyPermissions.forEach((row) => {
            row.create = row.createIsDirty ? !row.create : row.create;
            row.read = row.readIsDirty ? !row.read : row.read;
            row.edit = row.editIsDirty ? !row.edit : row.edit;
            row.delete = row.deleteIsDirty ? !row.delete : row.delete;
            row.viewAll = row.viewAllIsDirty ? !row.viewAll : row.viewAll;
            row.modifyAll = row.modifyAllIsDirty ? !row.modifyAll : row.modifyAll;
            row.createIsDirty = false;
            row.readIsDirty = false;
            row.editIsDirty = false;
            row.deleteIsDirty = false;
            row.viewAllIsDirty = false;
            row.modifyAllIsDirty = false;
          });
          itemsToUpdate.push(data);
        }
      }
    } else {
      const data: PermissionTableFieldCell = rowNode.data;
      if (!data.fullWidthRow && !rowNode.isRowPinned()) {
        const dirtyPermissions = Object.values(data.permissions).filter((permission) => permission.readIsDirty || permission.editIsDirty);
        if (dirtyPermissions.length) {
          dirtyPermissions.forEach((row) => {
            row.read = row.readIsDirty ? !row.read : row.read;
            row.edit = row.editIsDirty ? !row.edit : row.edit;
            row.readIsDirty = false;
            row.editIsDirty = false;
          });
          itemsToUpdate.push(data);
        }
      }
    }
  });
  if (itemsToUpdate.length) {
    const transactionResult = gridApi.applyTransaction({ update: itemsToUpdate });
    logger.log({ transactionResult });
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

export function getObjectPermissionsColumn(which: ObjectPermissionTypes, id) {
  let headerName = 'Create';
  switch (which) {
    case 'create':
      headerName = 'Create';
      break;
    case 'read':
      headerName = 'Read';
      break;
    case 'edit':
      headerName = 'Edit';
      break;
    case 'delete':
      headerName = 'Delete';
      break;
    case 'viewAll':
      headerName = 'View All';
      break;
    case 'modifyAll':
      headerName = 'Modify All';
      break;
    default:
      break;
  }
  const colDef: ColDef = {
    headerName,
    colId: `${id}-${which}`,
    field: id,
    filter: 'booleanFilterRenderer',
    valueGetter: getObjectValue(which),
    valueSetter: setObjectValue(which),
    initialWidth: 125,
    cellClassRules: {
      'active-item-yellow-bg': getObjectDirtyValue(which),
    },
    cellRenderer: 'booleanEditableRenderer',
    pinnedRowCellRenderer: 'pinnedSelectAllRenderer',
  };
  return colDef;
}

export function getFieldPermissionsColumn(which: FieldPermissionTypes, id) {
  const colDef: ColDef = {
    headerName: which === 'read' ? 'Read Access' : 'Edit Access',
    colId: `${id}-${which}`,
    field: id,
    filter: 'booleanFilterRenderer',
    valueGetter: getFieldValue(which),
    valueSetter: setFieldValue(which),
    initialWidth: 135,
    cellClassRules: {
      'active-item-yellow-bg': getFieldDirtyValue(which),
    },
    cellRenderer: 'booleanEditableRenderer',
    pinnedRowCellRenderer: 'pinnedSelectAllRenderer',
  };
  return colDef;
}

export function getObjectColumns(
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  profilesById: MapOf<PermissionSetWithProfileRecord>,
  permissionSetsById: MapOf<PermissionSetNoProfileRecord>
) {
  const newColumns: (ColDef | ColGroupDef)[] = [
    {
      headerName: 'Object',
      field: 'label',
      lockPosition: true,
      pinned: true,
      filter: 'basicTextFilterRenderer',
      pinnedRowCellRenderer: 'pinnedInputFilter',
      suppressMenu: true,
      suppressKeyboardEvent: suppressKeyboardEventOnPinnedInput,
      filterValueGetter: (params) => {
        const data: PermissionTableFieldCell = params.data;
        return `${data.label} (${data.apiName})`;
      },
      valueFormatter: (params) => {
        const data: PermissionTableObjectCell = params.data;
        return `${data.label} (${data.apiName})`;
      },
    },
    {
      cellRendererSelector: ({ node }) => ({ component: node.isRowPinned() ? 'bulkActionRenderer' : 'rowActionRenderer' }),
      width: 100,
      filter: false,
      sortable: false,
      resizable: false,
      pinned: true,
      lockPosition: true,
      cellStyle: { overflow: 'visible' },
    },
  ];
  // Create column groups for profiles
  selectedProfiles.forEach((profileId) => {
    const profile = profilesById[profileId];
    const currColumn: ColGroupDef = {
      headerName: `${profile.Profile.Name} (Profile)`,
      groupId: profileId,
      openByDefault: true,
      marryChildren: true,
      children: [
        getObjectPermissionsColumn('read', profileId),
        getObjectPermissionsColumn('create', profileId),
        getObjectPermissionsColumn('edit', profileId),
        getObjectPermissionsColumn('delete', profileId),
        getObjectPermissionsColumn('viewAll', profileId),
        getObjectPermissionsColumn('modifyAll', profileId),
      ],
    };
    newColumns.push(currColumn);
  });
  // Create column groups for permission sets
  selectedPermissionSets.forEach((permissionSetId) => {
    const permissionSet = permissionSetsById[permissionSetId];
    const currColumn: ColGroupDef = {
      headerName: `${permissionSet.Name} (Permission Set)`,
      groupId: permissionSetId,
      openByDefault: true,
      marryChildren: true,
      children: [
        getObjectPermissionsColumn('read', permissionSetId),
        getObjectPermissionsColumn('create', permissionSetId),
        getObjectPermissionsColumn('edit', permissionSetId),
        getObjectPermissionsColumn('delete', permissionSetId),
        getObjectPermissionsColumn('viewAll', permissionSetId),
        getObjectPermissionsColumn('modifyAll', permissionSetId),
      ],
    };
    newColumns.push(currColumn);
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
  const newColumns: (ColDef | ColGroupDef)[] = [
    {
      headerName: 'Field',
      field: 'label',
      lockPosition: true,
      pinned: true,
      filter: 'basicTextFilterRenderer',
      pinnedRowCellRenderer: 'pinnedInputFilter',
      suppressMenu: true,
      filterValueGetter: (params) => {
        const data: PermissionTableFieldCell = params.data;
        return `${data.sobject} ${data.label} (${data.apiName})`;
      },
      valueFormatter: (params) => {
        const data: PermissionTableFieldCell = params.data;
        return `${data.label} (${data.apiName})`;
      },
      suppressKeyboardEvent: suppressKeyboardEventOnPinnedInput,
    },
    {
      cellRendererSelector: ({ node }) => ({ component: node.isRowPinned() ? 'bulkActionRenderer' : 'rowActionRenderer' }),
      width: 100,
      filter: false,
      sortable: false,
      resizable: false,
      pinned: true,
      lockPosition: true,
      cellStyle: { overflow: 'visible' },
    },
  ];
  // Create column groups for profiles
  selectedProfiles.forEach((profileId) => {
    const profile = profilesById[profileId];
    const currColumn: ColGroupDef = {
      headerName: `${profile.Profile.Name} (Profile)`,
      groupId: profileId,
      openByDefault: true,
      marryChildren: true,
      // headerGroupComponent // TODO: show header name on two rows and add bg color
      children: [getFieldPermissionsColumn('read', profileId), getFieldPermissionsColumn('edit', profileId)],
    };
    newColumns.push(currColumn);
  });
  // Create column groups for permission sets
  selectedPermissionSets.forEach((permissionSetId) => {
    const permissionSet = permissionSetsById[permissionSetId];
    const currColumn: ColGroupDef = {
      headerName: `${permissionSet.Name} (Permission Set)`,
      groupId: permissionSetId,
      openByDefault: true,
      marryChildren: true,
      children: [getFieldPermissionsColumn('read', permissionSetId), getFieldPermissionsColumn('edit', permissionSetId)],
    };
    newColumns.push(currColumn);
  });
  return newColumns;
}

export function getFieldRows(
  selectedSObjects: string[],
  fieldsByObject: MapOf<string[]>,
  fieldPermissionMap: MapOf<FieldPermissionDefinitionMap>
) {
  const rows: PermissionTableFieldCell[] = [];
  orderStringsBy(selectedSObjects).forEach((sobject) => {
    // full width row
    rows.push({
      key: `${sobject}-fullWidth`,
      fullWidthRow: true,
      sobject: sobject,
      apiName: '',
      label: sobject,
      type: null,
      allowEditPermission: false,
      permissions: {},
    });

    fieldsByObject[sobject]?.forEach((fieldKey) => {
      const fieldPermission = fieldPermissionMap[fieldKey];

      const currRow: PermissionTableFieldCell = {
        key: fieldKey,
        sobject: sobject,
        apiName: fieldPermission.apiName,
        label: fieldPermission.label,
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
    if (row.fullWidthRow) {
      return row;
    }
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
 * "Label" column filter
 */
export const PinnedLabelInputFilter: FunctionComponent<ICellRendererParams> = ({ api, node, column, colDef }) => {
  const [value, setValue] = useState('');
  useEffect(() => {
    api.getFilterInstance('label', (labelFilter) => {
      labelFilter.setModel({ value });
      api.onFilterChanged();
    });
  }, [value]);

  return (
    <Input clearButton={!!value} onClear={() => setValue('')}>
      <input className="slds-input" placeholder="Filter..." value={value} onChange={(event) => setValue(event.target.value)} />
    </Input>
  );
};

/**
 * Pinned row selection rendere
 */
export const PinnedSelectAllRendererWrapper = (type: PermissionType): FunctionComponent<ICellRendererParams> => ({
  api,
  node,
  column,
  colDef,
  context,
}) => {
  function handleSelection(action: 'selectAll' | 'unselectAll' | 'reset') {
    const [id, which] = colDef.colId.split('-');
    const itemsToUpdate: any[] = [];
    api.forEachNodeAfterFilter((rowNode, index) => {
      if (!rowNode.isRowPinned() && !rowNode.isFullWidthCell()) {
        let newValue = action === 'selectAll';

        if (type === 'object') {
          const data: PermissionTableObjectCell = rowNode.data;
          const permission = data.permissions[id];
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
          itemsToUpdate.push(data);
        } else {
          const data: PermissionTableFieldCell = rowNode.data;
          const permission = data.permissions[id];
          if (which === 'read') {
            newValue = action === 'reset' ? permission.record.read : newValue;
            permission.read = newValue;
            setFieldDependencies(permission, newValue, [], ['edit']);
          } else if (data.allowEditPermission) {
            newValue = action === 'reset' ? permission.record.edit : newValue;
            permission.edit = newValue;
            setFieldDependencies(permission, newValue, ['read'], []);
          }
          itemsToUpdate.push(data);
        }
      }
    });
    const transactionResult = api.applyTransaction({ update: itemsToUpdate });
    logger.log({ transactionResult });
    if (isFunction(context.onBulkUpdate)) {
      context.onBulkUpdate(itemsToUpdate);
    }
  }

  return (
    <div className="slds-grid slds-grid_gutter slds-grid_align-center">
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

export function ErrorTooltipRenderer({ node, column, colDef, context }: ICellRendererParams) {
  const colId = column.getColId();
  const data: PermissionTableCell = node.data;
  const permission = data.permissions[colDef.field];
  if (node.isRowPinned() || node.isFullWidthCell() || !permission.errorMessage) {
    return undefined;
  }
  return (
    <Tooltip
      id={`tooltip-${node.id}-${colId}`}
      content={
        <div>
          <strong>{permission.errorMessage}</strong>
        </div>
      }
    >
      <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small" />
    </Tooltip>
  );
}

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

function updateCheckboxDependencies(
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

function handleRowPermissionUpdate(
  rowNode: RowNode,
  type: PermissionType,
  checkboxesById: MapOf<BulkActionCheckbox>,
  arrayToUpdate: any[]
) {
  if (type === 'object') {
    const data: PermissionTableObjectCell = rowNode.data;
    if (!data.fullWidthRow && !rowNode.isRowPinned()) {
      Object.values(data.permissions).forEach((permission) => {
        permission.create = checkboxesById['create'].value;
        permission.read = checkboxesById['read'].value;
        if (data.allowEditPermission) {
          permission.edit = checkboxesById['edit'].value;
        }
        permission.delete = checkboxesById['delete'].value;
        permission.viewAll = checkboxesById['viewAll'].value;
        permission.modifyAll = checkboxesById['modifyAll'].value;
        permission.createIsDirty = permission.create !== permission.record.create;
        permission.readIsDirty = permission.read !== permission.record.read;
        permission.editIsDirty = permission.edit !== permission.record.edit;
        permission.deleteIsDirty = permission.delete !== permission.record.delete;
        permission.viewAllIsDirty = permission.viewAll !== permission.record.viewAll;
        permission.modifyAllIsDirty = permission.modifyAll !== permission.record.modifyAll;
      });
      arrayToUpdate.push(data);
    }
  } else {
    const data: PermissionTableFieldCell = rowNode.data;
    if (!data.fullWidthRow && !rowNode.isRowPinned()) {
      Object.values(data.permissions).forEach((permission) => {
        permission.read = checkboxesById['read'].value;
        if (data.allowEditPermission) {
          permission.edit = checkboxesById['edit'].value;
        }
        permission.readIsDirty = permission.read !== permission.record.read;
        permission.editIsDirty = permission.edit !== permission.record.edit;
      });
      arrayToUpdate.push(data);
    }
  }
}

function handleRowPermissionReset(rowNode: RowNode, type: PermissionType, arrayToUpdate: any[]) {
  if (type === 'object') {
    const data: PermissionTableObjectCell = rowNode.data;
    if (!data.fullWidthRow && !rowNode.isRowPinned()) {
      Object.values(data.permissions).forEach((permission) => {
        if (permission.createIsDirty) {
          permission.create = !permission.create;
          permission.createIsDirty = false;
        }
        if (permission.readIsDirty) {
          permission.read = !permission.read;
          permission.readIsDirty = false;
        }
        if (permission.editIsDirty) {
          permission.edit = !permission.edit;
          permission.editIsDirty = false;
        }
        if (permission.deleteIsDirty) {
          permission.delete = !permission.delete;
          permission.deleteIsDirty = false;
        }
        if (permission.viewAllIsDirty) {
          permission.viewAll = !permission.viewAll;
          permission.viewAllIsDirty = false;
        }
        if (permission.modifyAllIsDirty) {
          permission.modifyAll = !permission.modifyAll;
          permission.modifyAllIsDirty = false;
        }
      });
      arrayToUpdate.push(data);
    }
  } else {
    const data: PermissionTableFieldCell = rowNode.data;
    if (!data.fullWidthRow && !rowNode.isRowPinned()) {
      Object.values(data.permissions).forEach((permission) => {
        if (permission.readIsDirty) {
          permission.read = !permission.read;
          permission.readIsDirty = false;
        }
        if (permission.editIsDirty) {
          permission.edit = !permission.edit;
          permission.editIsDirty = false;
        }
      });
      arrayToUpdate.push(data);
    }
  }
}

function getDirtyCount(rowNode: RowNode, type: PermissionType): number {
  let dirtyCount = 0;
  if (type === 'object') {
    const data: PermissionTableObjectCell = rowNode.data;
    if (!data.fullWidthRow && !rowNode.isRowPinned()) {
      dirtyCount = Object.values(data.permissions).reduce((output, permission) => {
        output += permission.createIsDirty ? 1 : 0;
        output += permission.readIsDirty ? 1 : 0;
        output += permission.editIsDirty ? 1 : 0;
        output += permission.deleteIsDirty ? 1 : 0;
        output += permission.viewAllIsDirty ? 1 : 0;
        output += permission.modifyAllIsDirty ? 1 : 0;
        return output;
      }, 0);
    }
  } else {
    const data: PermissionTableFieldCell = rowNode.data;
    if (!data.fullWidthRow && !rowNode.isRowPinned()) {
      dirtyCount = Object.values(data.permissions).reduce((output, permission) => {
        output += permission.readIsDirty ? 1 : 0;
        output += permission.editIsDirty ? 1 : 0;
        return output;
      }, 0);
    }
  }
  return dirtyCount;
}

/**
 * Row action renderer
 *
 * This component provides a popover that the user can open to make changes that apply to an entire row
 */
export const RowActionRenderer: FunctionComponent<ICellRendererParams> = ({ node, context, api }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dirtyItemCount, setDirtyItemCount] = useState(0);

  const [description] = useState(() => {
    const { profiles, permissionSets } = api
      .getColumnDefs()
      .filter((item) => !!item.headerName)
      .reduce(
        (output, item: ColGroupDef) => {
          const name = item.headerName?.toLowerCase() || '';
          if (name.endsWith('(profile)')) {
            output.profiles++;
          } else if (name.endsWith('(permission set)')) {
            output.permissionSets++;
          }
          return output;
        },
        { profiles: 0, permissionSets: 0 }
      );
    if (profiles && permissionSets) {
      return `This change will apply to ${formatNumber(profiles)} ${pluralizeFromNumber('profile', profiles)} and ${formatNumber(
        permissionSets
      )} ${pluralizeFromNumber('permission set', permissionSets)}`;
    } else if (profiles) {
      return `This change will apply to ${formatNumber(profiles)} ${pluralizeFromNumber('profile', profiles)}`;
    } else if (permissionSets) {
      return `This change will apply to ${formatNumber(permissionSets)} ${pluralizeFromNumber('permission set', permissionSets)}`;
    } else {
      return `This change will apply to all selected profiles and permission sets`;
    }
  });

  const [checkboxes, setCheckboxes] = useState<BulkActionCheckbox[]>(
    defaultRowActionCheckboxes(context.type, node.data.allowEditPermission)
  );

  /**
   * Set all dependencies when fields change
   */
  function handleChange(which: ObjectPermissionTypes, value: boolean) {
    const checkboxesById = getMapOf(checkboxes, 'id');
    updateCheckboxDependencies(which, context.type, checkboxesById, value);
    if (context.type === 'object') {
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
    const itemsToUpdate = [];

    handleRowPermissionUpdate(node, context.type, checkboxesById, itemsToUpdate);

    const transactionResult = api.applyTransaction({ update: itemsToUpdate });
    logger.log({ transactionResult });
    if (isFunction(context.onBulkUpdate)) {
      context.onBulkUpdate(itemsToUpdate);
    }
    setDirtyItemCount(getDirtyCount(node, context.type));
  }

  function handleReset() {
    const itemsToUpdate = [];
    handleRowPermissionReset(node, context.type, itemsToUpdate);
    const transactionResult = api.applyTransaction({ update: itemsToUpdate });
    logger.log({ transactionResult });
    if (isFunction(context.onBulkUpdate)) {
      context.onBulkUpdate(itemsToUpdate);
    }
    setDirtyItemCount(getDirtyCount(node, context.type));
  }

  function handleOpen() {
    setIsOpen(true);
    setDirtyItemCount(getDirtyCount(node, context.type));
  }

  function handleClose() {
    setCheckboxes(defaultRowActionCheckboxes(context.type, node.data.allowEditPermission));
    setIsOpen(false);
  }

  if (node.isFullWidthCell()) {
    return null;
  }

  return (
    <div
      css={css`
        /* Ensure that ag-grid's CSS does not get inherited in popover */
        white-space: normal;
        cursor: initial;
        -webkit-font-smoothing: initial;
      `}
    >
      <Popover
        size={context.type === 'object' ? 'large' : 'medium'}
        isOpen={isOpen}
        onOpen={handleOpen}
        onClose={handleClose}
        placement="top"
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
            <p className="slds-text-align_center slds-m-bottom_small">{description}</p>
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
      >
        <button className="slds-button">Edit Row</button>
      </Popover>
    </div>
  );
};

/**
 * Bulk Row action renderer
 *
 * This component provides a modal that the user can open to make changes that apply to an entire visible table
 */
export const BulkActionRenderer: FunctionComponent<ICellRendererParams> = ({ node, context, api }) => {
  const [isOpen, setIsOpen] = useState(false);

  const [checkboxes, setCheckboxes] = useState(defaultRowActionCheckboxes(context.type, true));
  const [visibleRows, setVisibleRows] = useState(getNumRows);

  function getNumRows() {
    let counter = 0;
    api.forEachNodeAfterFilterAndSort((rowNode) => {
      if (!rowNode.isFullWidthCell() && !rowNode.isRowPinned()) {
        counter++;
      }
    });
    return counter;
  }

  /**
   * Set all dependencies when fields change
   */
  function handleChange(which: ObjectPermissionTypes, value: boolean) {
    const checkboxesById = getMapOf(checkboxes, 'id');
    updateCheckboxDependencies(which, context.type, checkboxesById, value);
    if (context.type === 'object') {
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
    const itemsToUpdate = [];
    api.forEachNodeAfterFilterAndSort((rowNode, index) => {
      handleRowPermissionUpdate(rowNode, context.type, checkboxesById, itemsToUpdate);
    });

    const transactionResult = api.applyTransaction({ update: itemsToUpdate });
    logger.log({ transactionResult });
    if (isFunction(context.onBulkUpdate)) {
      context.onBulkUpdate(itemsToUpdate);
    }

    handleClose();
  }

  function handleOpen() {
    setVisibleRows(getNumRows());
    setCheckboxes(defaultRowActionCheckboxes(context.type, true));
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
  }

  if (node.isFullWidthCell()) {
    return null;
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
              <button className="slds-button slds-button_brand" onClick={handleSave} disabled={visibleRows === 0}>
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
              This change will apply to <strong> {formatNumber(visibleRows)} visible rows</strong> and all selected profiles and permission
              sets
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
      <button className="slds-button" onClick={() => handleOpen()}>
        Edit All
      </button>
    </Fragment>
  );
};

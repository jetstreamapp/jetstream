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
  setColumnFromType,
  Tooltip,
} from '@jetstream/ui';
import { Fragment, FunctionComponent, useContext, useRef, useState } from 'react';
import { FormatterProps, SummaryFormatterProps } from 'react-data-grid';
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
      // pinned: true,
      // lockPinned: true,
      // lockPosition: true,
      // lockVisible: true,
      // filter: BasicTextFilterRenderer,
      // cellRendererSelector: getCellRenderer(null, PinnedSelectAllRendererWrapper('object')),
      // suppressMenu: true,
      // suppressKeyboardEvent: suppressKeyboardEventOnPinnedInput,
      getValue: ({ column, row }) => {
        const data: PermissionTableFieldCell = row[column.key];
        return data && `${data.label} (${data.apiName})`;
      },
      // valueFormatter: (params) => {
      //   const data: PermissionTableObjectCell = params.data;
      //   return data && `${data.label} (${data.apiName})`;
      // },
    },
    {
      name: '',
      key: '_ROW_ACTION',
      // cellRendererSelector: ({ node }: ICellRendererParams) => {
      //   if (node.group) {
      //     return null;
      //   }
      //   return { component: node.isRowPinned() ? BulkActionRenderer : RowActionRenderer };
      // },
      width: 100,
      // filter: false,
      // sortable: false,
      // suppressMenu: true,
      // resizable: false,
      // pinned: true,
      frozen: true,
      // lockPinned: true,
      // lockPosition: true,
      // lockVisible: true,
      // cellStyle: { overflow: 'visible' },
    },
    // {
    //   name: '',
    //   key: '_ROW_ACTION',
    //   // cellRendererSelector: ({ node }) => ({ component: node.isRowPinned() ? BulkActionRenderer : RowActionRenderer }),
    //   width: 100,
    //   // filter: false,
    //   // sortable: false,
    //   // suppressMenu: true,
    //   // resizable: false,
    //   // pinned: true,
    //   frozen: true,
    //   // lockPinned: true,
    //   // lockPosition: true,
    //   // lockVisible: true,
    //   // cellStyle: { overflow: 'visible' },
    // },
  ];
  // Create column groups for profiles
  selectedProfiles.forEach((profileId) => {
    const profile = profilesById[profileId];
    // TODO:
    const currColumn: ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow> = {
      name: `${profile.Profile.Name} (Profile)`,
      key: profileId,
      colSpan: (args) => (args.type === 'HEADER' ? 2 : 1),
      // openByDefault: true,
      // marryChildren: true,
      // children: [
      //   getObjectPermissionsColumn('read', profileId),
      //   getObjectPermissionsColumn('create', profileId),
      //   getObjectPermissionsColumn('edit', profileId),
      //   getObjectPermissionsColumn('delete', profileId),
      //   getObjectPermissionsColumn('viewAll', profileId),
      //   getObjectPermissionsColumn('modifyAll', profileId),
      // ],
    };
    newColumns.push(currColumn);
  });
  // Create column groups for permission sets
  selectedPermissionSets.forEach((permissionSetId) => {
    const permissionSet = permissionSetsById[permissionSetId];
    const currColumn: ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow> = {
      name: `${permissionSet.Name} (Permission Set)`,
      key: permissionSetId,
      colSpan: (args) => (args.type === 'HEADER' ? 2 : 1),
      // openByDefault: true,
      // marryChildren: true,
      // children: [
      //   getObjectPermissionsColumn('read', permissionSetId),
      //   getObjectPermissionsColumn('create', permissionSetId),
      //   getObjectPermissionsColumn('edit', permissionSetId),
      //   getObjectPermissionsColumn('delete', permissionSetId),
      //   getObjectPermissionsColumn('viewAll', permissionSetId),
      //   getObjectPermissionsColumn('modifyAll', permissionSetId),
      // ],
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
      name: '',
      key: 'sobject',
      width: 40,
      // formatter: () => 'X',
      // groupFormatter: () => 'X',
      groupFormatter: ({ isExpanded }) => (
        <Grid align="end" verticalAlign="center" className="h-100">
          <Icon
            icon={isExpanded ? 'chevrondown' : 'chevronright'}
            type="utility"
            className="slds-icon slds-icon-text-default slds-icon_x-small"
            title="Toggle collapse"
          />
        </Grid>
      ),
      // rowGroup: true,
      // hide: true,
      // lockVisible: true,
    },
    {
      ...setColumnFromType('tableLabel', 'text'),
      name: 'Field',
      key: 'tableLabel',
      frozen: true,
      width: 300,
      // <button className="slds-button slds-align_absolute-center slds-text-link"
      groupFormatter: ({ groupKey, toggleGroup }) => (
        <button className="slds-button" onClick={toggleGroup}>
          {groupKey as string}
        </button>
      ),
      // lockPinned: true,
      // lockPosition: true,
      // lockVisible: true,
      // getValue: ({ column, row }) => {
      //   const data: PermissionTableFieldCell = row[column.key];
      //   return `${data.sobject} ${data.label} (${data.apiName})`;
      // },
      summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
      // valueFormatter: (params) => {
      //   const data: PermissionTableFieldCell = params.data;
      //   return data?.label && `${data.label} (${data.apiName})`;
      // },
    },
    {
      name: '',
      key: '_ROW_ACTION',
      // cellRendererSelector: ({ node }) => ({ component: node.isRowPinned() ? BulkActionRenderer : RowActionRenderer }),
      width: 100,
      resizable: false,
      // filter: false,
      // sortable: false,
      // suppressMenu: true,
      // resizable: false,
      // pinned: true,
      frozen: true,
      // lockPinned: true,
      // lockPosition: true,
      // lockVisible: true,
      // cellStyle: { overflow: 'visible' },
      formatter: RowActionRenderer,
      summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
      summaryFormatter: ({ row }) => {
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
    newColumns.push(
      getColumnForProfileOrPermSet({
        id: profileId,
        type: 'Profile',
        label: profile.Profile.Name,
        actionType: 'Read',
        actionKey: 'read',
      })
    );
    newColumns.push(
      getColumnForProfileOrPermSet({
        id: profileId,
        type: 'Permission Set',
        label: profile.Profile.Name,
        actionType: 'Edit',
        actionKey: 'edit',
      })
    );
  });
  // Create column groups for permission sets
  selectedPermissionSets.forEach((permissionSetId) => {
    const permissionSet = permissionSetsById[permissionSetId];
    newColumns.push(
      getColumnForProfileOrPermSet({
        id: permissionSetId,
        type: 'Permission Set',
        label: permissionSet.Name,
        actionType: 'Read',
        actionKey: 'read',
      })
    );
    newColumns.push(
      getColumnForProfileOrPermSet({
        id: permissionSetId,
        type: 'Permission Set',
        label: permissionSet.Name,
        actionType: 'Edit',
        actionKey: 'edit',
      })
    );
  });
  return newColumns;
}

// TODO: use for object table permissions
// TODO: figure out how to make type inference work somehow
function getColumnForProfileOrPermSet({
  id,
  label,
  type,
  actionType,
  actionKey,
}: {
  id: string;
  label: string;
  type: 'Profile' | 'Permission Set';
  actionType: 'Read' | 'Edit';
  actionKey: FieldPermissionTypes;
}) {
  const colWidth = Math.max(116, (`${label} (${type})`.length * 7.5) / 2);
  const column: ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow> = {
    name: `${label} (${type})`,
    key: `${id}-${actionKey}`,
    width: colWidth,
    cellClass: (row) => {
      const permission = row.permissions[id];
      if ((actionKey === 'read' && permission.readIsDirty) || (actionKey === 'edit' && permission.editIsDirty)) {
        return 'active-item-yellow-bg';
      }
      return '';
    },
    colSpan: (args) => (args.type === 'HEADER' ? 2 : 1),
    formatter: ({ column, isCellSelected, row, onRowChange }) => {
      const errorMessage = row.permissions[id].errorMessage;
      const value = row.permissions[id][actionKey];
      function handleChange(value: boolean) {
        const newRow = setFieldValue(actionKey, row, id, value);
        onRowChange(newRow);
      }
      return (
        <div className="slds-align_absolute-center">
          <Checkbox
            id={`${row.key}-${id}-${actionKey}`}
            checked={value}
            label="value"
            hideLabel
            readOnly={actionKey === 'edit' && !row.allowEditPermission}
            onChange={handleChange}
          />
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
    summaryCellClass: ({ type }) => (type === 'HEADING' ? 'bg-color-gray' : null),
    summaryFormatter: (args) => {
      if (args.row.type === 'HEADING') {
        return <div>{actionType} Access</div>;
      }
      return <PinnedSelectAllRendererWrapper {...args} />;
    },
  };
  return column;
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
//  export const IdLinkRenderer: FunctionComponent<FormatterProps<any, unknown>> = ({ column, row, onRowChange, isCellSelected }) => {
export const PinnedSelectAllRendererWrapper: FunctionComponent<SummaryFormatterProps<any, unknown>> = ({ column }) => {
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

// function handleRowPermissionUpdate(
//   columns: Column[],
//   rowNode: RowNode,
//   type: PermissionType,
//   checkboxesById: MapOf<BulkActionCheckbox>,
//   applyTo: 'visible' | 'all',
//   arrayToUpdate: any[]
// ) {
//   const columnsToApplyToById = getColumnToApplyTo(columns, applyTo);
//   if (type === 'object') {
//     const data: PermissionTableObjectCell = rowNode.data;
//     if (!rowNode.isRowPinned() && data) {
//       Object.values(data.permissions).forEach((permission) => {
//         const applyTo = columnsToApplyToById[permission.parentId];

//         if (applyTo['create']) {
//           permission.create = checkboxesById['create'].value;
//         }
//         if (applyTo['read']) {
//           permission.read = checkboxesById['read'].value;
//         }
//         if (data.allowEditPermission && applyTo['edit']) {
//           permission.edit = checkboxesById['edit'].value;
//         }
//         if (applyTo['delete']) {
//           permission.delete = checkboxesById['delete'].value;
//         }
//         if (applyTo['viewAll']) {
//           permission.viewAll = checkboxesById['viewAll'].value;
//         }
//         if (applyTo['modifyAll']) {
//           permission.modifyAll = checkboxesById['modifyAll'].value;
//         }

//         permission.createIsDirty = permission.create !== permission.record.create;
//         permission.readIsDirty = permission.read !== permission.record.read;
//         permission.editIsDirty = permission.edit !== permission.record.edit;
//         permission.deleteIsDirty = permission.delete !== permission.record.delete;
//         permission.viewAllIsDirty = permission.viewAll !== permission.record.viewAll;
//         permission.modifyAllIsDirty = permission.modifyAll !== permission.record.modifyAll;
//       });
//       arrayToUpdate.push(data);
//     }
//   } else {
//     const data: PermissionTableFieldCell = rowNode.data;
//     if (!rowNode.isRowPinned() && data) {
//       Object.values(data.permissions).forEach((permission) => {
//         const applyTo = columnsToApplyToById[permission.parentId];
//         if (applyTo['read']) {
//           permission.read = checkboxesById['read'].value;
//         }
//         if (data.allowEditPermission && applyTo['edit']) {
//           permission.edit = checkboxesById['edit'].value;
//         }
//         permission.readIsDirty = permission.read !== permission.record.read;
//         permission.editIsDirty = permission.edit !== permission.record.edit;
//       });
//       arrayToUpdate.push(data);
//     }
//   }
// }

// function handleRowPermissionReset(
//   columns: Column[],
//   rowNode: RowNode,
//   type: PermissionType,
//   applyTo: 'visible' | 'all',
//   arrayToUpdate: any[]
// ) {
//   const columnsToApplyToById = getColumnToApplyTo(columns, applyTo);
//   if (type === 'object') {
//     const data: PermissionTableObjectCell = rowNode.data;
//     if (!rowNode.isRowPinned() && data) {
//       Object.values(data.permissions).forEach((permission) => {
//         const applyTo = columnsToApplyToById[permission.parentId];

//         if (permission.createIsDirty && applyTo['create']) {
//           permission.create = !permission.create;
//           permission.createIsDirty = false;
//         }
//         if (permission.readIsDirty && applyTo['read']) {
//           permission.read = !permission.read;
//           permission.readIsDirty = false;
//         }
//         if (permission.editIsDirty && applyTo['edit']) {
//           permission.edit = !permission.edit;
//           permission.editIsDirty = false;
//         }
//         if (permission.deleteIsDirty && applyTo['delete']) {
//           permission.delete = !permission.delete;
//           permission.deleteIsDirty = false;
//         }
//         if (permission.viewAllIsDirty && applyTo['viewAll']) {
//           permission.viewAll = !permission.viewAll;
//           permission.viewAllIsDirty = false;
//         }
//         if (permission.modifyAllIsDirty && applyTo['modifyAll']) {
//           permission.modifyAll = !permission.modifyAll;
//           permission.modifyAllIsDirty = false;
//         }
//       });
//       arrayToUpdate.push(data);
//     }
//   } else {
//     const data: PermissionTableFieldCell = rowNode.data;
//     if (!rowNode.isRowPinned() && data) {
//       Object.values(data.permissions).forEach((permission) => {
//         const applyTo = columnsToApplyToById[permission.parentId];

//         if (permission.readIsDirty && applyTo['read']) {
//           permission.read = !permission.read;
//           permission.readIsDirty = false;
//         }
//         if (permission.editIsDirty && applyTo['edit']) {
//           permission.edit = !permission.edit;
//           permission.editIsDirty = false;
//         }
//       });
//       arrayToUpdate.push(data);
//     }
//   }
// }

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
export const RowActionRenderer: FunctionComponent<FormatterProps<PermissionTableObjectCell | PermissionTableFieldCell>> = ({
  column,
  onRowChange,
  row,
}) => {
  const { type } = useContext(DataTableGenericContext) as PermissionManagerTableContext;
  const popoverRef = useRef<PopoverRef>();
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

  /**
   * FIXME:
   * this is broken - any click on popover closes it (maybe because it is in the table and super janked?)
   * might need to keep old one here temporarily
   *
   * May need to move to modal if we cannot figure this out
   */

  return (
    <Popover
      ref={popoverRef}
      size={type === 'object' ? 'large' : 'medium'}
      placement="bottom"
      onChange={handlePopoverChange}
      omitPortal
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
                {formatNumber(rows.length)} {pluralizeFromNumber('item', rows.length)}
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

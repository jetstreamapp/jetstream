/** @jsx jsx */
import {
  CellClassParams,
  ColDef,
  ColGroupDef,
  GridApi,
  ICellRendererParams,
  RowNode,
  ValueGetterParams,
  ValueSetterParams,
} from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { MapOf, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
import { Icon, Input, Tooltip } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { FieldPermissionDefinitionMap, FieldPermissionItem } from './permission-manager-utils';

export interface PermissionTableFieldCell {
  key: string;
  fullWidthRow?: boolean;
  sobject: string;
  apiName: string;
  label: string;
  type: string;
  allowEditPermission: boolean;
  permissions: MapOf<PermissionTableFieldCellPermission>;
}

export interface PermissionTableFieldCellPermission {
  rowKey: string;
  parentId: string; // permissions set (placeholder profile or permission set Id)
  sobject: string;
  field: string;
  read: boolean;
  edit: boolean;
  record: FieldPermissionItem;
  readIsDirty: boolean;
  editIsDirty: boolean;
  errorMessage?: string;
}

export interface ManagePermissionsEditorTableProps {
  fieldsByObject: MapOf<string[]>;
}

export interface ManagePermissionsEditorTableRef {
  resetChanges: () => void;
  getDirtyPermissionsForSave: () => PermissionTableFieldCellPermission[];
}

export function getFieldValue(which: 'read' | 'edit') {
  return ({ node, data, colDef }: ValueGetterParams) => {
    if (node.isRowPinned()) {
      return;
    }
    return (data as PermissionTableFieldCell).permissions?.[colDef.field]?.[which] || false;
  };
}

export function setFieldValue(which: 'read' | 'edit') {
  return ({ node, colDef, newValue }: ValueSetterParams) => {
    if (node.isRowPinned()) {
      return;
    }
    const data: PermissionTableFieldCell = node.data;
    const permission = data.permissions[colDef.field];
    if (which === 'read') {
      permission.read = newValue;
      permission.readIsDirty = permission.read !== permission.record.read;
      // edit is not allowed unless read is set
      if (!newValue) {
        permission.edit = false;
        permission.editIsDirty = permission.edit !== permission.record.edit;
      }
    } else if (data.allowEditPermission) {
      permission.edit = newValue;
      permission.editIsDirty = permission.edit !== permission.record.edit;
      // read is required if edit is true
      if (newValue) {
        permission.read = true;
        permission.readIsDirty = permission.read !== permission.record.read;
      }
    }
    return true;
  };
}

export function getFieldDirtyValue(which: 'read' | 'edit') {
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

export function resetGridChanges(gridApi: GridApi) {
  const itemsToUpdate = [];
  gridApi.forEachNodeAfterFilterAndSort((rowNode, index) => {
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
    if (itemsToUpdate.length) {
      const transactionResult = gridApi.applyTransaction({ update: itemsToUpdate });
      logger.log({ transactionResult });
    }
  });
}

export function getDirtyPermissions(gridApi: GridApi): PermissionTableFieldCellPermission[] {
  let dirtyPermissions: PermissionTableFieldCellPermission[] = [];
  gridApi.forEachNode((rowNode, index) => {
    const data: PermissionTableFieldCell = rowNode.data;
    if (!data.fullWidthRow && !rowNode.isRowPinned()) {
      dirtyPermissions = dirtyPermissions.concat(
        Object.values(data.permissions).filter((permission) => permission.readIsDirty || permission.editIsDirty)
      );
    }
  });
  return dirtyPermissions;
}

export function getPermissionsColumn(which: 'read' | 'edit', id) {
  const colDef: ColDef = {
    headerName: which === 'read' ? 'Read Access' : 'Edit Access',
    colId: `${id}-${which}`,
    field: id,
    filter: 'booleanFilterRenderer',
    valueGetter: getFieldValue(which),
    valueSetter: setFieldValue(which),
    cellClassRules: {
      'active-item-yellow-bg': getFieldDirtyValue(which),
    },
    cellRenderer: 'booleanEditableRenderer',
    pinnedRowCellRenderer: 'pinnedSelectAllRenderer',
  };
  return colDef;
}

export function getColumns(
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
      valueFormatter: (params) => {
        const data: PermissionTableFieldCell = params.data;
        return `${data.label} (${data.apiName})`;
      },
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
      children: [getPermissionsColumn('read', profileId), getPermissionsColumn('edit', profileId)],
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
      children: [getPermissionsColumn('read', permissionSetId), getPermissionsColumn('edit', permissionSetId)],
    };
    newColumns.push(currColumn);
  });
  return newColumns;
}

export function getRows(
  selectedSObjects: string[],
  fieldsByObject: MapOf<string[]>,
  fieldPermissionMap: MapOf<FieldPermissionDefinitionMap>
) {
  const rows: PermissionTableFieldCell[] = [];
  selectedSObjects.forEach((sobject) => {
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
        currRow.permissions[key] = {
          rowKey: fieldKey,
          parentId: key,
          sobject,
          field: fieldPermission.apiName,
          read: item.read,
          edit: item.edit,
          record: item,
          readIsDirty: false,
          editIsDirty: false,
          errorMessage: item.errorMessage,
        };
      });

      rows.push(currRow);
    });
  });
  return rows;
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
export const PinnedSelectAllRenderer: FunctionComponent<ICellRendererParams> = ({ api, node, column, colDef }) => {
  function handleSelection(action: 'selectAll' | 'unselectAll' | 'reset') {
    const [id, which] = colDef.colId.split('-');
    const itemsToUpdate = [];
    api.forEachNodeAfterFilter((rowNode, index) => {
      if (!rowNode.isRowPinned() && !rowNode.isFullWidthCell()) {
        const data: PermissionTableFieldCell = rowNode.data;
        const currItem = data.permissions[id];
        const newValue = action === 'selectAll';
        if (which === 'read') {
          if (action === 'reset') {
            currItem.read = currItem.record.read;
            currItem.readIsDirty = false;
          } else {
            currItem.read = newValue;
            currItem.readIsDirty = currItem.read !== currItem.record.read;
          }
          // edit is not allowed if read is false
          if (!currItem.read) {
            currItem.edit = false;
            currItem.editIsDirty = currItem.edit !== currItem.record.edit;
          }
        } else if (data.allowEditPermission) {
          if (action === 'reset') {
            currItem.edit = currItem.record.edit;
            currItem.editIsDirty = false;
          } else {
            currItem.edit = newValue;
            currItem.editIsDirty = currItem.edit !== currItem.record.edit;
          }
          // read is required if edit is true
          if (currItem.edit) {
            currItem.read = true;
            currItem.readIsDirty = currItem.read !== currItem.record.read;
          }
        }
        itemsToUpdate.push(data);
      }
    });
    const transactionResult = api.applyTransaction({ update: itemsToUpdate });
    logger.log({ transactionResult });
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
  const data: PermissionTableFieldCell = node.data;
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

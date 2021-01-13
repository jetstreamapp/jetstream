/** @jsx jsx */
import { ColDef, ColGroupDef, GridApi, GridReadyEvent, ICellRendererParams } from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable } from '@jetstream/ui';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useRecoilValue } from 'recoil';
import * as fromPermissionsStateState from './manage-permissions.state';
import {
  ErrorTooltipRenderer,
  getFieldColumns,
  getFieldRows,
  isFullWidthCell,
  PinnedLabelInputFilter,
  PinnedSelectAllRendererWrapper,
  resetGridChanges,
} from './utils/permission-manager-table-utils';
import {
  DirtyRow,
  ManagePermissionsEditorTableRef,
  FieldPermissionDefinitionMap,
  PermissionTableFieldCell,
} from './utils/permission-manager-types';

export interface ManagePermissionsEditorFieldTableProps {
  columns: (ColDef | ColGroupDef)[];
  rows: PermissionTableFieldCell[];
  // selectedProfiles: string[];
  // selectedPermissionSets: string[];
  // selectedSObjects: string[];
  // profilesById: MapOf<PermissionSetWithProfileRecord>;
  // permissionSetsById: MapOf<PermissionSetNoProfileRecord>;
  // fieldPermissionMap: MapOf<FieldPermissionDefinitionMap>;
  // initialRows: PermissionTableFieldCell[];
  // fieldsByObject: MapOf<string[]>;
  // onColumns: (columns: (ColDef | ColGroupDef)[]) => void;
  // onRows: (rows: PermissionTableFieldCell[]) => void;
  onBulkUpdate: (rows: PermissionTableFieldCell[]) => void;
  onDirtyRows?: (values: MapOf<DirtyRow<PermissionTableFieldCell>>) => void;
}

const pinnedSelectAllRow = {
  key: `pinned-select-all`,
  sobject: '',
  apiName: '',
  label: '',
  type: null,
  permissions: {},
};

export const ManagePermissionsEditorFieldTable = forwardRef<any, ManagePermissionsEditorFieldTableProps>(
  (
    {
      columns,
      rows,
      // selectedProfiles,
      // selectedPermissionSets,
      // selectedSObjects,
      // profilesById,
      // permissionSetsById,
      // fieldPermissionMap,
      // initialRows,
      // fieldsByObject,
      // onColumns,
      // onRows,
      onDirtyRows,
      onBulkUpdate,
    },
    ref
  ) => {
    // const [columns, setColumns] = useState<(ColDef | ColGroupDef)[]>([]);
    // const [rows, setRows] = useState<PermissionTableFieldCell[]>(initialRows || []);
    const [gridApi, setGridApi] = useState<GridApi>(null);
    const [dirtyRows, setDirtyRows] = useState<MapOf<DirtyRow<PermissionTableFieldCell>>>({});

    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        if (gridApi) {
          resetGridChanges(gridApi, 'field');
          setDirtyRows({});
        }
      },
      // Rebuild table and ensure error messages are cleared from prior attempts
      resetRows() {
        if (gridApi) {
          gridApi.refreshCells({ force: true, suppressFlash: true });
        }
      },
    }));

    useNonInitialEffect(() => {
      dirtyRows && onDirtyRows && onDirtyRows(dirtyRows);
    }, [dirtyRows, onDirtyRows]);

    // useEffect(() => {
    //   const columns = getFieldColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById);
    //   const rows = initialRows || getFieldRows(selectedSObjects, fieldsByObject, fieldPermissionMap);
    //   logger.log('[PERM TABLE]', { columns, rows });
    //   setColumns(columns);
    //   setRows(rows);
    //   onColumns(columns);
    //   onRows(rows);
    //   // only run on first render
    // }, []);

    // useNonInitialEffect(() => {
    //   const rows = getFieldRows(selectedSObjects, fieldsByObject, fieldPermissionMap);
    //   setRows(rows);
    //   onRows(rows);
    //   setDirtyRows({});
    // }, [fieldPermissionMap]);

    function handleOnGridReady({ api }: GridReadyEvent) {
      setGridApi(api);
    }

    // function handleBulkRowUpdate(rows: PermissionTableFieldCell[]) {
    //   setDirtyRows((priorValue) => {
    //     const newValues = { ...priorValue };
    //     rows.forEach((row) => {
    //       const rowKey = row.key; // e.x. Obj__c.Field__c
    //       const dirtyCount = Object.values(row.permissions).reduce((output, { readIsDirty, editIsDirty }) => {
    //         output += readIsDirty ? 1 : 0;
    //         output += editIsDirty ? 1 : 0;
    //         return output;
    //       }, 0);
    //       newValues[rowKey] = { rowKey, dirtyCount, row };
    //     });
    //     // remove items with a dirtyCount of 0 to reduce future processing required
    //     return Object.keys(newValues).reduce((output: MapOf<DirtyRow<PermissionTableFieldCell>>, key) => {
    //       if (newValues[key].dirtyCount) {
    //         output[key] = newValues[key];
    //       }
    //       return output;
    //     }, {});
    //   });
    // }

    return (
      <div>
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
          <DataTable
            columns={columns}
            data={rows}
            frameworkComponents={{
              pinnedInputFilter: PinnedLabelInputFilter,
              pinnedSelectAllRenderer: PinnedSelectAllRendererWrapper('field'),
              errorTooltipRenderer: ErrorTooltipRenderer,
            }}
            agGridProps={{
              pinnedTopRowData: [pinnedSelectAllRow],
              suppressRowClickSelection: true,
              headerHeight: 25,
              gridOptions: {
                context: {
                  isReadOnly: ({ node, column, colDef, context }: ICellRendererParams) => {
                    if (colDef.colId.endsWith('edit')) {
                      const data = node.data as PermissionTableFieldCell;
                      return !data.allowEditPermission;
                    }
                    return false;
                  },
                  additionalComponent: ErrorTooltipRenderer,
                  onBulkUpdate: onBulkUpdate,
                },
                immutableData: true,
                getRowNodeId: (data: PermissionTableFieldCell) => data.key,
                isFullWidthCell: isFullWidthCell,
                fullWidthCellRenderer: 'fullWidthRenderer',
                defaultColDef: {
                  filter: true,
                  sortable: false,
                  resizable: true,
                },
              },
              getRowHeight: ({ node }) => {
                if (node.rowPinned) {
                  return 35;
                }
              },
              onCellDoubleClicked: undefined,
              onCellKeyDown: undefined,
              onGridReady: handleOnGridReady,
              onCellValueChanged: ({ data }) => onBulkUpdate([data]),
            }}
          />
        </AutoFullHeightContainer>
      </div>
    );
  }
);

export default ManagePermissionsEditorFieldTable;

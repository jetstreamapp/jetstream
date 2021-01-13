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
  getObjectColumns,
  getObjectRows,
  isFullWidthCell,
  PinnedLabelInputFilter,
  PinnedSelectAllRendererWrapper,
  resetGridChanges,
} from './utils/permission-manager-table-utils';
import {
  DirtyRow,
  ManagePermissionsEditorTableRef,
  ObjectPermissionDefinitionMap,
  PermissionTableObjectCell,
} from './utils/permission-manager-types';

export interface ManagePermissionsEditorObjectTableProps {
  columns: (ColDef | ColGroupDef)[];
  rows: PermissionTableObjectCell[];
  // selectedProfiles: string[];
  // selectedPermissionSets: string[];
  // selectedSObjects: string[];
  // profilesById: MapOf<PermissionSetWithProfileRecord>;
  // permissionSetsById: MapOf<PermissionSetNoProfileRecord>;
  // objectPermissionMap: MapOf<ObjectPermissionDefinitionMap>;
  // initialRows: PermissionTableObjectCell[];
  // onColumns: (columns: (ColDef | ColGroupDef)[]) => void;
  // onRows: (rows: PermissionTableObjectCell[]) => void;
  onBulkUpdate: (rows: PermissionTableObjectCell[]) => void;
  onDirtyRows?: (values: MapOf<DirtyRow<PermissionTableObjectCell>>) => void;
}

const pinnedSelectAllRow = {
  key: `pinned-select-all`,
  sobject: '',
  apiName: '',
  label: '',
  type: null,
  permissions: {},
};

/**
 *
 * TODO:
 * This section was a 100% copy/paste and needs to be 100% worked out!
 *
 */

export const ManagePermissionsEditorObjectTable = forwardRef<any, ManagePermissionsEditorObjectTableProps>(
  (
    {
      columns,
      rows,
      // selectedProfiles,
      // selectedPermissionSets,
      // selectedSObjects,
      // profilesById,
      // permissionSetsById,
      // objectPermissionMap,
      // initialRows,
      // onColumns,
      // onRows,
      onBulkUpdate,
      onDirtyRows,
    },
    ref
  ) => {
    // const [columns, setColumns] = useState<(ColDef | ColGroupDef)[]>([]);
    // const [rows, setRows] = useState<PermissionTableObjectCell[]>([]);
    const [gridApi, setGridApi] = useState<GridApi>(null);
    const [dirtyRows, setDirtyRows] = useState<MapOf<DirtyRow<PermissionTableObjectCell>>>({});

    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        if (gridApi) {
          resetGridChanges(gridApi, 'object');
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
    //   const columns = getObjectColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById);
    //   const rows = initialRows || getObjectRows(selectedSObjects, objectPermissionMap);
    //   logger.log('[PERM TABLE]', { columns, rows });
    //   setColumns(columns);
    //   setRows(rows);
    //   onColumns(columns);
    //   onRows(rows);
    //   // only run on first render
    // }, []);

    // useNonInitialEffect(() => {
    //   setRows(getObjectRows(selectedSObjects, objectPermissionMap));
    //   setDirtyRows({});
    // }, [objectPermissionMap]);

    function handleOnGridReady({ api }: GridReadyEvent) {
      setGridApi(api);
    }

    // function handleBulkRowUpdate(rows: PermissionTableObjectCell[]) {
    //   setDirtyRows((priorValue) => {
    //     const newValues = { ...priorValue };
    //     rows.forEach((row) => {
    //       const rowKey = row.key; // e.x. Obj__c.Field__c
    //       const dirtyCount = Object.values(row.permissions).reduce(
    //         (output, { createIsDirty, readIsDirty, editIsDirty, deleteIsDirty, viewAllIsDirty, modifyAllIsDirty }) => {
    //           output += createIsDirty ? 1 : 0;
    //           output += readIsDirty ? 1 : 0;
    //           output += editIsDirty ? 1 : 0;
    //           output += deleteIsDirty ? 1 : 0;
    //           output += viewAllIsDirty ? 1 : 0;
    //           output += modifyAllIsDirty ? 1 : 0;
    //           return output;
    //         },
    //         0
    //       );
    //       newValues[rowKey] = { rowKey, dirtyCount, row };
    //     });
    //     // remove items with a dirtyCount of 0 to reduce future processing required
    //     return Object.keys(newValues).reduce((output: MapOf<DirtyRow<PermissionTableObjectCell>>, key) => {
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
              pinnedSelectAllRenderer: PinnedSelectAllRendererWrapper('object'),
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
                      const data = node.data as PermissionTableObjectCell;
                      return !data.allowEditPermission;
                    }
                    return false;
                  },
                  additionalComponent: ErrorTooltipRenderer,
                  onBulkUpdate: onBulkUpdate,
                },
                immutableData: true,
                getRowNodeId: (data: PermissionTableObjectCell) => data.key,
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

export default ManagePermissionsEditorObjectTable;

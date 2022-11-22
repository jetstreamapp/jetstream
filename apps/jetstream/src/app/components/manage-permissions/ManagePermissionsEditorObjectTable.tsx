import { GridApi } from '@ag-grid-community/core';

import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTableNew } from '@jetstream/ui';
import { forwardRef, useImperativeHandle, useState } from 'react';
import {
  DirtyRow,
  ManagePermissionsEditorTableRef,
  PermissionTableObjectCell,
  PermissionTableSummaryRow,
} from './utils/permission-manager-types';

function getRowKey(row: PermissionTableObjectCell) {
  return row.key;
}

export interface ManagePermissionsEditorObjectTableProps {
  columns: ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>[];
  rows: PermissionTableObjectCell[];
  onBulkUpdate: (rows: PermissionTableObjectCell[], indexes: number[]) => void;
  onDirtyRows?: (values: MapOf<DirtyRow<PermissionTableObjectCell>>) => void;
}

/**
 *
 * TODO:
 * This section was a 100% copy/paste and needs to be 100% worked out!
 *
 */

export const ManagePermissionsEditorObjectTable = forwardRef<any, ManagePermissionsEditorObjectTableProps>(
  ({ columns, rows, onBulkUpdate, onDirtyRows }, ref) => {
    const [gridApi, setGridApi] = useState<GridApi>(null);
    const [dirtyRows, setDirtyRows] = useState<MapOf<DirtyRow<PermissionTableObjectCell>>>({});

    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        // if (gridApi) {
        //   resetGridChanges(gridApi, 'object');
        //   setDirtyRows({});
        // }
      },
      // Rebuild table and ensure error messages are cleared from prior attempts
      resetRows() {
        // if (gridApi) {
        //   gridApi.refreshCells({ force: true, suppressFlash: true });
        // }
      },
    }));

    useNonInitialEffect(() => {
      dirtyRows && onDirtyRows && onDirtyRows(dirtyRows);
    }, [dirtyRows, onDirtyRows]);

    // function handleOnGridReady({ api }: GridReadyEvent) {
    //   setGridApi(api);
    // }

    return (
      <div>
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
          <DataTableNew
            columns={columns}
            data={rows}
            getRowKey={getRowKey}
            onRowsChange={(rows: PermissionTableObjectCell[], { indexes }) => onBulkUpdate(rows, indexes)}
            // components={{
            //   pinnedInputFilter: PinnedLabelInputFilter,
            //   pinnedSelectAllRenderer: PinnedSelectAllRendererWrapper('object'),
            //   errorTooltipRenderer: ErrorTooltipRenderer,
            //   rowActionRenderer: RowActionRenderer,
            //   bulkActionRenderer: BulkActionRenderer,
            // }}
            // agGridProps={{
            //   pinnedTopRowData: [pinnedSelectAllRow],
            //   rowSelection: null,
            //   context: {
            //     isReadOnly: ({ node, colDef }: ICellRendererParams) => {
            //       if (colDef.colId.endsWith('edit')) {
            //         const data = node.data as PermissionTableObjectCell;
            //         return !data?.allowEditPermission;
            //       }
            //       return false;
            //     },
            //     additionalComponent: ErrorTooltipRenderer,
            //     onBulkUpdate: onBulkUpdate,
            //     type: 'object',
            //   },
            //   sideBar: {
            //     toolPanels: [
            //       {
            //         id: 'filters',
            //         labelDefault: 'Filters',
            //         labelKey: 'filters',
            //         iconKey: 'filter',
            //         toolPanel: 'agFiltersToolPanel',
            //         toolPanelParams: {
            //           suppressFilterSearch: true,
            //         },
            //       },
            //       {
            //         id: 'columns',
            //         labelDefault: 'Columns',
            //         labelKey: 'columns',
            //         iconKey: 'columns',
            //         toolPanel: 'agColumnsToolPanel',
            //         toolPanelParams: {
            //           suppressRowGroups: true,
            //           suppressValues: true,
            //           suppressPivots: true,
            //           suppressPivotMode: true,
            //         },
            //       },
            //     ],
            //   },
            //   onCellKeyPress: handleOnCellPressed,
            //   getRowId: ({ data }: GetRowIdParams) => data.key,
            //   fullWidthCellRenderer: 'fullWidthRenderer',
            //   getRowHeight: ({ node }) => {
            //     if (node.rowPinned) {
            //       return 35;
            //     }
            //   },
            //   onCellDoubleClicked: undefined,
            //   onCellKeyDown: undefined,
            //   onGridReady: handleOnGridReady,
            //   onCellValueChanged: ({ data }) => onBulkUpdate([data]),
            // }}
          />
        </AutoFullHeightContainer>
      </div>
    );
  }
);

export default ManagePermissionsEditorObjectTable;

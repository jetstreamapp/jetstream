/** @jsx jsx */
import { ColDef, ColGroupDef, GridApi, GridReadyEvent, ICellRendererParams } from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable } from '@jetstream/ui';
import { forwardRef, useImperativeHandle, useState } from 'react';
import {
  BulkActionRenderer,
  ErrorTooltipRenderer,
  handleOnCellPressed,
  isFullWidthCell,
  PinnedLabelInputFilter,
  PinnedSelectAllRendererWrapper,
  resetGridChanges,
  RowActionRenderer,
} from './utils/permission-manager-table-utils';
import { DirtyRow, ManagePermissionsEditorTableRef, PermissionTableFieldCell } from './utils/permission-manager-types';

export interface ManagePermissionsEditorFieldTableProps {
  columns: (ColDef | ColGroupDef)[];
  rows: PermissionTableFieldCell[];
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
  ({ columns, rows, onDirtyRows, onBulkUpdate }, ref) => {
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

    function handleOnGridReady({ api }: GridReadyEvent) {
      setGridApi(api);
    }

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
              rowActionRenderer: RowActionRenderer,
              bulkActionRenderer: BulkActionRenderer,
            }}
            agGridProps={{
              pinnedTopRowData: [pinnedSelectAllRow],
              suppressRowClickSelection: true,
              rowSelection: null,
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
                  type: 'field',
                },
                immutableData: true,
                onCellKeyPress: handleOnCellPressed,
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

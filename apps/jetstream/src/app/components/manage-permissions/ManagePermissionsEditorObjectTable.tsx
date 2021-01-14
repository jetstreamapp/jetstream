/** @jsx jsx */
import { ColDef, ColGroupDef, GridApi, GridReadyEvent, ICellRendererParams } from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable } from '@jetstream/ui';
import { forwardRef, useImperativeHandle, useState } from 'react';
import {
  ErrorTooltipRenderer,
  handleOnCellPressed,
  isFullWidthCell,
  PinnedLabelInputFilter,
  PinnedSelectAllRendererWrapper,
  resetGridChanges,
} from './utils/permission-manager-table-utils';
import { DirtyRow, ManagePermissionsEditorTableRef, PermissionTableObjectCell } from './utils/permission-manager-types';

export interface ManagePermissionsEditorObjectTableProps {
  columns: (ColDef | ColGroupDef)[];
  rows: PermissionTableObjectCell[];
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
  ({ columns, rows, onBulkUpdate, onDirtyRows }, ref) => {
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
              pinnedSelectAllRenderer: PinnedSelectAllRendererWrapper('object'),
              errorTooltipRenderer: ErrorTooltipRenderer,
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
                      const data = node.data as PermissionTableObjectCell;
                      return !data.allowEditPermission;
                    }
                    return false;
                  },
                  additionalComponent: ErrorTooltipRenderer,
                  onBulkUpdate: onBulkUpdate,
                },
                immutableData: true,
                onCellKeyPress: handleOnCellPressed,
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

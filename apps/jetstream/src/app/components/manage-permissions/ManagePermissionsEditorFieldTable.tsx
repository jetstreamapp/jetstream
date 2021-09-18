/** @jsx jsx */
import {
  ColDef,
  ColGroupDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  RowClassParams,
  RowGroupingDisplayType,
} from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable } from '@jetstream/ui';
import { forwardRef, useImperativeHandle, useState } from 'react';
import {
  BulkActionRenderer,
  ErrorTooltipRenderer,
  GroupRowInnerRenderer,
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
              groupRowInnerRenderer: GroupRowInnerRenderer,
            }}
            agGridProps={{
              pinnedTopRowData: [pinnedSelectAllRow],
              rowSelection: null,
              autoGroupColumnDef: {
                headerName: 'Field',
                pinned: true,
                lockPosition: true,
                lockVisible: true,
                filter: 'agMultiColumnFilter',
                cellRenderer: 'agGroupCellRenderer',
                menuTabs: ['filterMenuTab'],
                filterValueGetter: (params) => {
                  const data: PermissionTableFieldCell = params.data;
                  return data && `${data.label} (${data.apiName})`;
                },
                sortable: true,
                resizable: true,
              },
              showOpenedGroup: true,
              groupDefaultExpanded: 1,
              groupDisplayType: RowGroupingDisplayType.GROUP_ROWS,
              groupRowRendererParams: {
                innerRenderer: 'groupRowInnerRenderer',
              },
              sideBar: {
                toolPanels: [
                  {
                    id: 'filters',
                    labelDefault: 'Filters',
                    labelKey: 'filters',
                    iconKey: 'filter',
                    toolPanel: 'agFiltersToolPanel',
                    toolPanelParams: {
                      suppressFilterSearch: true,
                    },
                  },
                  {
                    id: 'columns',
                    labelDefault: 'Columns',
                    labelKey: 'columns',
                    iconKey: 'columns',
                    toolPanel: 'agColumnsToolPanel',
                    toolPanelParams: {
                      suppressRowGroups: true,
                      suppressValues: true,
                      suppressPivots: true,
                      suppressPivotMode: true,
                    },
                  },
                ],
              },
              context: {
                isReadOnly: ({ node, colDef }: ICellRendererParams) => {
                  if (colDef.colId.endsWith('edit')) {
                    const data = node.data as PermissionTableFieldCell;
                    return !data?.allowEditPermission;
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
              getRowClass: ({ node }: RowClassParams) => {
                if (node.group) {
                  return 'row-group';
                }
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

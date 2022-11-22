import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTableNew } from '@jetstream/ui';
import { groupBy } from 'lodash';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { RowHeightArgs } from 'react-data-grid';
import { updateRowsFromColumnAction } from './utils/permission-manager-table-utils';
import {
  DirtyRow,
  FieldPermissionTypes,
  ManagePermissionsEditorTableRef,
  PermissionTableFieldCell,
  PermissionTableSummaryRow,
} from './utils/permission-manager-types';

function getRowKey(row: PermissionTableFieldCell) {
  return row.key;
}

function getRowHeight({ type, row }: RowHeightArgs<PermissionTableFieldCell>) {
  if (type === 'ROW') {
    return 24;
  }
  return 34;
}

// summary row is just a placeholder for rendered content
const SUMMARY_ROWS: PermissionTableSummaryRow[] = [{ type: 'HEADING' }, { type: 'ACTION' }];
const groupedRows = ['sobject'] as const;

export interface ManagePermissionsEditorFieldTableProps {
  columns: ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>[];
  rows: PermissionTableFieldCell[];
  onBulkUpdate: (rows: PermissionTableFieldCell[], indexes?: number[]) => void;
  onDirtyRows?: (values: MapOf<DirtyRow<PermissionTableFieldCell>>) => void;
}

export const ManagePermissionsEditorFieldTable = forwardRef<any, ManagePermissionsEditorFieldTableProps>(
  ({ columns, rows, onDirtyRows, onBulkUpdate }, ref) => {
    // const [gridApi, setGridApi] = useState<GridApi>(null);
    const [dirtyRows, setDirtyRows] = useState<MapOf<DirtyRow<PermissionTableFieldCell>>>({});
    const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set<any>(rows.map((row) => row.sobject)));

    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        // if (gridApi) {
        //   resetGridChanges(gridApi, 'field');
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

    function handleColumnAction(action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) {
      const [id, typeLabel] = columnKey.split('-');
      onBulkUpdate(updateRowsFromColumnAction('field', action, typeLabel as FieldPermissionTypes, id, rows));
    }

    const handleRowsChange = useCallback(
      (rows: PermissionTableFieldCell[], { indexes }) => {
        onBulkUpdate(rows, indexes);
      },
      [onBulkUpdate]
    );

    return (
      <div>
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
          <DataTableNew
            columns={columns}
            data={rows}
            getRowKey={getRowKey}
            topSummaryRows={SUMMARY_ROWS}
            onRowsChange={handleRowsChange}
            context={{ onColumnAction: handleColumnAction }}
            rowHeight={getRowHeight}
            summaryRowHeight={38}
            groupBy={groupedRows}
            rowGrouper={groupBy}
            expandedGroupIds={expandedGroupIds}
            onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
            // components={{
            //   pinnedInputFilter: PinnedLabelInputFilter,
            //   pinnedSelectAllRenderer: PinnedSelectAllRendererWrapper('field'),
            //   errorTooltipRenderer: ErrorTooltipRenderer,
            //   rowActionRenderer: RowActionRenderer,
            //   bulkActionRenderer: BulkActionRenderer,
            //   groupRowInnerRenderer: GroupRowInnerRenderer,
            // }}
            // agGridProps={{
            //   pinnedTopRowData: [pinnedSelectAllRow],
            //   rowSelection: null,
            //   autoGroupColumnDef: {
            //     headerName: 'Field',
            //     pinned: true,
            //     lockPosition: true,
            //     lockVisible: true,
            //     filter: 'agMultiColumnFilter',
            //     cellRenderer: 'agGroupCellRenderer',
            //     menuTabs: ['filterMenuTab'],
            //     filterValueGetter: (params) => {
            //       const data: PermissionTableFieldCell = params.data;
            //       return data && `${data.label} (${data.apiName})`;
            //     },
            //     sortable: true,
            //     resizable: true,
            //   },
            //   showOpenedGroup: true,
            //   groupDefaultExpanded: 1,
            //   groupDisplayType: 'groupRows',
            //   groupRowRendererParams: {
            //     innerRenderer: 'groupRowInnerRenderer',
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
            //   context: {
            //     isReadOnly: ({ node, colDef }: ICellRendererParams) => {
            //       if (colDef.colId.endsWith('edit')) {
            //         const data = node.data as PermissionTableFieldCell;
            //         return !data?.allowEditPermission;
            //       }
            //       return false;
            //     },
            //     additionalComponent: ErrorTooltipRenderer,
            //     onBulkUpdate: onBulkUpdate,
            //     type: 'field',
            //   },
            //   onCellKeyPress: handleOnCellPressed,
            //   getRowId: ({ data }: GetRowIdParams) => data.key,
            //   fullWidthCellRenderer: 'fullWidthRenderer',
            //   getRowClass: ({ node }: RowClassParams) => {
            //     if (node.group) {
            //       return 'row-group';
            //     }
            //   },
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

export default ManagePermissionsEditorFieldTable;

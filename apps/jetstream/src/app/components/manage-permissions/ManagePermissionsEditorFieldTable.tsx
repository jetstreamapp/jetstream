import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTableNew } from '@jetstream/ui';
import { groupBy } from 'lodash';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { RowHeightArgs } from 'react-data-grid';
import { resetGridChanges, updateRowsFromColumnAction } from './utils/permission-manager-table-utils';
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
        resetGridChanges({ rows, type: 'field' });
        setDirtyRows({});
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
            context={{ type: 'field', onColumnAction: handleColumnAction, onBulkAction: onBulkUpdate }}
            rowHeight={getRowHeight}
            summaryRowHeight={38}
            groupBy={groupedRows}
            rowGrouper={groupBy}
            expandedGroupIds={expandedGroupIds}
            onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
          />
        </AutoFullHeightContainer>
      </div>
    );
  }
);

export default ManagePermissionsEditorFieldTable;

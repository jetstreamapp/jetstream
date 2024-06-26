import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import {
  DirtyRow,
  FieldPermissionTypes,
  ManagePermissionsEditorTableRef,
  PermissionManagerTableContext,
  PermissionTableObjectCell,
  PermissionTableSummaryRow,
} from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable, DataTableRef } from '@jetstream/ui';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { resetGridChanges, updateRowsFromColumnAction } from './utils/permission-manager-table-utils';

function getRowKey(row: PermissionTableObjectCell) {
  return row.key;
}

// summary row is just a placeholder for rendered content
const SUMMARY_ROWS: PermissionTableSummaryRow[] = [{ type: 'HEADING' }, { type: 'ACTION' }];

export interface ManagePermissionsEditorObjectTableProps {
  columns: ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>[];
  rows: PermissionTableObjectCell[];
  totalCount: number;
  onFilter: (value: string) => void;
  onBulkUpdate: (rows: PermissionTableObjectCell[], indexes?: number[]) => void;
  onDirtyRows?: (values: Record<string, DirtyRow<PermissionTableObjectCell>>) => void;
}

export const ManagePermissionsEditorObjectTable = forwardRef<any, ManagePermissionsEditorObjectTableProps>(
  ({ columns, rows, totalCount, onFilter, onBulkUpdate, onDirtyRows }, ref) => {
    const tableRef = useRef<DataTableRef<PermissionTableObjectCell>>();
    const [dirtyRows, setDirtyRows] = useState<Record<string, DirtyRow<PermissionTableObjectCell>>>({});

    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        resetGridChanges({ rows, type: 'object' });
        setDirtyRows({});
      },
    }));

    useNonInitialEffect(() => {
      dirtyRows && onDirtyRows && onDirtyRows(dirtyRows);
    }, [dirtyRows, onDirtyRows]);

    function handleColumnAction(action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) {
      const [id, typeLabel] = columnKey.split('-');
      const visibleRows = [...(tableRef.current?.getFilteredAndSortedRows() || rows)];
      onBulkUpdate(updateRowsFromColumnAction('object', action, typeLabel as FieldPermissionTypes, id, visibleRows));
    }

    const handleRowsChange = useCallback(
      (rows: PermissionTableObjectCell[], { indexes }: { indexes: number[] }) => {
        onBulkUpdate(rows, indexes);
      },
      [onBulkUpdate]
    );

    return (
      <div>
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
          <DataTable
            ref={tableRef}
            columns={columns as any}
            data={rows}
            getRowKey={getRowKey}
            topSummaryRows={SUMMARY_ROWS}
            onRowsChange={handleRowsChange}
            context={
              {
                type: 'object',
                totalCount,
                onFilterRows: onFilter,
                onColumnAction: handleColumnAction,
                onBulkAction: onBulkUpdate,
              } as PermissionManagerTableContext
            }
            rowHeight={24}
            summaryRowHeight={38}
          />
        </AutoFullHeightContainer>
      </div>
    );
  }
);

export default ManagePermissionsEditorObjectTable;

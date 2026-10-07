import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import {
  DirtyRow,
  FieldPermissionTypes,
  ManagePermissionsEditorTableRef,
  PermissionManagerTableContext,
  PermissionTableObjectCell,
  PermissionTableSummaryRow,
} from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable, DataTableRef, useAnnouncer } from '@jetstream/ui';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { applyPastedPermissionCells, resetGridChanges, updateRowsFromColumnAction } from './utils/permission-manager-table-utils';

function getRowKey(row: PermissionTableObjectCell) {
  return row.key;
}

// summary row is just a placeholder for rendered content
const SUMMARY_ROWS: PermissionTableSummaryRow[] = [{ type: 'HEADING' }, { type: 'ACTION' }];

export interface ManagePermissionsEditorObjectTableProps {
  columns: ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>[];
  rows: PermissionTableObjectCell[];
  totalCount: number;
  filterText?: string;
  /** True when any row has a save error - gates the "errors only" toggle in the filter row */
  hasErrors?: boolean;
  errorsOnly?: boolean;
  onFilter: (value: string) => void;
  onToggleErrorsOnly?: (value: boolean) => void;
  onBulkUpdate: (rows: PermissionTableObjectCell[], indexes?: number[]) => void;
  onDirtyRows?: (values: Record<string, DirtyRow<PermissionTableObjectCell>>) => void;
}

export const ManagePermissionsEditorObjectTable = forwardRef<any, ManagePermissionsEditorObjectTableProps>(
  ({ columns, rows, totalCount, filterText, hasErrors, errorsOnly, onFilter, onToggleErrorsOnly, onBulkUpdate, onDirtyRows }, ref) => {
    const tableRef = useRef<DataTableRef<PermissionTableObjectCell>>(null);
    // One table-level live region announces summary-cell column actions for every column
    const { announce, announcer } = useAnnouncer();
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
      [onBulkUpdate],
    );

    // Paste (and Delete-to-clear) over the permission checkboxes: coerce each pasted string to a
    // boolean and apply it through the same helpers as a checkbox click. The grid already restricted
    // the target cells to editable ones (mirroring the checkboxes' disabled rules).
    const handlePaste = useCallback(
      (event: { cells: { rowKey: string; columnKey: string; value: string }[] }) => {
        const visibleRows = [...(tableRef.current?.getFilteredAndSortedRows() || rows)];
        onBulkUpdate(applyPastedPermissionCells('object', visibleRows, event.cells));
      },
      [rows, onBulkUpdate],
    );

    return (
      <div>
        {announcer}
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
          <DataTable
            ref={tableRef}
            columns={columns as any}
            data={rows}
            getRowKey={getRowKey}
            topSummaryRows={SUMMARY_ROWS}
            onRowsChange={handleRowsChange}
            onPaste={handlePaste}
            context={
              {
                type: 'object',
                totalCount,
                filterValue: filterText,
                hasErrors,
                errorsOnly,
                onFilterRows: onFilter,
                onToggleErrorsOnly,
                onColumnAction: handleColumnAction,
                onBulkAction: onBulkUpdate,
                announce,
              } as PermissionManagerTableContext
            }
            rowHeight={24}
            summaryRowHeight={38}
          />
        </AutoFullHeightContainer>
      </div>
    );
  },
);

export default ManagePermissionsEditorObjectTable;

import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import {
  DirtyRow,
  ManagePermissionsEditorTableRef,
  PermissionManagerTableContext,
  PermissionTableSummaryRow,
  PermissionTableSystemPermissionCell,
  SystemPermissionTypes,
} from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable, DataTableRef, useAnnouncer } from '@jetstream/ui';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { applyPastedPermissionCells, resetGridChanges, updateRowsFromColumnAction } from './utils/permission-manager-table-utils';

function getRowKey(row: PermissionTableSystemPermissionCell) {
  return row.key;
}

// summary row is just a placeholder for rendered content
const SUMMARY_ROWS: PermissionTableSummaryRow[] = [{ type: 'HEADING' }, { type: 'ACTION' }];

export interface ManagePermissionsEditorSystemPermissionTableProps {
  columns: ColumnWithFilter<PermissionTableSystemPermissionCell, PermissionTableSummaryRow>[];
  rows: PermissionTableSystemPermissionCell[];
  totalCount: number;
  filterText?: string;
  /** True when any row has a save error - gates the "errors only" toggle in the filter row */
  hasErrors?: boolean;
  errorsOnly?: boolean;
  onFilter: (value: string) => void;
  onToggleErrorsOnly?: (value: boolean) => void;
  onBulkUpdate: (rows: PermissionTableSystemPermissionCell[], indexes?: number[]) => void;
  onDirtyRows?: (values: Record<string, DirtyRow<PermissionTableSystemPermissionCell>>) => void;
}

export const ManagePermissionsEditorSystemPermissionTable = forwardRef<any, ManagePermissionsEditorSystemPermissionTableProps>(
  ({ columns, rows, totalCount, filterText, hasErrors, errorsOnly, onFilter, onToggleErrorsOnly, onBulkUpdate, onDirtyRows }, ref) => {
    const tableRef = useRef<DataTableRef<PermissionTableSystemPermissionCell>>(null);
    // One table-level live region announces summary-cell column actions for every column
    const { announce, announcer } = useAnnouncer();
    const [dirtyRows, setDirtyRows] = useState<Record<string, DirtyRow<PermissionTableSystemPermissionCell>>>({});

    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        resetGridChanges({ rows, type: 'systemPermission' });
        setDirtyRows({});
      },
    }));

    useNonInitialEffect(() => {
      dirtyRows && onDirtyRows && onDirtyRows(dirtyRows);
    }, [dirtyRows, onDirtyRows]);

    function handleColumnAction(action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) {
      const [id, typeLabel] = columnKey.split('-');
      const visibleRows = [...(tableRef.current?.getFilteredAndSortedRows() || rows)];
      onBulkUpdate(updateRowsFromColumnAction('systemPermission', action, typeLabel as SystemPermissionTypes, id, visibleRows));
    }

    const handleRowsChange = useCallback(
      (rows: PermissionTableSystemPermissionCell[], { indexes }: { indexes: number[] }) => {
        // only forward the actually-edited rows so dependency cascading + dirty recompute stay scoped to
        // the touched row(s) + cascade targets rather than the entire (potentially large) permission set
        onBulkUpdate(indexes.map((index) => rows[index]));
      },
      [onBulkUpdate],
    );

    // Paste (and Delete-to-clear) over the permission checkboxes: coerce each pasted string to a
    // boolean and apply it through the same helpers as a checkbox click. The grid already restricted
    // the target cells to editable ones (mirroring the checkboxes' disabled rules).
    const handlePaste = useCallback(
      (event: { cells: { rowKey: string; columnKey: string; value: string }[] }) => {
        const visibleRows = [...(tableRef.current?.getFilteredAndSortedRows() || rows)];
        onBulkUpdate(applyPastedPermissionCells('systemPermission', visibleRows, event.cells));
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
                type: 'systemPermission',
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

export default ManagePermissionsEditorSystemPermissionTable;

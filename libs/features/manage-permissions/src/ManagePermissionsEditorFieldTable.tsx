import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import {
  DirtyRow,
  FieldPermissionTypes,
  ManagePermissionsEditorTableRef,
  PermissionManagerTableContext,
  PermissionTableFieldCell,
  PermissionTableSummaryRow,
} from '@jetstream/types';
import type { RowHeightArgs } from '@jetstream/ui';
import { AutoFullHeightContainer, ColumnWithFilter, DataTableRef, DataTree, useAnnouncer } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  applyPastedPermissionCells,
  getFieldPermissionContextMenuItems,
  handleFieldPermissionContextMenuAction,
  resetGridChanges,
  updateRowsFromColumnAction,
} from './utils/permission-manager-table-utils';

function getRowKey(row: PermissionTableFieldCell) {
  return row.key;
}

function getRowHeight({ type }: RowHeightArgs<PermissionTableFieldCell>) {
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
  totalCount: number;
  filterText?: string;
  /** True when any row has a save error - gates the "errors only" toggle in the filter row */
  hasErrors?: boolean;
  errorsOnly?: boolean;
  onFilter: (value: string) => void;
  onToggleErrorsOnly?: (value: boolean) => void;
  onBulkUpdate: (rows: PermissionTableFieldCell[], indexes?: number[]) => void;
  onDirtyRows?: (values: Record<string, DirtyRow<PermissionTableFieldCell>>) => void;
}

export const ManagePermissionsEditorFieldTable = forwardRef<any, ManagePermissionsEditorFieldTableProps>(
  ({ columns, rows, totalCount, filterText, hasErrors, errorsOnly, onFilter, onToggleErrorsOnly, onDirtyRows, onBulkUpdate }, ref) => {
    const tableRef = useRef<DataTableRef<PermissionTableFieldCell>>(null);
    // One table-level live region announces summary-cell column actions for every column
    const { announce, announcer } = useAnnouncer();
    const [dirtyRows, setDirtyRows] = useState<Record<string, DirtyRow<PermissionTableFieldCell>>>({});
    const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set<any>(rows.map((row) => row.sobject)));

    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        resetGridChanges({ rows, type: 'field' });
        setDirtyRows({});
      },
    }));

    useNonInitialEffect(() => {
      dirtyRows && onDirtyRows && onDirtyRows(dirtyRows);
    }, [dirtyRows, onDirtyRows]);

    function handleColumnAction(action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) {
      const [id, typeLabel] = columnKey.split('-');
      const visibleRows = [...(tableRef.current?.getFilteredAndSortedRows() || rows)];
      onBulkUpdate(updateRowsFromColumnAction('field', action, typeLabel as FieldPermissionTypes, id, visibleRows));
    }

    const handleRowsChange = useCallback(
      (rows: PermissionTableFieldCell[], { indexes }: { indexes: number[] }) => {
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
        onBulkUpdate(applyPastedPermissionCells('field', visibleRows, event.cells));
      },
      [rows, onBulkUpdate],
    );

    return (
      <div>
        {announcer}
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
          <DataTree
            ref={tableRef}
            columns={columns as any}
            data={rows}
            getRowKey={getRowKey}
            topSummaryRows={SUMMARY_ROWS}
            onRowsChange={handleRowsChange}
            onPaste={handlePaste}
            context={
              {
                type: 'field',
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
            rowHeight={getRowHeight}
            summaryRowHeight={38}
            groupBy={groupedRows}
            rowGrouper={groupBy}
            expandedGroupIds={expandedGroupIds}
            onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
            contextMenuItems={getFieldPermissionContextMenuItems}
            contextMenuAction={handleFieldPermissionContextMenuAction}
          />
        </AutoFullHeightContainer>
      </div>
    );
  },
);

export default ManagePermissionsEditorFieldTable;

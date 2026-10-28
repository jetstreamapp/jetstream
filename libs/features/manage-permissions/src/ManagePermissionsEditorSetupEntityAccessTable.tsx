import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import {
  DirtyRow,
  ManagePermissionsEditorTableRef,
  PermissionManagerTableContext,
  PermissionTableSetupEntityAccessCell,
  PermissionTableSummaryRow,
  SetupEntityAccessPermissionTypes,
  SetupEntityAccessType,
} from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable, DataTableRef } from '@jetstream/ui';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { applyPastedPermissionCells, resetGridChanges, updateRowsFromColumnAction } from './utils/permission-manager-table-utils';
import { SETUP_ENTITY_ACCESS_CATALOGS } from './utils/setup-entity-access-utils';

function getRowKey(row: PermissionTableSetupEntityAccessCell) {
  return row.key;
}

// summary row is just a placeholder for rendered content
const SUMMARY_ROWS: PermissionTableSummaryRow[] = [{ type: 'HEADING' }, { type: 'ACTION' }];

export interface ManagePermissionsEditorSetupEntityAccessTableProps {
  setupEntityType: SetupEntityAccessType;
  columns: ColumnWithFilter<PermissionTableSetupEntityAccessCell, PermissionTableSummaryRow>[];
  rows: PermissionTableSetupEntityAccessCell[];
  totalCount: number;
  filterText?: string;
  /** True when any row has a save error - gates the "errors only" toggle in the filter row */
  hasErrors?: boolean;
  errorsOnly?: boolean;
  onFilter: (value: string) => void;
  onToggleErrorsOnly?: (value: boolean) => void;
  onBulkUpdate: (rows: PermissionTableSetupEntityAccessCell[], indexes?: number[]) => void;
  onDirtyRows?: (values: Record<string, DirtyRow<PermissionTableSetupEntityAccessCell>>) => void;
}

/**
 * One checkbox per profile / permission set for each setup entity (custom permission, ...). Shared by every setup
 * entity type: the only per-type difference is what a row is called, which comes from the catalog.
 */
export const ManagePermissionsEditorSetupEntityAccessTable = forwardRef<any, ManagePermissionsEditorSetupEntityAccessTableProps>(
  (
    {
      setupEntityType,
      columns,
      rows,
      totalCount,
      filterText,
      hasErrors,
      errorsOnly,
      onFilter,
      onToggleErrorsOnly,
      onBulkUpdate,
      onDirtyRows,
    },
    ref,
  ) => {
    const tableRef = useRef<DataTableRef<PermissionTableSetupEntityAccessCell>>(null);
    const [dirtyRows, setDirtyRows] = useState<Record<string, DirtyRow<PermissionTableSetupEntityAccessCell>>>({});
    const rowLabel = SETUP_ENTITY_ACCESS_CATALOGS[setupEntityType].label;

    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        resetGridChanges({ rows, type: 'setupEntityAccess' });
        setDirtyRows({});
      },
    }));

    useNonInitialEffect(() => {
      dirtyRows && onDirtyRows && onDirtyRows(dirtyRows);
    }, [dirtyRows, onDirtyRows]);

    function handleColumnAction(action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) {
      const [id, typeLabel] = columnKey.split('-');
      const visibleRows = [...(tableRef.current?.getFilteredAndSortedRows() || rows)];
      onBulkUpdate(updateRowsFromColumnAction('setupEntityAccess', action, typeLabel as SetupEntityAccessPermissionTypes, id, visibleRows));
    }

    const handleRowsChange = useCallback(
      (rows: PermissionTableSetupEntityAccessCell[], { indexes }: { indexes: number[] }) => {
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
        onBulkUpdate(applyPastedPermissionCells('setupEntityAccess', visibleRows, event.cells));
      },
      [rows, onBulkUpdate],
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
            onPaste={handlePaste}
            context={
              {
                type: 'setupEntityAccess',
                rowLabel,
                totalCount,
                filterValue: filterText,
                hasErrors,
                errorsOnly,
                onFilterRows: onFilter,
                onToggleErrorsOnly,
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
  },
);

export default ManagePermissionsEditorSetupEntityAccessTable;

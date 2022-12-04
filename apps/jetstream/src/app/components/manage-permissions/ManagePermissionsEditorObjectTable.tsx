import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable } from '@jetstream/ui';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { resetGridChanges, updateRowsFromColumnAction } from './utils/permission-manager-table-utils';
import {
  DirtyRow,
  FieldPermissionTypes,
  ManagePermissionsEditorTableRef,
  PermissionTableObjectCell,
  PermissionTableSummaryRow,
} from './utils/permission-manager-types';
import { RowHeightArgs } from 'react-data-grid';

function getRowKey(row: PermissionTableObjectCell) {
  return row.key;
}

function getRowHeight({ type, row }: RowHeightArgs<PermissionTableObjectCell>) {
  if (type === 'ROW') {
    return 24;
  }
  return 34;
}

// summary row is just a placeholder for rendered content
const SUMMARY_ROWS: PermissionTableSummaryRow[] = [{ type: 'HEADING' }, { type: 'ACTION' }];

export interface ManagePermissionsEditorObjectTableProps {
  columns: ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>[];
  rows: PermissionTableObjectCell[];
  onBulkUpdate: (rows: PermissionTableObjectCell[], indexes?: number[]) => void;
  onDirtyRows?: (values: MapOf<DirtyRow<PermissionTableObjectCell>>) => void;
}

export const ManagePermissionsEditorObjectTable = forwardRef<any, ManagePermissionsEditorObjectTableProps>(
  ({ columns, rows, onBulkUpdate, onDirtyRows }, ref) => {
    const [dirtyRows, setDirtyRows] = useState<MapOf<DirtyRow<PermissionTableObjectCell>>>({});
    // const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set<any>(rows.map((row) => row.sobject)));

    // FIXME: figure out what we do and do not need here
    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        resetGridChanges({ rows, type: 'object' });
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
      onBulkUpdate(updateRowsFromColumnAction('object', action, typeLabel as FieldPermissionTypes, id, rows));
    }

    const handleRowsChange = useCallback(
      (rows: PermissionTableObjectCell[], { indexes }) => {
        onBulkUpdate(rows, indexes);
      },
      [onBulkUpdate]
    );

    return (
      <div>
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
          <DataTable
            columns={columns}
            data={rows}
            getRowKey={getRowKey}
            topSummaryRows={SUMMARY_ROWS}
            onRowsChange={handleRowsChange}
            context={{ type: 'field', onColumnAction: handleColumnAction, onBulkAction: onBulkUpdate }}
            rowHeight={getRowHeight}
            summaryRowHeight={38}
            // groupBy={groupedRows}
            // rowGrouper={groupBy}
            // expandedGroupIds={expandedGroupIds}
            // onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
          />
        </AutoFullHeightContainer>
      </div>
    );
  }
);

export default ManagePermissionsEditorObjectTable;

import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable } from '@jetstream/ui';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { resetGridChanges, updateRowsFromColumnAction } from './utils/permission-manager-table-utils';
import {
  DirtyRow,
  FieldPermissionTypes,
  ManagePermissionsEditorTableRef,
  PermissionManagerTableContext,
  PermissionTableSummaryRow,
  PermissionTableTabVisibilityCell,
} from './utils/permission-manager-types';

function getRowKey(row: PermissionTableTabVisibilityCell) {
  return row.key;
}

// summary row is just a placeholder for rendered content
const SUMMARY_ROWS: PermissionTableSummaryRow[] = [{ type: 'HEADING' }, { type: 'ACTION' }];

export interface ManagePermissionsEditorTabVisibilityTableProps {
  columns: ColumnWithFilter<PermissionTableTabVisibilityCell, PermissionTableSummaryRow>[];
  rows: PermissionTableTabVisibilityCell[];
  totalCount: number;
  onFilter: (value: string) => void;
  onBulkUpdate: (rows: PermissionTableTabVisibilityCell[], indexes?: number[]) => void;
  onDirtyRows?: (values: MapOf<DirtyRow<PermissionTableTabVisibilityCell>>) => void;
}

export const ManagePermissionsEditorTabVisibilityTable = forwardRef<any, ManagePermissionsEditorTabVisibilityTableProps>(
  ({ columns, rows, totalCount, onFilter, onBulkUpdate, onDirtyRows }, ref) => {
    const [dirtyRows, setDirtyRows] = useState<MapOf<DirtyRow<PermissionTableTabVisibilityCell>>>({});

    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        resetGridChanges({ rows, type: 'tabVisibility' });
        setDirtyRows({});
      },
    }));

    useNonInitialEffect(() => {
      dirtyRows && onDirtyRows && onDirtyRows(dirtyRows);
    }, [dirtyRows, onDirtyRows]);

    function handleColumnAction(action: 'selectAll' | 'unselectAll' | 'reset', columnKey: string) {
      const [id, typeLabel] = columnKey.split('-');
      onBulkUpdate(updateRowsFromColumnAction('tabVisibility', action, typeLabel as FieldPermissionTypes, id, rows));
    }

    const handleRowsChange = useCallback(
      (rows: PermissionTableTabVisibilityCell[], { indexes }) => {
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
            context={
              {
                type: 'tabVisibility',
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

export default ManagePermissionsEditorTabVisibilityTable;

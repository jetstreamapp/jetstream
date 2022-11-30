import { GridApi } from '@ag-grid-community/core';

import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTableNew } from '@jetstream/ui';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { resetGridChanges } from './utils/permission-manager-table-utils';
import {
  DirtyRow,
  ManagePermissionsEditorTableRef,
  PermissionTableObjectCell,
  PermissionTableSummaryRow,
} from './utils/permission-manager-types';

function getRowKey(row: PermissionTableObjectCell) {
  return row.key;
}

export interface ManagePermissionsEditorObjectTableProps {
  columns: ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>[];
  rows: PermissionTableObjectCell[];
  onBulkUpdate: (rows: PermissionTableObjectCell[], indexes: number[]) => void;
  onDirtyRows?: (values: MapOf<DirtyRow<PermissionTableObjectCell>>) => void;
}

export const ManagePermissionsEditorObjectTable = forwardRef<any, ManagePermissionsEditorObjectTableProps>(
  ({ columns, rows, onBulkUpdate, onDirtyRows }, ref) => {
    const [gridApi, setGridApi] = useState<GridApi>(null);
    const [dirtyRows, setDirtyRows] = useState<MapOf<DirtyRow<PermissionTableObjectCell>>>({});

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

    return (
      <div>
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
          <DataTableNew
            columns={columns}
            data={rows}
            getRowKey={getRowKey}
            onRowsChange={(rows: PermissionTableObjectCell[], { indexes }) => onBulkUpdate(rows, indexes)}
          />
        </AutoFullHeightContainer>
      </div>
    );
  }
);

export default ManagePermissionsEditorObjectTable;

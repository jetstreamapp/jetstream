/** @jsx jsx */
import { ColDef, ColGroupDef, GridApi, GridReadyEvent, ICellRendererParams } from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { MapOf } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable } from '@jetstream/ui';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import * as fromPermissionsStateState from './manage-permissions.state';
import {
  getColumns,
  getDirtyPermissions,
  getRows,
  isFullWidthCell,
  PermissionTableFieldCell,
  PinnedLabelInputFilter,
  PinnedSelectAllRenderer,
  resetGridChanges,
  ManagePermissionsEditorTableRef,
  ErrorTooltipRenderer,
} from './utils/permission-manager-table-utils';
import { logger } from '@jetstream/shared/client-logger';

export interface ManagePermissionsEditorTableProps {
  fieldsByObject: MapOf<string[]>;
  onColumns: (columns: (ColDef | ColGroupDef)[]) => void;
  onRows: (rows: PermissionTableFieldCell[]) => void;
}

const pinnedSelectAllRow = {
  key: `pinned-select-all`,
  sobject: '',
  apiName: '',
  label: '',
  type: null,
  permissions: {},
};

export const ManagePermissionsEditorTable = forwardRef<any, ManagePermissionsEditorTableProps>(
  ({ fieldsByObject, onColumns, onRows }, ref) => {
    // TODO: move all this to parent and pass in as props
    const selectedProfiles = useRecoilValue(fromPermissionsStateState.selectedProfilesPermSetState);
    const selectedPermissionSets = useRecoilValue(fromPermissionsStateState.selectedPermissionSetsState);
    const selectedSObjects = useRecoilValue(fromPermissionsStateState.selectedSObjectsState);
    const profilesById = useRecoilValue(fromPermissionsStateState.profilesByIdSelector);
    const permissionSetsById = useRecoilValue(fromPermissionsStateState.permissionSetsByIdSelector);
    const objectPermissionMap = useRecoilValue(fromPermissionsStateState.objectPermissionMap);
    const fieldPermissionMap = useRecoilValue(fromPermissionsStateState.fieldPermissionMap);

    const [columns, setColumns] = useState<(ColDef | ColGroupDef)[]>([]);
    const [rows, setRows] = useState<PermissionTableFieldCell[]>([]);
    const [gridApi, setGridApi] = useState<GridApi>(null);

    useImperativeHandle<any, ManagePermissionsEditorTableRef>(ref, () => ({
      resetChanges() {
        if (gridApi) {
          resetGridChanges(gridApi);
        }
      },
      getDirtyPermissionsForSave() {
        return getDirtyPermissions(gridApi);
      },
    }));

    useEffect(() => {
      const columns = getColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById);
      const rows = getRows(selectedSObjects, fieldsByObject, fieldPermissionMap);
      logger.log('[PERM TABLE]', { columns, rows });
      setColumns(columns);
      setRows(rows);
      onColumns(columns);
      onRows(rows);
      // only run on first render
    }, []);

    useNonInitialEffect(() => {
      setRows(getRows(selectedSObjects, fieldsByObject, fieldPermissionMap));
      // only run on first render
    }, [fieldPermissionMap]);

    function handleOnGridReady({ api }: GridReadyEvent) {
      setGridApi(api);
    }

    return (
      <div>
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
          <DataTable
            columns={columns}
            data={rows}
            frameworkComponents={{
              pinnedInputFilter: PinnedLabelInputFilter,
              pinnedSelectAllRenderer: PinnedSelectAllRenderer,
              errorTooltipRenderer: ErrorTooltipRenderer,
            }}
            agGridProps={{
              pinnedTopRowData: [pinnedSelectAllRow],
              suppressRowClickSelection: true,
              headerHeight: 25,
              gridOptions: {
                context: {
                  isReadOnly: ({ node, column, colDef, context }: ICellRendererParams) => {
                    if (colDef.colId.endsWith('edit')) {
                      const data = node.data as PermissionTableFieldCell;
                      return !data.allowEditPermission;
                    }
                    return false;
                  },
                  additionalComponent: ErrorTooltipRenderer,
                },
                immutableData: true,
                getRowNodeId: (data: PermissionTableFieldCell) => data.key,
                isFullWidthCell: isFullWidthCell,
                fullWidthCellRenderer: 'fullWidthRenderer',
                defaultColDef: {
                  filter: true,
                  sortable: false,
                  resizable: true,
                },
              },
              getRowHeight: ({ node }) => {
                if (node.rowPinned) {
                  return 35;
                }
              },
              onCellDoubleClicked: undefined,
              onCellKeyDown: undefined,
              onGridReady: handleOnGridReady,
            }}
          />
        </AutoFullHeightContainer>
      </div>
    );
  }
);

export default ManagePermissionsEditorTable;

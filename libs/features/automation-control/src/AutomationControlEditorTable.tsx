import { ContextMenuItem, SalesforceOrgUi } from '@jetstream/types';
import {
  ColumnWithFilter,
  ContextAction,
  ContextMenuActionData,
  DataTable,
  RowWithKey,
  TABLE_CONTEXT_MENU_ITEMS,
  copyGenericTableDataToClipboard,
  setColumnFromType,
} from '@jetstream/ui';
import { forwardRef, useCallback, useMemo } from 'react';
import { isTableRow } from './automation-control-data-utils';
import { AdditionalDetailRenderer, ExpandingLabelRenderer, LoadingAndActiveRenderer } from './automation-control-table-renderers';
import { TableRowOrItemOrChild } from './automation-control-types';

const getRowHeight = (row: TableRowOrItemOrChild) => {
  if (isTableRow(row)) {
    return 28.5;
  }
  if (row.additionalData.length > 1) {
    return row.additionalData.length * 28.5;
  }
  return 28.5;
};

const getRowClass = (row: TableRowOrItemOrChild) => {
  if (isTableRow(row) && !row.loading) {
    return 'bg-color-gray-light';
  }
  return undefined;
};

const getRowId = ({ key }: TableRowOrItemOrChild) => key;

export interface AutomationControlEditorTableProps {
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  selectedOrg: SalesforceOrgUi;
  rows: TableRowOrItemOrChild[];
  quickFilterText?: string | null;
  toggleRowExpand: (row: TableRowOrItemOrChild, value: boolean) => void;
  updateIsActiveFlag: (row: TableRowOrItemOrChild, value: boolean) => void;
  onSortedAndFilteredRowsChange: (rows: readonly TableRowOrItemOrChild[]) => void;
}

export const AutomationControlEditorTable = forwardRef<any, AutomationControlEditorTableProps>(
  (
    {
      serverUrl,
      skipFrontdoorLogin,
      selectedOrg,
      rows,
      quickFilterText,
      toggleRowExpand,
      updateIsActiveFlag,
      onSortedAndFilteredRowsChange,
    },
    ref,
  ) => {
    const columns = useMemo(() => {
      return [
        {
          ...setColumnFromType('label', 'text'),
          name: 'Automation Item',
          key: 'label',
          width: 400,
          renderCell: ({ column, row }) => {
            return (
              <ExpandingLabelRenderer
                serverUrl={serverUrl}
                selectedOrg={selectedOrg}
                column={column}
                row={row}
                toggleRowExpand={toggleRowExpand}
              />
            );
          },
        },
        {
          ...setColumnFromType('sobject', 'text'),
          name: 'Object',
          key: 'sobject',
          width: 200,
        },
        {
          ...setColumnFromType('isActive', 'boolean'),
          name: 'Active',
          key: 'isActive',
          width: 110,
          cellClass: (row) => (!isTableRow(row) && row.isActive !== row.isActiveInitialState ? 'active-item-yellow-bg' : ''),
          renderCell: ({ row }) => {
            return <LoadingAndActiveRenderer row={row} updateIsActiveFlag={updateIsActiveFlag} />;
          },
        },
        {
          name: 'Description',
          key: 'description',
          width: 400,
        },
        {
          ...setColumnFromType('lastModifiedBy', 'text'),
          name: 'Last Modified',
          key: 'lastModifiedBy',
          width: 250,
        },
        {
          name: 'Additional Information',
          key: 'additionalInfo',
          width: 1000,
          filters: null,
          sortable: false,
          renderCell: AdditionalDetailRenderer,
        },
      ] as ColumnWithFilter<TableRowOrItemOrChild>[];
    }, [serverUrl, selectedOrg, toggleRowExpand, updateIsActiveFlag]);

    const fields = useMemo(() => columns.map((col) => col.key), [columns]);

    const handleContextMenuAction = useCallback(
      (item: ContextMenuItem<ContextAction>, data: ContextMenuActionData<RowWithKey>) => {
        copyGenericTableDataToClipboard(item.value, fields, data);
      },
      [fields],
    );

    return (
      <div className="h-100">
        <DataTable
          serverUrl={serverUrl}
          skipFrontdoorLogin={skipFrontdoorLogin}
          org={selectedOrg}
          data={rows}
          columns={columns}
          rowClass={getRowClass}
          includeQuickFilter
          quickFilterText={quickFilterText}
          rowHeight={getRowHeight}
          defaultColumnOptions={{ resizable: true }}
          getRowKey={getRowId}
          ignoreRowInSetFilter={isTableRow}
          rowAlwaysVisible={isTableRow}
          onSortedAndFilteredRowsChange={onSortedAndFilteredRowsChange}
          contextMenuItems={TABLE_CONTEXT_MENU_ITEMS}
          contextMenuAction={handleContextMenuAction}
        />
      </div>
    );
  },
);

export default AutomationControlEditorTable;

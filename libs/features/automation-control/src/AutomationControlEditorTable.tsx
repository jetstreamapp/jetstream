import { ensureBoolean } from '@jetstream/shared/utils';
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
import { ReactNode, forwardRef, useCallback, useMemo } from 'react';
import { isTableRow, isTableRowItem } from './automation-control-data-utils';
import { AdditionalDetailRenderer, ExpandingLabelRenderer, LoadingAndActiveRenderer } from './automation-control-table-renderers';
import { TableRowOrItemOrChild } from './automation-control-types';

const getRowHeight = ({ row }: { type: 'ROW' | 'GROUP'; row: TableRowOrItemOrChild }) => {
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
  getSubRows: (row: TableRowOrItemOrChild, index: number) => TableRowOrItemOrChild[] | undefined;
  quickFilterText?: string | null;
  updateIsActiveFlag: (row: TableRowOrItemOrChild, value: boolean) => void;
  onSortedAndFilteredRowsChange: (rows: readonly TableRowOrItemOrChild[]) => void;
}

export const AutomationControlEditorTable = forwardRef<any, AutomationControlEditorTableProps>(
  (
    { serverUrl, skipFrontdoorLogin, selectedOrg, rows, getSubRows, quickFilterText, updateIsActiveFlag, onSortedAndFilteredRowsChange },
    ref,
  ) => {
    const columns = useMemo(() => {
      return [
        {
          ...setColumnFromType('label', 'text'),
          name: 'Automation Item',
          key: 'label',
          width: 400,
          renderCell: ({ row, value, depth, canExpand, isExpanded, toggleExpanded }) => {
            return (
              <ExpandingLabelRenderer
                serverUrl={serverUrl}
                selectedOrg={selectedOrg}
                row={row}
                value={value as ReactNode}
                depth={depth}
                canExpand={canExpand}
                isExpanded={isExpanded}
                toggleExpanded={toggleExpanded}
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
          // Paste/clear eligibility only (no popup editor): pasted true/false values land on the same
          // rows whose checkbox is enabled — never category rows or read-only items.
          editable: (row: TableRowOrItemOrChild) => !isTableRow(row) && !(isTableRowItem(row) && row.readOnly),
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
    }, [serverUrl, selectedOrg, updateIsActiveFlag]);

    const fields = useMemo(() => columns.map((col) => col.key), [columns]);

    // Paste (and Delete-to-clear) over the Active column: coerce each pasted string to a boolean and
    // route it through the same flow as a checkbox click. The grid already restricted the target cells
    // to editable (non-category, non-read-only) rows.
    const handlePaste = useCallback(
      ({ cells }: { cells: { rowKey: string; columnKey: string; value: string }[] }) => {
        const rowByKey = new Map<string, TableRowOrItemOrChild>();
        const visit = (row: TableRowOrItemOrChild) => {
          rowByKey.set(row.key, row);
          getSubRows(row, 0)?.forEach(visit);
        };
        rows.forEach(visit);
        cells.forEach(({ rowKey, columnKey, value }) => {
          const row = rowByKey.get(rowKey);
          if (row && columnKey === 'isActive') {
            updateIsActiveFlag(row, ensureBoolean(value.trim()));
          }
        });
      },
      [rows, getSubRows, updateIsActiveFlag],
    );

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
          getSubRows={getSubRows}
          defaultExpanded
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
          onPaste={handlePaste}
        />
      </div>
    );
  },
);

export default AutomationControlEditorTable;

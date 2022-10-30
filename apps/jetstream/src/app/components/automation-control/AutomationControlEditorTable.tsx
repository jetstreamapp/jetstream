import { SalesforceOrgUi } from '@jetstream/types';
import { DataTableNew } from '@jetstream/ui';
import { ColumnWithFilter } from 'libs/ui/src/lib/data-table-new/data-table-types';
import { forwardRef, useMemo } from 'react';
import { RowHeightArgs } from 'react-data-grid';
import { isTableRow } from './automation-control-data-utils';
import { AdditionalDetailRenderer, ExpandingLabelRenderer, LoadingAndActiveRenderer } from './automation-control-table-renderers';
import { TableRowOrItemOrChild } from './automation-control-types';

const getRowHeight = ({ row, type }: RowHeightArgs<TableRowOrItemOrChild>) => {
  if (type === 'GROUP' || isTableRow(row)) {
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
  selectedOrg: SalesforceOrgUi;
  rows: TableRowOrItemOrChild[];
  quickFilterText: string;
  toggleRowExpand: (row: TableRowOrItemOrChild, value: boolean) => void;
  updateIsActiveFlag: (row: TableRowOrItemOrChild, value: boolean) => void;
}

export const AutomationControlEditorTable = forwardRef<any, AutomationControlEditorTableProps>(
  ({ serverUrl, selectedOrg, rows, quickFilterText, toggleRowExpand, updateIsActiveFlag }, ref) => {
    const columns = useMemo(() => {
      return [
        {
          name: 'Automation Item',
          key: 'label',
          width: 400,
          formatter: ({ column, row }) => {
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
          name: 'Object',
          key: 'sobject',
          width: 200,
        },
        {
          name: 'Active',
          key: 'isActive',
          width: 110,
          cellClass: (row) => (!isTableRow(row) && row.isActive !== row.isActiveInitialState ? 'active-item-yellow-bg' : ''),
          formatter: ({ row }) => {
            return <LoadingAndActiveRenderer row={row} updateIsActiveFlag={updateIsActiveFlag} />;
          },
        },
        {
          name: 'Description',
          key: 'description',
          width: 400,
        },
        {
          name: 'Last Modified',
          key: 'lastModifiedBy',
          width: 250,
        },
        {
          name: 'Additional Information',
          key: 'additionalInfo',
          width: 400,
          filters: null,
          sortable: false,
          formatter: AdditionalDetailRenderer,
        },
      ] as ColumnWithFilter<TableRowOrItemOrChild>[];
    }, []);

    return (
      <div className="h-100">
        <DataTableNew
          serverUrl={serverUrl}
          org={selectedOrg}
          data={rows}
          columns={columns}
          getRowKey={getRowId}
          rowClass={getRowClass}
          includeQuickFilter
          quickFilterText={quickFilterText}
          rowHeight={getRowHeight}
          defaultColumnOptions={{ resizable: true }}
        />
      </div>
    );
  }
);

export default AutomationControlEditorTable;

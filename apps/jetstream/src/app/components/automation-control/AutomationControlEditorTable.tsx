import { ColDef, GetRowIdParams, RowHeightParams } from '@ag-grid-community/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { DataTable } from '@jetstream/ui';
import { forwardRef } from 'react';
import { getAutomationTypeLabel, isTableRow, isTableRowChild, isTableRowItem } from './automation-control-data-utils';
import { AdditionalDetailRenderer, LoadingAndActiveRenderer } from './automation-control-table-renderers';
import { TableRowOrItemOrChild } from './automation-control-types';

const COLUMNS: ColDef[] = [
  {
    headerName: 'Object',
    colId: 'sobject',
    field: 'sobject',
    width: 200,
  },
  {
    headerName: 'Active',
    colId: 'isActive',
    cellRenderer: 'loadingAndActiveRenderer',
    width: 110,
    cellClassRules: {
      'active-item-yellow-bg': ({ data }) => !isTableRow(data) && data.isActive !== data.isActiveInitialState,
    },
    filterValueGetter: ({ data }) => (!isTableRow(data) ? data.isActive : null),
  },
  {
    headerName: 'Description',
    colId: 'description',
    field: 'description',
    tooltipField: 'description',
    width: 400,
  },
  {
    headerName: 'Last Modified',
    colId: 'lastModifiedBy',
    field: 'lastModifiedBy',
    tooltipField: 'lastModifiedBy',
    width: 250,
  },
  {
    headerName: 'Additional Information',
    colId: 'additionalInfo',
    cellRenderer: 'additionalDetailRenderer',
    width: 400,
    filter: null,
    menuTabs: [],
    sortable: false,
  },
];

const getRowHeight = (params: RowHeightParams) => {
  if (isTableRow(params.data)) {
    return null;
  }
  if (params.data.additionalData.length > 1) {
    return params.data.additionalData.length * 27.5;
  }
  return null;
};
const getRowId = ({ data }: GetRowIdParams) => data.key;

export interface AutomationControlEditorTableProps {
  serverUrl: string;
  selectedOrg: SalesforceOrgUi;
  rows: TableRowOrItemOrChild[];
  quickFilterText: string;
  updateIsActiveFlag: (row: TableRowOrItemOrChild, value: boolean) => void;
}

export const AutomationControlEditorTable = forwardRef<any, AutomationControlEditorTableProps>(
  ({ serverUrl, selectedOrg, rows, quickFilterText, updateIsActiveFlag }, ref) => {
    return (
      <div className="h-100">
        <DataTable
          columns={COLUMNS}
          data={rows}
          agGridProps={{
            context: {
              serverUrl,
              selectedOrg,
              updateIsActiveFlag,
            },
            getRowId,
            autoGroupColumnDef: {
              headerName: 'Automation Item',
              width: 400,
              filterValueGetter: ({ data }) => {
                if (isTableRowItem(data) || isTableRowChild(data)) {
                  return `${getAutomationTypeLabel(data.type)} ${data.label}`;
                }
                return null;
              },
              cellRendererParams: {
                suppressCount: true,
                // This causes the table to "blink" each time a row is selected.
                // TODO: once reactUi is fixed (AG-6233) This might be solved
                // innerRenderer: 'treeItemWithLinkRenderer',
              },
            },
            treeData: true,
            getDataPath: (data) => data.path,
            groupDefaultExpanded: -1,
            enableRangeSelection: false,
            suppressCellFocus: true,
            suppressRowClickSelection: true,
            enableCellTextSelection: true,
            excludeChildrenWhenTreeDataFiltering: true,
            quickFilterText,
            ensureDomOrder: true,
            components: {
              loadingAndActiveRenderer: LoadingAndActiveRenderer,
              additionalDetailRenderer: AdditionalDetailRenderer,
              // treeItemWithLinkRenderer: TreeItemWithLinkRenderer,
            },
            getRowHeight,
          }}
        />
      </div>
    );
  }
);

export default AutomationControlEditorTable;

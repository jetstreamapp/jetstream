import { ColDef, ColumnApi, GridApi, GridReadyEvent, RowHeightParams } from '@ag-grid-community/core';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { DataTable } from '@jetstream/ui';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { isTableRow, isTableRowChild } from './automation-control-data-utils';
import { AdditionalDetailRenderer, LoadingAndActiveRenderer, TreeItemWithLinkRenderer } from './automation-control-table-renderers';
import { AutomationMetadataType, TableEditorImperativeHandle, TableRowItem, TableRowOrItemOrChild } from './automation-control-types';
import { useAutomationControlData } from './useAutomationControlData';

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
  // TODO: use custom renderer and clamp to two lines to see if this provides room for more content.
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
  },
];

const getRowHeight = (params: RowHeightParams) => {
  return !isTableRow(params.data) && (params.data.description || params.data.additionalData.length > 1) ? 60 : null;
};
const getRowNodeId = ({ key }: TableRowOrItemOrChild) => key;

export interface AutomationControlEditorTableProps {
  serverUrl: string;
  selectedOrg: SalesforceOrgUi;
  rows: TableRowOrItemOrChild[];
  quickFilterText: string;
  updateIsActiveFlag: (row: TableRowOrItemOrChild, value: boolean) => void;
}

export const AutomationControlEditorTable = forwardRef<any, AutomationControlEditorTableProps>(
  ({ serverUrl, selectedOrg, rows, quickFilterText, updateIsActiveFlag }, ref) => {
    const [gridApi, setGridApi] = useState<GridApi>();
    const [gridColumnApi, setGridColumnApi] = useState<ColumnApi>();

    function handleGridReady(event: GridReadyEvent) {
      setGridApi(event.api);
      setGridColumnApi(event.columnApi);
    }

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
            immutableData: true,
            getRowNodeId,
            autoGroupColumnDef: {
              headerName: 'Automation Item',
              width: 400,
              filterValueGetter: ({ data }) => (!isTableRow(data) ? data.key : null),
              cellRendererParams: {
                suppressCount: true,
                innerRenderer: 'treeItemWithLinkRenderer',
              },
            },
            treeData: true,
            getDataPath: (data) => data.path,
            groupDefaultExpanded: -1,
            enableRangeSelection: false,
            suppressCellSelection: true,
            suppressRowClickSelection: true,
            enableCellTextSelection: true,
            excludeChildrenWhenTreeDataFiltering: true,
            quickFilterText,
            ensureDomOrder: true,
            frameworkComponents: {
              loadingAndActiveRenderer: LoadingAndActiveRenderer,
              additionalDetailRenderer: AdditionalDetailRenderer,
              treeItemWithLinkRenderer: TreeItemWithLinkRenderer,
            },
            getRowHeight,
            // rowSelection: '',
            // onSelectionChanged: handleSelectionChanged,
            onGridReady: handleGridReady,
          }}
        />
      </div>
    );
  }
);

export default AutomationControlEditorTable;

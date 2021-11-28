import { ColDef, ColumnApi, GridApi, GridReadyEvent, RowHeightParams } from '@ag-grid-community/core';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { DataTable } from '@jetstream/ui';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { isTableRow, isTableRowChild } from './automation-control-data-utils';
import { AdditionalDetailRenderer, LoadingAndActiveRenderer } from './automation-control-table-renderers';
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
  // defaultApiVersion: string;
  // selectedOrg: SalesforceOrgUi;
  // selectedSObjects: string[];
  // selectedAutomationTypes: AutomationMetadataType[];
  rows: TableRowOrItemOrChild[];
  quickFilterText: string;
  // onDirtyChanged: (isDirty: boolean) => void;
  // onLoading: (loading: boolean) => void;
  // loading: boolean;
  // fetchData: ;
  // refreshProcessBuilders: ;
  updateIsActiveFlag: (row: TableRowOrItemOrChild, value: boolean) => void;
  // resetChanges: ;
  // isDirty: ;
}

export const AutomationControlEditorTable = forwardRef<any, AutomationControlEditorTableProps>(
  ({ rows, quickFilterText, updateIsActiveFlag }, ref) => {
    const [gridApi, setGridApi] = useState<GridApi>();
    const [gridColumnApi, setGridColumnApi] = useState<ColumnApi>();
    // const { rows, loading, fetchData, refreshProcessBuilders, updateIsActiveFlag, resetChanges, isDirty } =
    //   useAutomationControlData({
    //     selectedOrg,
    //     defaultApiVersion,
    //     selectedSObjects,
    //     selectedAutomationTypes,
    //   });

    // useEffect(() => {
    //   onLoading(loading);
    // }, [loading, onLoading]);

    // useNonInitialEffect(() => {
    //   if (gridColumnApi && rows.length) {
    //     gridColumnApi.autoSizeColumns(['additionalInfo']);
    //   }
    // }, [rows, loading, gridColumnApi]);

    // useNonInitialEffect(() => {
    //   onDirtyChanged(isDirty);
    // }, [isDirty, onDirtyChanged]);

    // useImperativeHandle(
    //   ref,
    //   () => {
    //     const filterComp: TableEditorImperativeHandle = {
    //       resetChanges: () => {
    //         resetChanges();
    //       },
    //       getDirtyRows: () => {
    //         return rows.filter((row) => {
    //           if (isTableRow(row) || isTableRowChild(row)) {
    //             return false;
    //           }
    //           return row.isActive !== row.isActiveInitialState || row.activeVersionNumber !== row.activeVersionNumberInitialState;
    //         }) as TableRowItem[];
    //       },
    //       refreshAfterDeploy: () => {
    //         // items: DeploymentItem[]
    //         // TODO: update rows based on deployment results
    //         // return rows;
    //         // TODO: can we pass in Ids and just refresh those limited items?
    //         fetchData();
    //       },
    //       refreshProcessBuilders: () => {
    //         refreshProcessBuilders();
    //       },
    //     };
    //     return filterComp;
    //   },
    //   [fetchData, refreshProcessBuilders, resetChanges, rows]
    // );

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

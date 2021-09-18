/** @jsx jsx */
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { ColDef, GridOptions, ModuleRegistry } from '@ag-grid-community/core';
import { InfiniteRowModelModule } from '@ag-grid-community/infinite-row-model';
import { AgGridReact } from '@ag-grid-community/react';
import { ClipboardModule } from '@ag-grid-enterprise/clipboard';
import { ColumnsToolPanelModule } from '@ag-grid-enterprise/column-tool-panel';
import { FiltersToolPanelModule } from '@ag-grid-enterprise/filter-tool-panel';
import { MenuModule } from '@ag-grid-enterprise/menu';
import { MultiFilterModule } from '@ag-grid-enterprise/multi-filter';
import { RangeSelectionModule } from '@ag-grid-enterprise/range-selection';
import { RowGroupingModule } from '@ag-grid-enterprise/row-grouping';
import { SetFilterModule } from '@ag-grid-enterprise/set-filter';
import { jsx } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { CSSProperties, FunctionComponent } from 'react';
import './data-table-styles.css';
import { getContextMenuItems, handleCellDoubleClicked, handleCellKeydown, processCellForClipboard } from './data-table-utils';
import {
  ActionRenderer,
  BasicTextFilterRenderer,
  BasicTextFloatingFilterRenderer,
  BooleanEditableRenderer,
  BooleanFilterRenderer,
  BooleanRenderer,
  ComplexDataRenderer,
  configIdLinkRenderer,
  ExecuteRenderer,
  FullWidthRenderer,
  IdLinkRenderer,
  SubqueryRenderer,
} from './DataTableRenderers';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ClipboardModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  InfiniteRowModelModule,
  MenuModule,
  MultiFilterModule,
  RangeSelectionModule,
  RowGroupingModule,
  SetFilterModule,
]);

const DEFAULT_MENU_TABS = ['filterMenuTab', 'generalMenuTab', 'columnsMenuTab'];

export interface DataTableProps {
  style?: CSSProperties;
  columns: ColDef[];
  data: any[];
  agGridProps?: GridOptions;
  frameworkComponents?: any;
  quickFilterText?: string;
  serverUrl?: string;
  org?: SalesforceOrgUi;
  defaultMenuTabs?: string[];
}

export const DataTable: FunctionComponent<DataTableProps> = ({
  style = {
    height: '100%',
    width: '100%',
  },
  columns,
  data,
  agGridProps = {
    defaultColDef: {},
  },
  frameworkComponents = {},
  quickFilterText,
  serverUrl,
  org,
  defaultMenuTabs = DEFAULT_MENU_TABS,
}) => {
  if (serverUrl && org) {
    configIdLinkRenderer(serverUrl, org);
  }

  return (
    <div className="ag-theme-custom-react" style={style}>
      <AgGridReact
        // reactUi // TODO: enable at some point - seemed kinda sketchy
        rowSelection="multiple"
        suppressDragLeaveHidesColumns
        quickFilterText={quickFilterText}
        headerHeight={25}
        defaultColDef={{
          filter: 'agMultiColumnFilter',
          menuTabs: defaultMenuTabs,
          sortable: true,
          resizable: true,
        }}
        frameworkComponents={{
          // CELL RENDERERS
          executeRenderer: ExecuteRenderer,
          actionRenderer: ActionRenderer,
          booleanRenderer: BooleanRenderer,
          idLinkRenderer: IdLinkRenderer,
          subqueryRenderer: SubqueryRenderer,
          complexDataRenderer: ComplexDataRenderer,
          booleanEditableRenderer: BooleanEditableRenderer,
          fullWidthRenderer: FullWidthRenderer,
          // FILTER RENDERERS
          basicTextFilterRenderer: BasicTextFilterRenderer,
          basicTextFloatingFilterRenderer: BasicTextFloatingFilterRenderer,
          booleanFilterRenderer: BooleanFilterRenderer,
          // Custom renderers that apply to specific implementations
          ...frameworkComponents,
        }}
        columnDefs={columns}
        rowData={data}
        enableRangeSelection
        suppressRowClickSelection
        suppressMultiRangeSelection
        suppressMenuHide
        ensureDomOrder
        copyHeadersToClipboard
        processCellForClipboard={processCellForClipboard}
        getContextMenuItems={getContextMenuItems}
        onCellDoubleClicked={handleCellDoubleClicked}
        onCellKeyDown={handleCellKeydown}
        {...agGridProps}
      ></AgGridReact>
    </div>
  );
};

export default DataTable;

/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { ModuleRegistry, ColDef } from '@ag-grid-community/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { InfiniteRowModelModule } from '@ag-grid-community/infinite-row-model';
import { AgGridReact, AgGridReactProps } from '@ag-grid-community/react';
import { CSSProperties, FunctionComponent } from 'react';
import './data-table-styles.scss';
import { handleCellDoubleClicked, handleCellKeydown } from './data-table-utils';
import {
  ActionRenderer,
  BooleanFilterRenderer,
  BooleanRenderer,
  configIdLinkRenderer,
  IdLinkRenderer,
  SubqueryRenderer,
} from './DataTableRenderers';

ModuleRegistry.registerModules([ClientSideRowModelModule, InfiniteRowModelModule]);

export interface DataTableProps {
  style?: CSSProperties;
  columns: ColDef[];
  data: any[];
  agGridProps?: AgGridReactProps;
  quickFilterText?: string;
  serverUrl?: string;
  org?: SalesforceOrgUi;
}

export const DataTable: FunctionComponent<DataTableProps> = ({
  style = {
    height: '100%',
    width: '100%',
  },
  columns,
  data,
  agGridProps = {},
  quickFilterText,
  serverUrl,
  org,
}) => {
  if (serverUrl && org) {
    configIdLinkRenderer(serverUrl, org);
  }

  return (
    <div className="ag-theme-custom-react" style={style}>
      <AgGridReact
        rowSelection="multiple"
        quickFilterText={quickFilterText}
        frameworkComponents={{
          // CELL RENDERERS
          actionRenderer: ActionRenderer,
          booleanRenderer: BooleanRenderer,
          idLinkRenderer: IdLinkRenderer,
          subqueryRenderer: SubqueryRenderer,
          // FILTER RENDERERS
          booleanFilterRenderer: BooleanFilterRenderer,
        }}
        columnDefs={columns}
        rowData={data}
        onCellDoubleClicked={handleCellDoubleClicked}
        onCellKeyDown={handleCellKeydown}
        {...agGridProps}
      ></AgGridReact>
    </div>
  );
};

export default DataTable;

/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { ColDef } from 'ag-grid-community';
import { AgGridReact, AgGridReactProps } from 'ag-grid-react';
import { CSSProperties, FunctionComponent } from 'react';
import './data-table-styles.scss';
import { BooleanFilterRenderer, BooleanRenderer, configIdLinkRenderer, IdLinkRenderer, SubqueryRenderer } from './DataTableRenderers';

export interface DataTableProps {
  style?: CSSProperties;
  columns: ColDef[];
  data: any[];
  agGridProps?: AgGridReactProps;
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
  serverUrl,
  org,
}) => {
  if (serverUrl && org) {
    configIdLinkRenderer(serverUrl, org);
  }

  return (
    <div className="ag-theme-custom-react" style={style}>
      <AgGridReact
        rowBuffer={25}
        rowSelection="multiple"
        frameworkComponents={{
          // CELL RENDERERS
          booleanRenderer: BooleanRenderer,
          idLinkRenderer: IdLinkRenderer,
          subqueryRenderer: SubqueryRenderer,
          // FILTER RENDERERS
          booleanFilterRenderer: BooleanFilterRenderer,
        }}
        columnDefs={columns}
        rowData={data}
        {...agGridProps}
      ></AgGridReact>
    </div>
  );
};

export default DataTable;

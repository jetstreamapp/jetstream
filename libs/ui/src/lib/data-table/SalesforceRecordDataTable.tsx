/** @jsx jsx */
import { jsx } from '@emotion/core';
import { QueryResults } from '@jetstream/api-interfaces';
import { SalesforceOrgUi } from '@jetstream/types';
import { ColDef, SelectionChangedEvent } from 'ag-grid-community';
import { Fragment, FunctionComponent, memo, useEffect, useState } from 'react';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import './data-table-styles.scss';
import { getColumnDefinitions } from './data-table-utils';
import DataTable from './DataTable';
import numeral from 'numeral';

function getRowNodeId(data: any): string {
  return data?.attributes?.url || data.Id || Object.keys(data)[0];
}

export interface SalesforceRecordDataTableProps {
  serverUrl: string;
  org: SalesforceOrgUi;
  queryResults: QueryResults<any>;
  onSelectionChanged: (rows: any[]) => void;
  onFields: (fields: string[]) => void;
}

export const SalesforceRecordDataTable: FunctionComponent<SalesforceRecordDataTableProps> = memo<SalesforceRecordDataTableProps>(
  ({ serverUrl, org, queryResults, onSelectionChanged, onFields }) => {
    const [columns, setColumns] = useState<ColDef[]>();
    const [records, setRecords] = useState<any[]>();
    const [totalRecordCount, setTotalRecordCount] = useState<number>();

    useEffect(() => {
      if (queryResults) {
        const columns = getColumnDefinitions(queryResults);
        setColumns(columns);
        onFields(columns.filter((column) => column.field).map((column) => column.field));
        setRecords(queryResults.queryResults.records);
        setTotalRecordCount(queryResults.queryResults.totalSize);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryResults]);

    function handleSelectionChanged(event: SelectionChangedEvent) {
      if (onSelectionChanged) {
        onSelectionChanged(event.api.getSelectedRows());
      }
    }

    return records ? (
      <Fragment>
        <div className="slds-grid slds-p-around_xx-small">
          <div className="slds-col">
            Showing {numeral(records.length).format('0,0')} of {numeral(totalRecordCount).format('0,0')} records
          </div>
        </div>
        <AutoFullHeightContainer fillHeight setHeightAttr>
          <DataTable
            serverUrl={serverUrl}
            org={org}
            columns={columns}
            data={records}
            agGridProps={{
              immutableData: true,
              getRowNodeId,
              suppressMenuHide: true,
              suppressRowClickSelection: true,
              headerHeight: 25,
              gridOptions: {
                defaultColDef: {
                  filter: true,
                  sortable: true,
                  resizable: true,
                },
              },

              onSelectionChanged: handleSelectionChanged,
            }}
          />
        </AutoFullHeightContainer>
      </Fragment>
    ) : (
      <Fragment />
    );
  }
);

export default SalesforceRecordDataTable;

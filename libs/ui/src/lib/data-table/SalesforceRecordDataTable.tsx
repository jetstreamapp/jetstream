/** @jsx jsx */
import { ColDef, SelectionChangedEvent } from '@ag-grid-community/core';
import { jsx } from '@emotion/core';
import { QueryResults } from '@jetstream/api-interfaces';
import { SalesforceOrgUi } from '@jetstream/types';
import numeral from 'numeral';
import { Fragment, FunctionComponent, memo, useEffect, useRef, useState } from 'react';
import { queryMore } from '@jetstream/shared/data';
import Grid from '../grid/Grid';
import GridCol from '../grid/GridCol';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import Spinner from '../widgets/Spinner';
import './data-table-styles.scss';
import { DataTableContext, getColumnDefinitions, SalesforceQueryColumnDefinition } from './data-table-utils';
import DataTable from './DataTable';

function getRowNodeId(data: any): string {
  return data?.attributes?.url || data.Id || Object.keys(data)[0];
}

export interface SalesforceRecordDataTableProps {
  serverUrl: string;
  org: SalesforceOrgUi;
  queryResults: QueryResults<any>;
  onSelectionChanged: (rows: any[]) => void;
  onFields: (fields: string[]) => void;
  onLoadMoreRecords?: (queryResults: QueryResults<any>) => void;
}

export const SalesforceRecordDataTable: FunctionComponent<SalesforceRecordDataTableProps> = memo<SalesforceRecordDataTableProps>(
  ({ serverUrl, org, queryResults, onSelectionChanged, onFields, onLoadMoreRecords }) => {
    const isMounted = useRef(null);
    const [columns, setColumns] = useState<ColDef[]>();
    const [columnDefinitions, setColumnDefinitions] = useState<SalesforceQueryColumnDefinition>();
    const [records, setRecords] = useState<any[]>();
    const [totalRecordCount, setTotalRecordCount] = useState<number>();
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
    const [nextRecordsUrl, setNextRecordsUrl] = useState<string>();

    useEffect(() => {
      isMounted.current = true;
      return () => (isMounted.current = false);
    }, []);

    useEffect(() => {
      if (queryResults) {
        const columnDefinitions = getColumnDefinitions(queryResults);
        setColumns(columnDefinitions.parentColumns);
        onFields(columnDefinitions.parentColumns.filter((column) => column.field).map((column) => column.field));
        setColumnDefinitions(columnDefinitions);
        setRecords(queryResults.queryResults.records);
        setTotalRecordCount(queryResults.queryResults.totalSize);
        if (!queryResults.queryResults.done) {
          setHasMoreRecords(true);
          setNextRecordsUrl(queryResults.queryResults.nextRecordsUrl);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryResults]);

    function handleSelectionChanged(event: SelectionChangedEvent) {
      if (onSelectionChanged) {
        onSelectionChanged(event.api.getSelectedRows());
      }
    }

    async function loadMore() {
      try {
        setIsLoadingMore(true);
        const results = await queryMore(org, nextRecordsUrl);
        if (!isMounted.current) {
          return;
        }
        setNextRecordsUrl(results.queryResults.nextRecordsUrl);
        if (results.queryResults.done) {
          setHasMoreRecords(false);
        }
        setRecords(records.concat(results.queryResults.records));
        setIsLoadingMore(false);
        if (onLoadMoreRecords) {
          onLoadMoreRecords(results);
        }
      } catch (ex) {
        if (!isMounted.current) {
          return;
        }
        // oops. show the user an error
        setIsLoadingMore(false);
      }
    }

    return records ? (
      <Fragment>
        <Grid className="slds-p-around_xx-small">
          <GridCol growNone className="slds-p-around_x-small">
            Showing {numeral(records.length).format('0,0')} of {numeral(totalRecordCount).format('0,0')} records
          </GridCol>
          {hasMoreRecords && (
            <GridCol>
              <button className="slds-button slds-button_neutral slds-is-relative" onClick={loadMore} disabled={isLoadingMore}>
                Load More
                {isLoadingMore && <Spinner size="small" />}
              </button>
            </GridCol>
          )}
        </Grid>
        <DataTableContext.Provider
          value={{
            org,
            serverUrl,
            columnDefinitions,
          }}
        >
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
        </DataTableContext.Provider>
      </Fragment>
    ) : (
      <Fragment />
    );
  }
);

export default SalesforceRecordDataTable;

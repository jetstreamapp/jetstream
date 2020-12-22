/** @jsx jsx */
import { ColDef, ColumnEvent, SelectionChangedEvent } from '@ag-grid-community/core';
import { jsx } from '@emotion/core';
import { QueryResults } from '@jetstream/api-interfaces';
import { logger } from '@jetstream/shared/client-logger';
import { queryMore } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import uniqueId from 'lodash/uniqueId';
import { Fragment, FunctionComponent, memo, ReactNode, useEffect, useRef, useState } from 'react';
import Grid from '../grid/Grid';
import SearchInput from '../form/search-input/SearchInput';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import Spinner from '../widgets/Spinner';
import './data-table-styles.scss';
import {
  DataTableContext,
  getColumnDefinitions,
  getCurrentColumnOrder,
  getFilteredRows,
  SalesforceQueryColumnDefinition,
} from './data-table-utils';
import DataTable from './DataTable';

function getRowNodeId(data: any): string {
  if (data?.attributes?.type === 'AggregateResult') {
    return uniqueId('query-results-node-id');
  }
  let nodeId = data?.attributes?.url || data.Id;
  if (!nodeId) {
    nodeId = uniqueId('query-results-node-id');
  }
  return nodeId;
}

export interface SalesforceRecordDataTableProps {
  serverUrl: string;
  org: SalesforceOrgUi;
  queryResults: QueryResults<any>;
  summaryHeaderRightContent?: ReactNode;
  onSelectionChanged: (rows: any[]) => void;
  onFilteredRowsChanged: (rows: any[]) => void;
  /** Fired when query is loaded OR user changes column order */
  onFields: (fields: string[]) => void;
  onLoadMoreRecords?: (queryResults: QueryResults<any>) => void;
  onEdit: (record: any) => void;
  onClone: (record: any) => void;
}

export const SalesforceRecordDataTable: FunctionComponent<SalesforceRecordDataTableProps> = memo<SalesforceRecordDataTableProps>(
  ({
    serverUrl,
    org,
    queryResults,
    summaryHeaderRightContent,
    onSelectionChanged,
    onFilteredRowsChanged,
    onFields,
    onLoadMoreRecords,
    onEdit,
    onClone,
  }) => {
    const isMounted = useRef(null);
    const [columns, setColumns] = useState<ColDef[]>();
    const [columnDefinitions, setColumnDefinitions] = useState<SalesforceQueryColumnDefinition>();
    const [records, setRecords] = useState<any[]>();
    const [totalRecordCount, setTotalRecordCount] = useState<number>();
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
    const [nextRecordsUrl, setNextRecordsUrl] = useState<string>();
    const [globalFilter, setGlobalFilter] = useState<string>(null);

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
        onFilteredRowsChanged(queryResults.queryResults.records);
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

    function handleColumnMoved(event: ColumnEvent) {
      logger.log('handleColumnMoved', { event });
      onFields(getCurrentColumnOrder(event));
    }

    /**
     * User filtered data or clicked load more records
     */
    function handleFilterChangeOrRowDataUpdated(event: ColumnEvent) {
      logger.log('handleFilterChangeOrRowDataUpdated', { event });
      if (onFilteredRowsChanged) {
        onFilteredRowsChanged(getFilteredRows(event));
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
        <Grid className="slds-p-around_xx-small" align="spread">
          <div className="slds-grid">
            <div className="slds-p-around_x-small">
              Showing {formatNumber(records.length)} of {formatNumber(totalRecordCount)} records
            </div>
            {hasMoreRecords && (
              <div>
                <button className="slds-button slds-button_neutral slds-is-relative" onClick={loadMore} disabled={isLoadingMore}>
                  Load More
                  {isLoadingMore && <Spinner size="small" />}
                </button>
              </div>
            )}
          </div>
          <div className="slds-p-top_xx-small">
            <SearchInput id="record-filter" placeholder="Search records..." onChange={setGlobalFilter} />
          </div>
          <div>{summaryHeaderRightContent}</div>
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
              quickFilterText={globalFilter}
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
                context: {
                  actions: {
                    edit: onEdit,
                    clone: onClone,
                  },
                },
                onSelectionChanged: handleSelectionChanged,
                onColumnMoved: handleColumnMoved,
                onFilterChanged: handleFilterChangeOrRowDataUpdated,
                onRowDataUpdated: handleFilterChangeOrRowDataUpdated,
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

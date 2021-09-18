/** @jsx jsx */
import { ColDef, ColumnEvent, GridApi, GridReadyEvent, ProcessHeaderForExportParams, SelectionChangedEvent } from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { QueryResults } from '@jetstream/api-interfaces';
import { logger } from '@jetstream/shared/client-logger';
import { queryMore } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Field } from 'jsforce';
import uniqueId from 'lodash/uniqueId';
import { Fragment, FunctionComponent, memo, ReactNode, useEffect, useRef, useState } from 'react';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import Spinner from '../widgets/Spinner';
import './data-table-styles.scss';
import {
  addFieldLabelToColumn,
  DataTableContext,
  getColumnDefinitions,
  getCurrentColumnOrder,
  getFilteredRows,
  SalesforceQueryColumnDefinition,
} from './data-table-utils';
import DataTable from './DataTable';

const SFDC_EMPTY_ID = '000000000000000AAA';

function getRowNodeId(data: any): string {
  if (data?.attributes?.type === 'AggregateResult') {
    return uniqueId('query-results-node-id');
  }
  let nodeId = data?.attributes?.url || data.Id;
  if (!nodeId || nodeId.endsWith(SFDC_EMPTY_ID) || data.Id === SFDC_EMPTY_ID) {
    nodeId = uniqueId('query-results-node-id');
  }
  return nodeId;
}

export interface SalesforceRecordDataTableProps {
  org: SalesforceOrgUi;
  isTooling: boolean;
  serverUrl: string;
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
  queryResults: QueryResults<any>;
  fieldMetadata: MapOf<Field>;
  fieldMetadataSubquery: MapOf<MapOf<Field>>;
  summaryHeaderRightContent?: ReactNode;
  onSelectionChanged: (rows: any[]) => void;
  onFilteredRowsChanged: (rows: any[]) => void;
  /** Fired when query is loaded OR user changes column order */
  onFields: (fields: string[]) => void;
  onLoadMoreRecords?: (queryResults: QueryResults<any>) => void;
  onEdit: (record: any) => void;
  onClone: (record: any) => void;
  onView: (record: any) => void;
  onGetAsApex: (record: any) => void;
}

export const SalesforceRecordDataTable: FunctionComponent<SalesforceRecordDataTableProps> = memo<SalesforceRecordDataTableProps>(
  ({
    org,
    google_apiKey,
    google_appId,
    google_clientId,
    isTooling,
    serverUrl,
    queryResults,
    fieldMetadata,
    fieldMetadataSubquery,
    summaryHeaderRightContent,
    onSelectionChanged,
    onFilteredRowsChanged,
    onFields,
    onLoadMoreRecords,
    onEdit,
    onClone,
    onView,
    onGetAsApex,
  }) => {
    const isMounted = useRef(null);
    const [gridApi, setGridApi] = useState<GridApi>(null);
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
        const columnDefinitions = getColumnDefinitions(queryResults, isTooling);
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

    /**
     * When metadata is obtained, update the grid columns to include field labels
     */
    useEffect(() => {
      if (fieldMetadata && gridApi) {
        const columnDefinitions = getColumnDefinitions(queryResults, isTooling);
        const parentColumnDefinitions = columnDefinitions.parentColumns;
        const childColumnDefinitions = columnDefinitions.subqueryColumns;
        addFieldLabelToColumn(parentColumnDefinitions, fieldMetadata);

        if (fieldMetadataSubquery) {
          // If there are subqueries, update field definition
          for (const key in childColumnDefinitions) {
            if (fieldMetadataSubquery[key.toLowerCase()]) {
              addFieldLabelToColumn(childColumnDefinitions[key], fieldMetadataSubquery[key.toLowerCase()]);
            }
          }
        }

        gridApi.setColumnDefs(parentColumnDefinitions);
        setColumns(parentColumnDefinitions);
        setColumnDefinitions(columnDefinitions);
      }
    }, [fieldMetadata, fieldMetadataSubquery, gridApi, isTooling, queryResults]);

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
        const results = await queryMore(org, nextRecordsUrl, isTooling);
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

    function handleOnGridReady({ api }: GridReadyEvent) {
      setGridApi(api);
    }

    /** Ensure that the header is the true api name and does not include (type) */
    function processHeaderForClipboard({ column }: ProcessHeaderForExportParams) {
      return column.getColDef().field;
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
            isTooling,
            columnDefinitions,
            google_apiKey,
            google_appId,
            google_clientId,
          }}
        >
          <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={10}>
            <DataTable
              serverUrl={serverUrl}
              org={org}
              columns={columns}
              data={records}
              quickFilterText={globalFilter}
              agGridProps={{
                immutableData: true,
                getRowNodeId,
                context: {
                  actions: {
                    edit: onEdit,
                    clone: onClone,
                    view: onView,
                    getAsApex: onGetAsApex,
                  },
                },
                sideBar: {
                  toolPanels: [
                    {
                      id: 'filters',
                      labelDefault: 'Filters',
                      labelKey: 'filters',
                      iconKey: 'filter',
                      toolPanel: 'agFiltersToolPanel',
                    },
                    {
                      id: 'columns',
                      labelDefault: 'Columns',
                      labelKey: 'columns',
                      iconKey: 'columns',
                      toolPanel: 'agColumnsToolPanel',
                      toolPanelParams: {
                        suppressRowGroups: true,
                        suppressValues: true,
                        suppressPivots: true,
                        suppressPivotMode: true,
                      },
                    },
                  ],
                },
                processHeaderForClipboard: processHeaderForClipboard,
                onGridReady: handleOnGridReady,
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

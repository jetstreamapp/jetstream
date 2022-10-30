import { QueryResults } from '@jetstream/api-interfaces';
import { logger } from '@jetstream/shared/client-logger';
import { queryRemaining } from '@jetstream/shared/data';
import { formatNumber, useRollbar } from '@jetstream/shared/ui-utils';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Field } from 'jsforce';
import uniqueId from 'lodash/uniqueId';
import { Fragment, FunctionComponent, memo, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Column, CopyEvent } from 'react-data-grid';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import { PopoverErrorButton } from '../popover/PopoverErrorButton';
import Spinner from '../widgets/Spinner';
import { ColumnWithFilter, RowWithKey } from './data-table-types';
import { addFieldLabelToColumn, DataTableSubqueryContext, getColumnDefinitions, NON_DATA_COLUMN_KEYS } from './data-table-utils';
import DataTable from './DataTable';

const SFDC_EMPTY_ID = '000000000000000AAA';

function getRowId(data: any): string {
  if (data?.attributes?.type === 'AggregateResult') {
    return uniqueId('query-results-node-id');
  }
  let nodeId = data?.attributes?.url || data.Id;
  if (!nodeId || nodeId.endsWith(SFDC_EMPTY_ID) || data.Id === SFDC_EMPTY_ID) {
    nodeId = uniqueId('query-results-node-id');
  }
  return nodeId;
}

function getRowKey(row: RowWithKey): string {
  return row.id;
}

export interface SalesforceRecordDataTableNewProps {
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
  onFields: (fields: { allFields: string[]; visibleFields: string[] }) => void;
  onLoadMoreRecords?: (queryResults: QueryResults<any>) => void;
  onEdit: (record: any) => void;
  onClone: (record: any) => void;
  onView: (record: any) => void;
  onGetAsApex: (record: any) => void;
}

export const SalesforceRecordDataTableNew: FunctionComponent<SalesforceRecordDataTableNewProps> = memo<SalesforceRecordDataTableNewProps>(
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
    const rollbar = useRollbar();
    // const [gridApi, setGridApi] = useState<GridApi>(null);
    const [columns, setColumns] = useState<Column<RowWithKey>[]>();
    // const [_columnDefinitions, setColumnDefinitions] = useState<Column<any>[]>();
    const [subqueryColumnsMap, setSubqueryColumnsMap] = useState<MapOf<ColumnWithFilter<RowWithKey, unknown>[]>>();
    const [records, setRecords] = useState<RowWithKey[]>();
    // Same as records but with additional data added
    const [rows, setRows] = useState<RowWithKey[]>();
    const [totalRecordCount, setTotalRecordCount] = useState<number>();
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [loadMoreErrorMessage, setLoadMoreErrorMessage] = useState<string>();
    const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
    const [nextRecordsUrl, setNextRecordsUrl] = useState<string>();
    const [globalFilter, setGlobalFilter] = useState<string>(null);
    const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(() => new Set());

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    useEffect(() => {
      if (queryResults) {
        const { parentColumns, subqueryColumns } = getColumnDefinitions(queryResults, isTooling);
        // const fields = columnDefinitions.parentColumns.filter((column) => column.field).map((column) => column.field);
        const fields = parentColumns.filter((column) => column.key && !NON_DATA_COLUMN_KEYS.has(column.key)).map((column) => column.key);
        // setColumns(columnDefinitions.parentColumns);
        setColumns(parentColumns);
        onFields({ allFields: fields, visibleFields: fields });
        setSubqueryColumnsMap(subqueryColumns);
        setRecords(queryResults.queryResults.records);
        setRows(
          queryResults.queryResults.records.map((row): RowWithKey => {
            return {
              _key: getRowId(row),
              _action: handleRowAction,
              ...row,
            };
          })
        );
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
      if (fieldMetadata) {
        const { parentColumns, subqueryColumns } = getColumnDefinitions(queryResults, isTooling);

        setColumns(addFieldLabelToColumn(parentColumns, fieldMetadata));

        // If there are subqueries, update field definition
        if (fieldMetadataSubquery) {
          for (const key in subqueryColumns) {
            if (fieldMetadataSubquery[key.toLowerCase()]) {
              addFieldLabelToColumn(subqueryColumns[key], fieldMetadataSubquery[key.toLowerCase()]);
            }
          }
        }

        setColumns(parentColumns);
        setSubqueryColumnsMap(subqueryColumns);
      }
    }, [fieldMetadata, fieldMetadataSubquery, isTooling, queryResults]);

    const handleRowAction = useCallback((row: RowWithKey, action: 'view' | 'edit' | 'clone' | 'apex') => {
      logger.info('row action', row, action);
      switch (action) {
        case 'edit':
          onEdit(row);
          break;
        case 'clone':
          onClone(row);
          break;
        case 'view':
          onView(row);
          break;
        case 'apex':
          onGetAsApex(row);
          break;
        default:
          break;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleSelectionChanged(event) {
      // if (onSelectionChanged) {
      // onSelectionChanged(event.api.getSelectedRows());
      // }
    }

    function handleColumnChanged(event) {
      // logger.log('handleColumnMoved', { event });
      // onFields({ allFields: getAllColumns(event.columnApi), visibleFields: getCurrentColumns(event.columnApi) });
    }

    /**
     * User filtered data or clicked load more records
     */
    function handleFilterChangeOrRowDataUpdated(event) {
      // logger.log('handleFilterChangeOrRowDataUpdated', { event });
      // if (onFilteredRowsChanged) {
      // onFilteredRowsChanged(getFilteredRows(event));
      // }
    }

    async function loadRemaining() {
      try {
        setIsLoadingMore(true);
        setLoadMoreErrorMessage(null);
        const results = await queryRemaining(org, nextRecordsUrl, isTooling);
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
        setLoadMoreErrorMessage('There was a problem loading the rest of the records.');
        rollbar.error('Load Remaining Records failed', { message: ex.message, stack: ex.stack });
      }
    }

    /** Ensure that the header is the true api name and does not include (type) */
    function processHeaderForClipboard() {
      // return column.getColDef().field;
    }

    function handleCopy({ sourceRow, sourceColumnKey }: CopyEvent<RowWithKey>): void {
      if (window.isSecureContext) {
        navigator.clipboard.writeText(sourceRow[sourceColumnKey]);
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
                <button
                  className="slds-button slds-button_brand slds-m-left_x-small slds-is-relative"
                  onClick={loadRemaining}
                  disabled={isLoadingMore}
                >
                  Load All Records
                  {isLoadingMore && <Spinner size="small" />}
                </button>
                {loadMoreErrorMessage && <PopoverErrorButton listHeader={null} errors={loadMoreErrorMessage} />}
              </div>
            )}
          </div>
          <div className="slds-p-top_xx-small">
            <SearchInput id="record-filter" placeholder="Search records..." onChange={setGlobalFilter} />
          </div>
          <div>{summaryHeaderRightContent}</div>
        </Grid>
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={10}>
          <DataTableSubqueryContext.Provider
            value={{
              serverUrl,
              org,
              isTooling,
              columnDefinitions: subqueryColumnsMap,
              google_apiKey,
              google_appId,
              google_clientId,
            }}
          >
            <DataTable
              serverUrl={serverUrl}
              org={org}
              data={rows}
              columns={columns}
              includeQuickFilter
              quickFilterText={globalFilter}
              getRowKey={getRowKey}
              onCopy={handleCopy}
              rowHeight={28.5}
              selectedRows={selectedRows}
              onSelectedRowsChange={setSelectedRows as any}
            />
          </DataTableSubqueryContext.Provider>
        </AutoFullHeightContainer>
      </Fragment>
    ) : null;
  }
);

export default SalesforceRecordDataTableNew;

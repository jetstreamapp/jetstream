/* eslint-disable no-fallthrough */
import { QueryResults } from '@jetstream/api-interfaces';
import { logger } from '@jetstream/shared/client-logger';
import { queryRemaining } from '@jetstream/shared/data';
import { formatNumber, transformTabularDataToExcelStr, useRollbar } from '@jetstream/shared/ui-utils';
import { flattenRecord, flattenRecords } from '@jetstream/shared/utils';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import copyToClipboard from 'copy-to-clipboard';
import { Field } from 'jsforce';
import uniqueId from 'lodash/uniqueId';
import { Fragment, FunctionComponent, memo, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Column, CopyEvent } from 'react-data-grid';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import { ContextMenuItem } from '../popover/ContextMenu';
import { PopoverErrorButton } from '../popover/PopoverErrorButton';
import Spinner from '../widgets/Spinner';
import { DataTableSubqueryContext } from './data-table-context';
import { ColumnWithFilter, RowWithKey } from './data-table-types';
import { addFieldLabelToColumn, getColumnDefinitions, NON_DATA_COLUMN_KEYS } from './data-table-utils';
import { ContextMenuActionData, DataTable } from './DataTable';

type ContextAction = 'COPY_ROW' | 'COPY_ROW_NO_HEADER' | 'COPY_COL' | 'COPY_COL_NO_HEADER' | 'COPY_TABLE' | 'COPY_TABLE_NO_HEADER';

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
  onFields: (fields: { allFields: string[]; visibleFields: string[] }) => void;
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
    const rollbar = useRollbar();
    const [columns, setColumns] = useState<Column<RowWithKey>[]>();
    const [subqueryColumnsMap, setSubqueryColumnsMap] = useState<MapOf<ColumnWithFilter<RowWithKey, unknown>[]>>();
    const [records, setRecords] = useState<RowWithKey[]>();
    // Same as records but with additional data added
    const [fields, setFields] = useState<string[]>([]);
    const [rows, setRows] = useState<RowWithKey[]>();
    const [totalRecordCount, setTotalRecordCount] = useState<number>();
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [loadMoreErrorMessage, setLoadMoreErrorMessage] = useState<string>();
    const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
    const [nextRecordsUrl, setNextRecordsUrl] = useState<string>();
    const [globalFilter, setGlobalFilter] = useState<string>(null);
    const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(() => new Set());
    const [contextMenuItems, setContextMenuItems] = useState<ContextMenuItem[]>([]);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    useEffect(() => {
      if (queryResults) {
        const { parentColumns, subqueryColumns } = getColumnDefinitions(queryResults, isTooling);
        const fields = parentColumns.filter((column) => column.key && !NON_DATA_COLUMN_KEYS.has(column.key)).map((column) => column.key);
        setColumns(parentColumns);
        setFields(fields);
        onFields({ allFields: fields, visibleFields: fields });
        setSubqueryColumnsMap(subqueryColumns);
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

    useEffect(() => {
      if (onSelectionChanged && Array.isArray(rows) && selectedRows) {
        onSelectionChanged(rows.filter((row) => selectedRows.has(getRowId(row))).map((row) => row._record));
      }
    }, [onSelectionChanged, rows, selectedRows]);

    useEffect(() => {
      setContextMenuItems([
        { label: 'Copy row to clipboard with header', value: 'COPY_ROW' },
        { label: 'Copy row to clipboard without header', value: 'COPY_ROW_NO_HEADER', divider: true },

        { label: 'Copy column to clipboard with header', value: 'COPY_COL' },
        { label: 'Copy column to clipboard without header', value: 'COPY_COL_NO_HEADER', divider: true },

        { label: 'Copy table to clipboard with header', value: 'COPY_TABLE' },
        { label: 'Copy table to clipboard without header', value: 'COPY_TABLE_NO_HEADER' },
      ]);
    }, []);

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
              subqueryColumns[key] = addFieldLabelToColumn(subqueryColumns[key], fieldMetadataSubquery[key.toLowerCase()]);
            }
          }
        }

        setSubqueryColumnsMap(subqueryColumns);
      }
    }, [fieldMetadata, fieldMetadataSubquery, isTooling, queryResults]);

    const handleRowAction = useCallback((row: RowWithKey, action: 'view' | 'edit' | 'clone' | 'apex') => {
      const record = row._record;
      logger.info('row action', record, action);
      switch (action) {
        case 'edit':
          onEdit(record);
          break;
        case 'clone':
          onClone(record);
          break;
        case 'view':
          onView(record);
          break;
        case 'apex':
          onGetAsApex(record);
          break;
        default:
          break;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleContextMenuAction = useCallback(
      (item: ContextMenuItem<ContextAction>, { row, rows, column, columns }: ContextMenuActionData<RowWithKey>) => {
        let includeHeader = true;
        let recordsToCopy: any[] = [];
        const records = rows.map((row) => row._record);
        const fieldsSet = new Set(fields);
        let fieldsToCopy = columns.map((column) => column.key).filter((field) => fieldsSet.has(field)); // prefer this over fields because it accounts for reordering
        logger.info('row action', item.value, { record: row._record, column });
        // NOTE: FALLTHROUGH IS INTENTIONAL
        switch (item.value) {
          case 'COPY_ROW_NO_HEADER':
            includeHeader = false;
          case 'COPY_ROW':
            recordsToCopy = [row._record];
            break;

          case 'COPY_COL_NO_HEADER':
            includeHeader = false;
          case 'COPY_COL':
            fieldsToCopy = fieldsToCopy.filter((field) => field === column.key);
            recordsToCopy = records.map((row) => ({ [column.key]: row[column.key] }));
            break;

          case 'COPY_TABLE_NO_HEADER':
            includeHeader = false;
          case 'COPY_TABLE':
            recordsToCopy = records;
            break;

          default:
            break;
        }
        if (recordsToCopy.length) {
          const flattenedData = flattenRecords(recordsToCopy, fieldsToCopy);
          copyToClipboard(transformTabularDataToExcelStr(flattenedData, fieldsToCopy, includeHeader), { format: 'text/plain' });
        }
      },
      [fields]
    );

    useEffect(() => {
      const columnKeys = columns?.map((col) => col.key) || null;
      setRows(
        (records || []).map((row): RowWithKey => {
          return {
            _key: getRowId(row),
            _action: handleRowAction,
            _record: row,
            ...(columnKeys ? flattenRecord(row, columnKeys, false) : row),
          };
        })
      );
    }, [columns, handleRowAction, records]);

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

    function handleCopy({ sourceRow, sourceColumnKey }: CopyEvent<RowWithKey>): void {
      if (window.isSecureContext) {
        navigator.clipboard.writeText(sourceRow[sourceColumnKey]);
      }
    }

    const handleColumnReorder = useCallback((newFields: string[]) => {
      onFields({ allFields: newFields, visibleFields: newFields });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
              allowReorder
              includeQuickFilter
              quickFilterText={globalFilter}
              getRowKey={getRowId}
              onCopy={handleCopy}
              rowHeight={28.5}
              selectedRows={selectedRows}
              onReorderColumns={handleColumnReorder}
              onSelectedRowsChange={(rows) => setSelectedRows(rows as Set<string>)}
              onSortedAndFilteredRowsChange={(rows) => onFilteredRowsChanged(rows as RowWithKey[])}
              contextMenuItems={contextMenuItems}
              contextMenuAction={handleContextMenuAction}
            />
          </DataTableSubqueryContext.Provider>
        </AutoFullHeightContainer>
      </Fragment>
    ) : null;
  }
);

export default SalesforceRecordDataTable;

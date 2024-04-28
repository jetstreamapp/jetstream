import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { queryRemaining } from '@jetstream/shared/data';
import { formatNumber, useRollbar } from '@jetstream/shared/ui-utils';
import { flattenRecord, getIdFromRecordUrl, nullifyEmptyStrings } from '@jetstream/shared/utils';
import { CloneEditView, Field, Maybe, QueryResults, SalesforceOrgUi, SobjectCollectionResponse } from '@jetstream/types';
import uniqueId from 'lodash/uniqueId';
import { Fragment, FunctionComponent, ReactNode, memo, useCallback, useEffect, useRef, useState } from 'react';
import { Column, RowsChangeData } from 'react-data-grid';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import { ConfirmationModalPromise } from '../modal/ConfirmationModalPromise';
import { ContextMenuItem } from '../popover/ContextMenu';
import { PopoverErrorButton } from '../popover/PopoverErrorButton';
import { fireToast } from '../toast/AppToast';
import Spinner from '../widgets/Spinner';
import { DataTable } from './DataTable';
import { DataTableSubqueryContext } from './data-table-context';
import { ColumnWithFilter, ContextAction, ContextMenuActionData, RowSalesforceRecordWithKey, RowWithKey } from './data-table-types';
import {
  NON_DATA_COLUMN_KEYS,
  TABLE_CONTEXT_MENU_ITEMS,
  addFieldLabelToColumn,
  copySalesforceRecordTableDataToClipboard,
  getColumnDefinitions,
} from './data-table-utils';

const SFDC_EMPTY_ID = '000000000000000AAA';

function getRowId(data: any): string {
  if (data._key) {
    return data._key;
  }
  if (data?.attributes?.type === 'AggregateResult') {
    return uniqueId('query-results-node-id');
  }
  let nodeId = data?.attributes?.url || data.Id;
  if (!nodeId || data.Id === SFDC_EMPTY_ID || nodeId.endsWith(SFDC_EMPTY_ID)) {
    nodeId = uniqueId('query-results-node-id');
  }
  return nodeId;
}

function getRowClass(row: RowSalesforceRecordWithKey): string | undefined {
  return row._saveError ? 'save-error' : undefined;
}

export interface SalesforceRecordDataTableProps {
  org: SalesforceOrgUi;
  isTooling: boolean;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
  queryResults: Maybe<QueryResults<any>>;
  fieldMetadata: Maybe<Record<string, Field>>;
  fieldMetadataSubquery: Maybe<Record<string, Record<string, Field>>>;
  summaryHeaderRightContent?: ReactNode;
  onSelectionChanged: (rows: any[]) => void;
  onFilteredRowsChanged: (rows: any[]) => void;
  /** Fired when query is loaded OR user changes column order */
  onFields: (fields: string[], columnOrder: number[]) => void;
  onSubqueryFieldReorder: (columnKey: string, fields: string[], columnOrder: number[]) => void;
  onLoadMoreRecords?: (queryResults: QueryResults<any>) => void;
  onEdit: (record: any, source: 'ROW_ACTION' | 'RELATED_RECORD_POPOVER') => void;
  onClone: (record: any, source: 'ROW_ACTION' | 'RELATED_RECORD_POPOVER') => void;
  onView: (record: any, source: 'ROW_ACTION' | 'RELATED_RECORD_POPOVER') => void;
  onUpdateRecords: (records: any[]) => Promise<SobjectCollectionResponse>;
  onDelete: (record: any) => void;
  onGetAsApex: (record: any) => void;
  onSavedRecords: (results: { recordCount: number; failureCount: number }) => void;
  onReloadQuery: () => void;
}

export const SalesforceRecordDataTable: FunctionComponent<SalesforceRecordDataTableProps> = memo<SalesforceRecordDataTableProps>(
  ({
    org,
    defaultApiVersion,
    google_apiKey,
    google_appId,
    google_clientId,
    isTooling,
    serverUrl,
    skipFrontdoorLogin,
    queryResults,
    fieldMetadata,
    fieldMetadataSubquery,
    summaryHeaderRightContent,
    onSelectionChanged,
    onFilteredRowsChanged,
    onFields,
    onSubqueryFieldReorder,
    onLoadMoreRecords,
    onEdit,
    onClone,
    onView,
    onUpdateRecords,
    onDelete,
    onGetAsApex,
    onSavedRecords,
    onReloadQuery,
  }) => {
    const isMounted = useRef(true);
    const rollbar = useRollbar();
    const [columns, setColumns] = useState<Column<RowSalesforceRecordWithKey>[]>();
    const [subqueryColumnsMap, setSubqueryColumnsMap] = useState<Record<string, ColumnWithFilter<RowSalesforceRecordWithKey, unknown>[]>>();
    const [records, setRecords] = useState<any[]>();
    // Same as records but with additional data added
    const [fields, setFields] = useState<string[]>([]);
    const [rows, setRows] = useState<RowSalesforceRecordWithKey[]>();
    const [dirtyRows, setDirtyRows] = useState<RowSalesforceRecordWithKey[]>([]);
    const [saveErrors, setSaveErrors] = useState<string[]>([]);

    const [totalRecordCount, setTotalRecordCount] = useState<number>();
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadMoreErrorMessage, setLoadMoreErrorMessage] = useState<string | null>(null);
    const [hasMoreRecords, setHasMoreRecords] = useState(false);
    const [nextRecordsUrl, setNextRecordsUrl] = useState<Maybe<string>>(null);
    const [globalFilter, setGlobalFilter] = useState<string | null>(null);
    const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(() => new Set());
    const [visibleRecordCount, setVisibleRecordCount] = useState(records?.length);

    const [isSavingRecords, setIsSavingRecords] = useState(false);

    useEffect(() => {
      isMounted.current = true;
      return () => {
        isMounted.current = false;
      };
    }, []);

    useEffect(() => {
      if (queryResults) {
        const { parentColumns, subqueryColumns } = getColumnDefinitions(queryResults, isTooling, fieldMetadata, fieldMetadataSubquery);
        const fields = parentColumns.filter((column) => column.key && !NON_DATA_COLUMN_KEYS.has(column.key)).map((column) => column.key);
        setColumns(parentColumns);
        setFields(fields);
        onFields(
          fields,
          fields.map((_, i) => i)
        );
        setSubqueryColumnsMap(subqueryColumns);
        setRecords(queryResults.queryResults.records);
        onFilteredRowsChanged(queryResults.queryResults.records);
        setTotalRecordCount(queryResults.queryResults.totalSize);
        if (!queryResults.queryResults.done && queryResults.queryResults.nextRecordsUrl) {
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

    /**
     * When metadata is obtained, update the grid columns to include field labels
     */
    useEffect(() => {
      if (fieldMetadata && queryResults) {
        const { parentColumns, subqueryColumns } = getColumnDefinitions(queryResults, isTooling, fieldMetadata, fieldMetadataSubquery);

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

    useEffect(() => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setSaveErrors(dirtyRows.filter((row) => row._saveError).map((row) => row._saveError!));
    }, [dirtyRows]);

    const handleRowAction = useCallback((row: RowWithKey, action: 'view' | 'edit' | 'clone' | 'delete' | 'apex') => {
      const record = row._record;
      logger.info('row action', record, action);
      switch (action) {
        case 'edit':
          onEdit(record, 'ROW_ACTION');
          break;
        case 'clone':
          onClone(record, 'ROW_ACTION');
          break;
        case 'view':
          onView(record, 'ROW_ACTION');
          break;
        case 'delete':
          onDelete(record);
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
      (item: ContextMenuItem<ContextAction>, data: ContextMenuActionData<RowWithKey>) => {
        copySalesforceRecordTableDataToClipboard(item.value, fields, data);
      },
      [fields]
    );

    useEffect(() => {
      const columnKeys = columns?.map((col) => col.key) || null;
      setRows(
        (records || []).map((row, i): RowSalesforceRecordWithKey => {
          return {
            _action: handleRowAction,
            _idx: i,
            _record: row,
            ...(columnKeys ? flattenRecord(row, columnKeys, false) : row),
            _key: getRowId(row),
            _touchedColumns: new Set(),
            _saveError: null,
          };
        })
      );
      setDirtyRows([]);
    }, [columns, handleRowAction, records]);

    async function loadRemaining() {
      try {
        if (
          dirtyRows?.length &&
          !(await ConfirmationModalPromise({
            content: 'If you load all records your unsaved changes will not be saved.',
          }))
        ) {
          return;
        }

        if (!nextRecordsUrl) {
          return;
        }
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
        setRecords((records || []).concat(results.queryResults.records));
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

    const handleSortedAndFilteredRowsChange = useCallback(
      (rows: RowSalesforceRecordWithKey[]) => {
        onFilteredRowsChanged(rows.map(({ _record }) => _record));

        setVisibleRecordCount(rows.length);
      },
      [onFilteredRowsChanged]
    );

    const handleSelectedRowsChange = useCallback((rows: Set<string>) => {
      setSelectedRows(rows);
    }, []);

    const handleColumnReorder = useCallback((columns: string[], columnOrder: number[]) => {
      onFields(columns, columnOrder);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRowsChange = useCallback((rows: RowSalesforceRecordWithKey[], data: RowsChangeData<RowSalesforceRecordWithKey[]>) => {
      setRows(rows);
      setDirtyRows(
        rows.filter((row) => row._touchedColumns.size > 0 && Array.from(row._touchedColumns).some((col) => row[col] !== row._record[col]))
      );
    }, []);

    const handleCancelEditMode = () => {
      setRecords((records) => (records ? [...records] : records));
    };

    const handleSaveRecords = async () => {
      try {
        if (!rows) {
          return;
        }
        if (!dirtyRows.length) {
          setRecords((records) => (records ? [...records] : records));
          return;
        }
        setIsSavingRecords(true);
        const modifiedRecords = dirtyRows.map((row) =>
          nullifyEmptyStrings(
            Array.from(row._touchedColumns).reduce(
              (acc, column) => {
                acc[column] = row[column];
                return acc;
              },
              { attributes: row._record.attributes, Id: getIdFromRecordUrl(row._record.attributes.url) }
            )
          )
        );
        const results = await onUpdateRecords(modifiedRecords);

        const failedResultsById = results.reduce((acc, result, i) => {
          if (!result.success) {
            const id = result.id || getIdFromRecordUrl(dirtyRows[i]._record.attributes.url);
            if (id) {
              acc[id] = result;
            }
          }
          return acc;
        }, {});

        /** Reset all successful rows, add error message to failed rows */
        const newRows = rows.map((row): RowSalesforceRecordWithKey => {
          if (row._touchedColumns.size > 0) {
            const id = getIdFromRecordUrl(row._record.attributes.url);
            if (failedResultsById[id]) {
              return { ...row, _saveError: failedResultsById[id].errors[0].message };
            } else {
              return { ...row, _touchedColumns: new Set(), _saveError: null };
            }
          }
          if (row._saveError) {
            return { ...row, _saveError: null };
          }
          return row;
        });
        setRows(newRows);
        setDirtyRows(
          newRows.filter(
            (row) => row._touchedColumns.size > 0 && Array.from(row._touchedColumns).some((col: string) => row[col] !== row._record[col])
          )
        );
        onSavedRecords({ recordCount: modifiedRecords.length, failureCount: Object.values(failedResultsById).length });
      } catch (ex) {
        // This happens if exception thrown, normal behavior is to get records with result success/error
        logger.warn('Error saving records', ex);
        fireToast({
          message: `There was a problem saving your records. ${ex?.message || ''}`,
          type: 'error',
        });
        rollbar.error('Error saving records - inline query', { message: ex.message, stack: ex.stack });
      } finally {
        setIsSavingRecords(false);
      }
    };

    function handleSubqueryFieldsChanged(columnKey: string, newFields: string[], columnOrder: number[]) {
      onSubqueryFieldReorder(columnKey, newFields, columnOrder);
      // FIXME: this causes an infinite render loop
      // The purpose of attempting this is to ensure that the query map is updated with the new column order for the specific subquery
      // without this the modal uses the prior column order if it is opened a second time - but the query is updated correctly
      // which means the fields get modified and the table gets fully re-rendered
      // this doesn't actually need to fire until the modal closes, but it's not clear how to do that
      // setSubqueryColumnsMap((prevValue) => {
      //   return {
      //     ...prevValue,
      //     [columnKey]: columnOrder.map((idx) => prevValue![columnKey][idx]),
      //   };
      // });
    }

    return records ? (
      <Fragment>
        <Grid className="slds-p-around_xx-small" align="spread">
          <div className="slds-grid">
            <div className="slds-p-around_x-small">
              Showing {formatNumber(visibleRecordCount)} of {formatNumber(totalRecordCount || 0)} records
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
                {loadMoreErrorMessage && <PopoverErrorButton errors={loadMoreErrorMessage} />}
              </div>
            )}
          </div>
          <div className="slds-p-top_xx-small">
            <SearchInput id="record-filter" placeholder="Search records..." onChange={setGlobalFilter} />
          </div>
          <div>{summaryHeaderRightContent}</div>
        </Grid>
        {!!dirtyRows?.length && (
          <Grid
            css={css`
              background-color: #f3f3f3;
            `}
            className="slds-p-around_x-small"
            align="center"
          >
            {saveErrors?.length > 0 && <PopoverErrorButton header="Save Errors" initOpenState={false} errors={saveErrors} />}
            <button
              className="slds-button slds-button_neutral slds-m-left_x-small"
              onClick={handleCancelEditMode}
              disabled={isSavingRecords}
            >
              Cancel
            </button>
            <button
              className="slds-button slds-button_brand slds-m-left_x-small slds-is-relative"
              onClick={handleSaveRecords}
              disabled={isSavingRecords}
            >
              Save
              {isSavingRecords && <Spinner size="small" />}
            </button>
          </Grid>
        )}
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={dirtyRows?.length ? 58 : 10}>
          <DataTableSubqueryContext.Provider
            value={{
              serverUrl,
              skipFrontdoorLogin,
              org,
              isTooling,
              columnDefinitions: subqueryColumnsMap,
              onSubqueryFieldReorder: handleSubqueryFieldsChanged,
              google_apiKey,
              google_appId,
              google_clientId,
            }}
          >
            <DataTable
              serverUrl={serverUrl}
              skipFrontdoorLogin={skipFrontdoorLogin}
              org={org}
              data={rows || []}
              columns={columns || []}
              includeQuickFilter
              quickFilterText={globalFilter}
              getRowKey={getRowId}
              rowHeight={28.5}
              selectedRows={selectedRows}
              rowClass={getRowClass}
              onReorderColumns={handleColumnReorder}
              onSelectedRowsChange={handleSelectedRowsChange}
              onSortedAndFilteredRowsChange={handleSortedAndFilteredRowsChange}
              onRowsChange={handleRowsChange}
              context={{
                org,
                defaultApiVersion,
                onRecordAction: (action: CloneEditView, recordId: string, sobjectName: string) => {
                  switch (action) {
                    case 'view':
                      onView({ Id: recordId, attributes: { type: sobjectName } }, 'RELATED_RECORD_POPOVER');
                      break;
                    case 'edit':
                      onEdit({ Id: recordId, attributes: { type: sobjectName } }, 'RELATED_RECORD_POPOVER');
                      break;
                  }
                },
              }}
              contextMenuItems={TABLE_CONTEXT_MENU_ITEMS}
              contextMenuAction={handleContextMenuAction}
            />
          </DataTableSubqueryContext.Provider>
        </AutoFullHeightContainer>
      </Fragment>
    ) : null;
  }
);

export default SalesforceRecordDataTable;

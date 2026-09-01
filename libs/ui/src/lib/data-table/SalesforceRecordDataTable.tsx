/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { queryRemaining, queryRemainingSubqueryRecords } from '@jetstream/shared/data';
import { formatNumber, hasCtrlOrMeta, isEnterKey, tracker, useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import {
  flattenRecord,
  getErrorMessage,
  getIdFromRecordUrl,
  groupByFlat,
  hasIncompleteSubqueries,
  isInvalidQueryLocatorError,
  mergeQueryRecordPages,
  nullifyEmptyStrings,
  pluralizeFromNumber,
} from '@jetstream/shared/utils';
import {
  CloneEditView,
  ContextMenuItem,
  ErrorResult,
  Field,
  Maybe,
  QueryResult,
  QueryResults,
  SalesforceOrgUi,
  SobjectCollectionResponse,
} from '@jetstream/types';
import uniqueId from 'lodash/uniqueId';
import { Fragment, ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileDownloadModal } from '../file-download-modal/FileDownloadModal';
import { ariaDisabledButtonProps } from '../form/button/aria-disabled-button.utils';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import { ConfirmationModalPromise } from '../modal/ConfirmationModalPromise';
import { PopoverErrorButton } from '../popover/PopoverErrorButton';
import { fireToast } from '../toast/AppToast';
import Spinner from '../widgets/Spinner';
import Tooltip from '../widgets/Tooltip';
import { DataTableSubqueryContext } from './data-table-context';
import { RecordsSaveCaptureInfo, RecordsSaveOutcome, buildEditedRecordsExport, buildPriorRecordsExport } from './data-table-history-export';
import { applyPasteCellsToRows, revertCellsInRows } from './data-table-paste-utils';
import {
  ColumnWithFilter,
  ContextAction,
  ContextMenuActionData,
  GridCellRef,
  PasteEvent,
  RowSalesforceRecordWithKey,
  RowWithKey,
} from './data-table-types';
import {
  NON_DATA_COLUMN_KEYS,
  TABLE_CONTEXT_MENU_ITEMS,
  addFieldLabelToColumn,
  copySalesforceRecordTableDataToClipboard,
  getColumnDefinitions,
} from './data-table-utils';
import { DataTable } from './DataTable';
import { FieldMetadataModal } from './FieldMetadataModal';
import { replaceSubqueryOnRecord } from './grid/grid-row-utils';
import { RowsChangeData } from './grid/rdg-compat';
import { getRowErrorMessages, mapSaveErrorsToRow, summarizeRowErrors, validateRow } from './grid/validate-cell-value';
import { DownloadConfig, MAX_SAVE_BATCH_SIZE, PreviewChangesModal } from './PreviewChangesModal';

const SFDC_EMPTY_ID = '000000000000000AAA';
const MAX_UNDO_STEPS = 50;

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

/**
 * Recompute a row's client-validation state from its touched-and-changed cells, preserving any
 * record-level errors from a prior save. Returns a NEW row object (the GridCell memo keys on row
 * identity) with fresh `_fieldErrors`/`_fieldWarnings` and a derived `_saveError` summary.
 */
function applyValidationToRow(row: RowSalesforceRecordWithKey, fieldMetadata: Maybe<Record<string, Field>>): RowSalesforceRecordWithKey {
  const { fieldErrors, fieldWarnings } = validateRow(row, fieldMetadata);
  const recordErrors = row._recordErrors ?? [];
  return {
    ...row,
    _fieldErrors: fieldErrors,
    _fieldWarnings: fieldWarnings,
    _recordErrors: recordErrors,
    _saveError: summarizeRowErrors(fieldErrors, recordErrors),
  };
}

function isRowDirty(row: RowSalesforceRecordWithKey): boolean {
  return row._touchedColumns.size > 0 && Array.from(row._touchedColumns).some((col) => row[col] !== row._record[col]);
}

/**
 * Whether a row has CLIENT-side validation errors that guarantee the save would fail (value too long,
 * required field cleared, invalid number/date) — these gate the Save button. Recomputed fresh rather than
 * reading the stored `_fieldErrors`, which ALSO holds server-side save errors mapped from a prior failed
 * attempt: those must never block a retry, since the user may have fixed the cause in Salesforce (e.g.
 * disabled a validation rule, granted permission). Server errors stay visible (highlight + messages) but
 * always allow another save attempt.
 */
function rowHasBlockingErrors(row: RowSalesforceRecordWithKey, fieldMetadata: Maybe<Record<string, Field>>): boolean {
  const { fieldErrors } = validateRow(row, fieldMetadata);
  return Object.keys(fieldErrors).length > 0;
}

function getTotalCountText(queryResults: QueryResults['queryResults']) {
  // Big objects report -1 as totalSize
  if (queryResults.totalSize < 0 && !queryResults.done) {
    return `more than ${formatNumber(queryResults.records.length)}`;
  } else if (queryResults.totalSize < 0 && queryResults.done) {
    return formatNumber(queryResults.records.length);
  }
  return formatNumber(queryResults.totalSize || 0);
}

export interface SalesforceRecordDataTableProps {
  org: SalesforceOrgUi;
  isTooling: boolean;
  hasGoogleDriveAccess: boolean;
  googleShowUpgradeToPro: boolean;
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
  onSubqueryFieldReorder: (relationshipPath: string, fields: string[], columnOrder: number[]) => void;
  onLoadMoreRecords?: (queryResults: QueryResults<any>) => void;
  onEdit: (record: any, source: 'ROW_ACTION' | 'RELATED_RECORD_POPOVER') => void;
  onClone: (record: any, source: 'ROW_ACTION' | 'RELATED_RECORD_POPOVER') => void;
  onView: (record: any, source: 'ROW_ACTION' | 'RELATED_RECORD_POPOVER') => void;
  onUpdateRecords: (records: any[], options: { batchSize: number; serialMode: boolean }) => Promise<SobjectCollectionResponse>;
  onDelete: (record: any) => void;
  onUndelete: (record: any) => void;
  onGetAsApex: (record: any) => void;
  onSavedRecords: (results: { recordCount: number; failureCount: number }) => void;
  onReloadQuery: () => void;
  /**
   * Fired after a save settles (resolved OR threw) with Data-History-ready snapshots (edited/prior values
   * + outcome), captured BEFORE the save mutates each row's `_record` in place. Optional so `libs/ui`
   * stays free of the data-history service — the host wires this to the capture layer.
   */
  onRecordsSaveCapture?: (info: RecordsSaveCaptureInfo) => void;
  /** Amplitude tracker (from the host's `useAmplitude`). Optional — defaults to a no-op. */
  trackEvent?: (key: string, value?: Record<string, any>) => void;
}

export const SalesforceRecordDataTable = memo<SalesforceRecordDataTableProps>(
  ({
    org,
    defaultApiVersion,
    hasGoogleDriveAccess,
    googleShowUpgradeToPro,
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
    onUndelete,
    onGetAsApex,
    onSavedRecords,
    onRecordsSaveCapture,
    trackEvent = () => undefined,
  }: SalesforceRecordDataTableProps) => {
    const isMounted = useRef(true);
    const [columns, setColumns] = useState<ColumnWithFilter<RowSalesforceRecordWithKey>[]>();
    const [subqueryColumnsMap, setSubqueryColumnsMap] = useState<Record<string, ColumnWithFilter<RowSalesforceRecordWithKey, unknown>[]>>();
    const [records, setRecords] = useState<any[]>();
    // Same as records but with additional data added
    const [fields, setFields] = useState<string[]>([]);
    const [rows, setRows] = useState<RowSalesforceRecordWithKey[]>();
    const [dirtyRows, setDirtyRows] = useState<RowSalesforceRecordWithKey[]>([]);
    const [saveErrors, setSaveErrors] = useState<string[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    // Most recent save response, so the Preview modal can offer a results download.
    const [lastSaveResults, setLastSaveResults] = useState<Maybe<SobjectCollectionResponse>>(null);
    // When set, renders the FileDownloadModal (CSV/Excel/JSON/Google Drive) for the preview downloads.
    const [downloadConfig, setDownloadConfig] = useState<Maybe<DownloadConfig>>(null);

    const [totalRecordCountText, setTotalRecordCountText] = useState<string>();
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    // Completing truncated subqueries can take far longer than fetching the parent records, so it reports its own progress
    const [loadedChildRecordCount, setLoadedChildRecordCount] = useState(0);
    const [loadMoreErrorMessage, setLoadMoreErrorMessage] = useState<string | null>(null);
    const [hasMoreRecords, setHasMoreRecords] = useState(false);
    const [nextRecordsUrl, setNextRecordsUrl] = useState<Maybe<string>>(null);
    const [globalFilter, setGlobalFilter] = useState<string | null>(null);
    const [fieldMetaModal, setFieldMetaModal] = useState<{ field: Field; columnName: string } | null>(null);
    const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(() => new Set());
    const [visibleRecordCount, setVisibleRecordCount] = useState(records?.length);

    const [isSavingRecords, setIsSavingRecords] = useState(false);
    // Synchronous guard so a key-repeat / rapid Cmd+Enter can't launch concurrent saves before state flushes.
    const isSavingRef = useRef(false);
    // Save options surfaced in the Preview Changes modal. Held here (not in the modal) so they survive closing
    // and re-opening the modal — e.g. after a governor-limit failure the user lowers the batch size and retries.
    const [batchSize, setBatchSize] = useState<Maybe<number>>(MAX_SAVE_BATCH_SIZE);
    const [serialMode, setSerialMode] = useState(false);

    // Undo/redo history of `rows` snapshots for the current editing session (Ctrl/Cmd+Z). Each edit-commit
    // and paste pushes the pre-change rows. Snapshots are array references — edits create new row objects
    // rather than mutating in place, so this is cheap. Cleared on save and when records reload.
    const undoStackRef = useRef<RowSalesforceRecordWithKey[][]>([]);
    const redoStackRef = useRef<RowSalesforceRecordWithKey[][]>([]);

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
          fields.map((_, i) => i),
        );
        setSubqueryColumnsMap(subqueryColumns);
        setRecords(queryResults.queryResults.records);
        onFilteredRowsChanged(queryResults.queryResults.records);
        setTotalRecordCountText(getTotalCountText(queryResults.queryResults));
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

        setColumns(addFieldLabelToColumn(parentColumns, fieldMetadata) as unknown as ColumnWithFilter<RowSalesforceRecordWithKey>[]);

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
      // Flatten every field- + record-level message across dirty rows for the "Save Errors" popover.
      setSaveErrors(dirtyRows.flatMap((row) => getRowErrorMessages(row)));
    }, [dirtyRows]);

    const handleRowAction = useCallback((row: RowWithKey, action: 'view' | 'edit' | 'clone' | 'delete' | 'undelete' | 'apex') => {
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
        case 'undelete':
          onUndelete(record);
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
        if (item.value === 'VIEW_FIELD_METADATA') {
          const field = data.column.meta?.field as Field | undefined;
          if (field) {
            setFieldMetaModal({ field, columnName: String(data.column.name) });
            trackEvent?.(ANALYTICS_KEYS.query_FieldMetadataViewed, { type: field.type, isCustom: field.custom });
          }
          return;
        }
        copySalesforceRecordTableDataToClipboard(item.value, fields, data);
      },
      [fields, trackEvent],
    );

    // Offer "View field metadata" on a column header only when we have that field's describe stashed on
    const getColumnHeaderMenuItems = useCallback(
      (columnId: string): ContextMenuItem<ContextAction>[] => {
        const column = columns?.find((col) => col.key === columnId);
        const field = column?.meta?.field as Field | undefined;
        return field
          ? [
              {
                label: 'View field metadata',
                value: 'VIEW_FIELD_METADATA',
                leadingDivider: true,
              },
            ]
          : [];
      },
      [columns],
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
            _fieldErrors: {},
            _fieldWarnings: {},
            _recordErrors: [],
            _saveError: null,
          };
        }),
      );
      setDirtyRows([]);
      setShowPreview(false);
      setLastSaveResults(null);
      setDownloadConfig(null);
      undoStackRef.current = [];
      redoStackRef.current = [];
    }, [columns, handleRowAction, records]);

    /**
     * Replacing the records rebuilds every row, which drops in-progress edits - so anything that does it has to
     * offer the user a way out first. Resolves true when there is nothing to lose.
     */
    async function confirmDiscardUnsavedChanges(): Promise<boolean> {
      if (!dirtyRows?.length) {
        return true;
      }
      return ConfirmationModalPromise({ content: 'If you load these records your unsaved changes will not be saved.' });
    }

    /**
     * Load everything Salesforce held back: the remaining parent records, and the child records truncated from
     * subqueries at any depth.
     *
     * Child rows count toward a query's batch size, so a query can be reported as incomplete purely because a
     * parent's related records did not fit - in which case there are no parent records left to fetch at all, only
     * child records. Both halves are handled here because either one alone leaves an export short of records.
     */
    async function loadRemaining() {
      try {
        if (!(await confirmDiscardUnsavedChanges())) {
          return;
        }
        setIsLoadingMore(true);
        setLoadMoreErrorMessage(null);
        setLoadedChildRecordCount(0);

        let allRecords = records || [];
        let latestQueryResults = queryResults?.queryResults;

        if (nextRecordsUrl) {
          const results = await queryRemaining(org, nextRecordsUrl, isTooling);
          if (!isMounted.current) {
            return;
          }
          latestQueryResults = results.queryResults;
          allRecords = mergeQueryRecordPages(allRecords, results.queryResults.records);
          setNextRecordsUrl(results.queryResults.nextRecordsUrl);
        }

        allRecords = await queryRemainingSubqueryRecords(org, allRecords, isTooling, (fetched) => {
          if (isMounted.current) {
            setLoadedChildRecordCount(fetched);
          }
        });
        if (!isMounted.current) {
          return;
        }

        setHasMoreRecords(false);
        setRecords(allRecords);
        setTotalRecordCountText(
          getTotalCountText({ totalSize: latestQueryResults?.totalSize ?? allRecords.length, done: true, records: allRecords }),
        );
        setIsLoadingMore(false);
        // Hand back the complete record set rather than just the new page - the parent pages were merged by record
        // identity here, so appending them again upstream would double up any record that came back more than once.
        if (onLoadMoreRecords && queryResults) {
          onLoadMoreRecords({
            ...queryResults,
            queryResults: { ...queryResults.queryResults, done: true, nextRecordsUrl: undefined, records: allRecords },
          });
        }
      } catch (ex) {
        if (!isMounted.current) {
          return;
        }
        setIsLoadingMore(false);
        // An expired/evicted Salesforce query cursor can never succeed on retry — the query must be re-run
        if (isInvalidQueryLocatorError(ex)) {
          setHasMoreRecords(false);
          setLoadMoreErrorMessage('Your query results expired. Re-run your query to load all records.');
        } else {
          setLoadMoreErrorMessage('There was a problem loading the rest of the records.');
          tracker.warn('Load Remaining Records failed', ex);
        }
      }
    }

    // Read instead of the render's copy of `records`: the subquery modal can publish several loads in a row from
    // different levels, and each has to fold into the result of the one before it.
    const recordsRef = useRef(records);
    recordsRef.current = records;

    /**
     * A subquery cell finished loading the child records Salesforce had truncated. The completed set has to land
     * back on the record here *and* be handed to the host - the host's copy is what feeds the page level downloads
     * and copy-to-clipboard, so stopping at local state would leave the very exports this exists to fix incomplete.
     */
    const handleSubqueryRecordsLoaded = useCallback(
      (parentRowKey: string, relationshipName: string, subqueryResults: QueryResult<any>) => {
        const allRecords = replaceSubqueryOnRecord(recordsRef.current || [], parentRowKey, relationshipName, subqueryResults);
        recordsRef.current = allRecords;
        setRecords(allRecords);
        // Paging state is passed through as it stands rather than reported as complete - only child records were
        // fetched here, and any parent records still unloaded have to stay loadable.
        if (onLoadMoreRecords && queryResults) {
          onLoadMoreRecords({
            ...queryResults,
            queryResults: {
              ...queryResults.queryResults,
              done: !nextRecordsUrl,
              nextRecordsUrl: nextRecordsUrl ?? undefined,
              records: allRecords,
            },
          });
        }
      },
      [nextRecordsUrl, onLoadMoreRecords, queryResults],
    );

    const handleSortedAndFilteredRowsChange = useCallback(
      (rows: readonly RowSalesforceRecordWithKey[]) => {
        onFilteredRowsChanged(rows.map(({ _record }) => _record));

        setVisibleRecordCount(rows.length);
      },
      [onFilteredRowsChanged],
    );

    const handleSelectedRowsChange = useCallback((rows: Set<string>) => {
      setSelectedRows(rows);
    }, []);

    const onFieldsRef = useRef(onFields);
    onFieldsRef.current = onFields;

    const handleColumnReorder = useCallback((columns: string[], columnOrder: number[]) => {
      onFieldsRef.current(columns, columnOrder);
    }, []);

    const pushUndoSnapshot = useCallback((snapshot: RowSalesforceRecordWithKey[]) => {
      undoStackRef.current.push(snapshot);
      if (undoStackRef.current.length > MAX_UNDO_STEPS) {
        undoStackRef.current.shift();
      }
      // Any fresh edit invalidates the redo history.
      redoStackRef.current = [];
    }, []);

    const handleUndo = useCallback(() => {
      const previous = undoStackRef.current.pop();
      if (!previous) {
        return;
      }
      setRows((current) => {
        if (current) {
          redoStackRef.current.push(current);
        }
        return previous;
      });
      setDirtyRows(previous.filter(isRowDirty));
      trackEvent(ANALYTICS_KEYS.query_InlineEditUndo);
    }, [trackEvent]);

    const handleRedo = useCallback(() => {
      const next = redoStackRef.current.pop();
      if (!next) {
        return;
      }
      setRows((current) => {
        if (current) {
          undoStackRef.current.push(current);
        }
        return next;
      });
      setDirtyRows(next.filter(isRowDirty));
      trackEvent(ANALYTICS_KEYS.query_InlineEditRedo);
    }, [trackEvent]);

    const handleRowsChange = useCallback(
      (
        allRows: RowSalesforceRecordWithKey[],
        filteredRows: RowSalesforceRecordWithKey[],
        data: RowsChangeData<RowSalesforceRecordWithKey>,
      ) => {
        pushUndoSnapshot(allRows);
        // Re-run client validation only on the rows that actually changed (the editor carried over stale
        // validation state via its spread). Validating only the changed rows preserves prior save errors
        // on untouched rows.
        const changedKeys = new Set(data.indexes.map((index) => filteredRows[index]?._key).filter(Boolean));
        const validatedRows = filteredRows.map((row) => (changedKeys.has(row._key) ? applyValidationToRow(row, fieldMetadata) : row));
        const rowsByKey = groupByFlat(validatedRows, '_key');
        const newRows = allRows.map((row) => rowsByKey[row._key] || row);
        setRows(newRows);
        setDirtyRows(newRows.filter(isRowDirty));
      },
      [fieldMetadata, pushUndoSnapshot],
    );

    const handlePaste = useCallback(
      (event: PasteEvent) => {
        if (!rows || !event.cells.length) {
          return;
        }
        pushUndoSnapshot(rows);
        const newRows = applyPasteCellsToRows(rows, event.cells, fieldMetadata);
        setRows(newRows);
        setDirtyRows(newRows.filter(isRowDirty));
        // Delete/Backspace also flows through here with source 'clear'.
        trackEvent(event.source === 'clear' ? ANALYTICS_KEYS.query_InlineEditClear : ANALYTICS_KEYS.query_InlineEditPaste, {
          cellCount: event.cells.length,
        });
      },
      [rows, fieldMetadata, pushUndoSnapshot, trackEvent],
    );

    const rowsByKey = useMemo(() => new Map((rows ?? []).map((row) => [row._key, row])), [rows]);

    const isCellDirty = useCallback(
      (rowId: string, columnId: string): boolean => {
        const row = rowsByKey.get(rowId);
        return !!row && row._touchedColumns.has(columnId) && row[columnId] !== row._record?.[columnId];
      },
      [rowsByKey],
    );

    const handleRevertCells = useCallback(
      (cells: GridCellRef[]) => {
        if (!rows || !cells.length) {
          return;
        }
        pushUndoSnapshot(rows);
        const newRows = revertCellsInRows(rows, cells, fieldMetadata);
        setRows(newRows);
        setDirtyRows(newRows.filter(isRowDirty));
        trackEvent(ANALYTICS_KEYS.query_InlineEditRevert, { cellCount: cells.length });
      },
      [rows, fieldMetadata, pushUndoSnapshot, trackEvent],
    );

    const handleDownload = useCallback(
      (config: DownloadConfig) => {
        setDownloadConfig(config);
        trackEvent(ANALYTICS_KEYS.query_InlineEditDownload, { source: config.source, recordCount: config.data.length });
      },
      [trackEvent],
    );

    const handleCancelEditMode = () => {
      setRecords((records) => (records ? [...records] : records));
    };

    /**
     * Hand the edited/prior snapshots plus the save outcome to the host for Data History. Built via the
     * shared export builders so the history payload matches the "Download Changes"/"Download Results"
     * files. Must run BEFORE the post-save row mapping mutates each row's `_record` in place (which would
     * make a later diff drop every field). Isolated in its own try/catch: the records may already be
     * saved in Salesforce, so a capture failure must never reach the save's catch (which would leave rows
     * dirty and invite a duplicate save).
     */
    const captureSaveForHistory = (rowsToCapture: RowSalesforceRecordWithKey[], outcome: RecordsSaveOutcome) => {
      try {
        onRecordsSaveCapture?.({
          editedRecords: buildEditedRecordsExport(rowsToCapture),
          priorRecords: buildPriorRecordsExport(rowsToCapture),
          ...outcome,
        });
      } catch (ex) {
        logger.warn('Error capturing save for data history', ex);
      }
    };

    const handleSaveRecords = async () => {
      // Guards stay OUTSIDE the try: an early `return` inside it still runs the `finally`, which would
      // clear isSavingRef / saving state while a concurrent save is mid-flight — allowing overlapping saves.
      if (!rows || isSavingRef.current) {
        return;
      }
      if (!dirtyRows.length) {
        setRecords((records) => (records ? [...records] : records));
        return;
      }
      // Don't waste an API call on edits the client already knows are invalid (e.g. value too long).
      if (dirtyRows.some((row) => rowHasBlockingErrors(row, fieldMetadata))) {
        fireToast({ message: 'Please fix the highlighted errors before saving.', type: 'warning' });
        return;
      }
      isSavingRef.current = true;
      setIsSavingRecords(true);
      // Drop stale results up front so a thrown save can't leave the previous attempt's "Download Results" offered.
      setLastSaveResults(null);
      // Saving commits values into `_record`, which would corrupt pre-save snapshots — drop undo history.
      undoStackRef.current = [];
      redoStackRef.current = [];
      try {
        const modifiedRecords = dirtyRows.map((row) =>
          nullifyEmptyStrings(
            Array.from(row._touchedColumns).reduce<Record<string, any>>(
              (acc, column) => {
                acc[column] = row[column];
                return acc;
              },
              { attributes: row._record.attributes, Id: getIdFromRecordUrl(row._record.attributes.url) },
            ),
          ),
        );
        const results = await onUpdateRecords(modifiedRecords, {
          batchSize: batchSize ?? MAX_SAVE_BATCH_SIZE,
          serialMode,
        });
        setLastSaveResults(results);

        // Capture BEFORE the newRows mapping below mutates each row's `_record` in place.
        captureSaveForHistory(dirtyRows, { results });

        const failedResultsById = results.reduce<Record<string, ErrorResult>>((acc, result, i) => {
          if (!result.success) {
            const id = result.id || getIdFromRecordUrl(dirtyRows[i]._record.attributes.url);
            if (id) {
              acc[id] = result;
            }
          }
          return acc;
        }, {});

        /** Reset all successful rows, map field/record-level errors onto failed rows */
        const newRows = rows.map((row): RowSalesforceRecordWithKey => {
          if (row._touchedColumns.size > 0) {
            const id = getIdFromRecordUrl(row._record.attributes.url);
            const failed = failedResultsById[id];
            if (failed) {
              const { fieldErrors, recordErrors } = mapSaveErrorsToRow(failed, columns || []);
              return {
                ...row,
                _fieldErrors: fieldErrors,
                _fieldWarnings: {},
                _recordErrors: recordErrors,
                _saveError: summarizeRowErrors(fieldErrors, recordErrors),
              };
            } else {
              const tempRow: RowSalesforceRecordWithKey = {
                ...row,
                _touchedColumns: new Set(),
                _fieldErrors: {},
                _fieldWarnings: {},
                _recordErrors: [],
                _saveError: null,
              };
              Array.from(row._touchedColumns).forEach((col) => (tempRow._record[col] = row[col]));
              return tempRow;
            }
          }
          if (row._saveError || row._recordErrors?.length || (row._fieldErrors && Object.keys(row._fieldErrors).length)) {
            return { ...row, _fieldErrors: {}, _fieldWarnings: {}, _recordErrors: [], _saveError: null };
          }
          return row;
        });
        setRows(newRows);
        setDirtyRows(newRows.filter(isRowDirty));
        onSavedRecords({ recordCount: modifiedRecords.length, failureCount: Object.values(failedResultsById).length });
      } catch (ex) {
        // This happens if exception thrown, normal behavior is to get records with result success/error
        logger.warn('Error saving records', ex);
        // A thrown save (network error, expired session, timeout) still gets captured to Data
        // History — a timed-out request may even have applied server-side, so "no record of the
        // attempt" is the worst outcome.
        captureSaveForHistory(dirtyRows, { errorMessage: getErrorMessage(ex) || 'The save request failed' });
        fireToast({
          message: `There was a problem saving your records. ${getErrorMessage(ex) || ''}`,
          type: 'error',
        });
        tracker.error('Error saving records - inline query', ex);
      } finally {
        isSavingRef.current = false;
        setIsSavingRecords(false);
      }
    };

    // Cmd/Ctrl+Enter opens the Preview Changes modal (the modal then owns the shortcut to actually save).
    // A live ref (updated in an effect, never during render) lets the stable global handler read the latest
    // state, and deferring to the next tick lets an in-progress cell edit (committed on Enter) settle into
    // dirty state first. No-ops when there is nothing to preview or the modal is already open.
    const openPreviewRef = useRef<() => void>(() => undefined);
    useEffect(() => {
      openPreviewRef.current = () => {
        if (showPreview || isSavingRef.current || !dirtyRows.length) {
          return;
        }
        setShowPreview(true);
        trackEvent(ANALYTICS_KEYS.query_InlineEditPreview, { changeCount: dirtyRows.length });
      };
    });
    const handlePreviewShortcut = useCallback((event: KeyboardEvent) => {
      if (!isEnterKey(event as any) || !hasCtrlOrMeta(event as any)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      window.setTimeout(() => openPreviewRef.current());
    }, []);
    useGlobalEventHandler('keydown', handlePreviewShortcut);

    function handleSubqueryFieldsChanged(relationshipPath: string, newFields: string[], columnOrder: number[]) {
      onSubqueryFieldReorder(relationshipPath, newFields, columnOrder);
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

    // Stable context for the grid's generic bag. An inline object here gave the grid a new `context`
    // identity on every render (search keystroke, selection, dirty-row change), which churned the grid's
    // record-action context and re-rendered every link/popover cell. Keyed on the callbacks it closes over.
    const tableContext = useMemo(
      () => ({
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
      }),
      [org, defaultApiVersion, onView, onEdit],
    );

    const hasBlockingErrors = useMemo(() => dirtyRows.some((row) => rowHasBlockingErrors(row, fieldMetadata)), [dirtyRows, fieldMetadata]);

    // Salesforce reports the query as incomplete when child records were truncated, but the records are what say
    // what is actually missing - this also covers a complete set of parents whose related records were cut short.
    const hasRecordsToLoad = useMemo(() => hasMoreRecords || !!records?.some(hasIncompleteSubqueries), [hasMoreRecords, records]);
    // "Load All Records" unmounts once everything is loaded; if focus was on it, hand it to the record filter
    const wasLoadingMoreRef = useRef(false);
    useEffect(() => {
      if (wasLoadingMoreRef.current && !isLoadingMore && !hasRecordsToLoad && document.activeElement === document.body) {
        document.getElementById('record-filter')?.focus();
      }
      wasLoadingMoreRef.current = isLoadingMore;
    }, [isLoadingMore, hasRecordsToLoad]);

    return records ? (
      <Fragment>
        <Grid className="slds-p-around_xx-small" align="spread">
          <div className="slds-grid">
            <div className="slds-p-around_x-small">
              Showing {formatNumber(visibleRecordCount)} of {totalRecordCountText} records
            </div>
            {hasRecordsToLoad && (
              <div>
                <Tooltip
                  openDelay={1000}
                  content="Fetch every record Salesforce left out, including related records missing from subqueries."
                >
                  <button
                    className="slds-button slds-button_brand slds-m-left_x-small slds-is-relative"
                    {...ariaDisabledButtonProps(isLoadingMore, loadRemaining)}
                  >
                    Load All Records
                    {isLoadingMore && <Spinner size="small" />}
                  </button>
                </Tooltip>
                {isLoadingMore && !!loadedChildRecordCount && (
                  <span className="slds-m-left_x-small slds-text-body_small">
                    Loaded {formatNumber(loadedChildRecordCount)} related {pluralizeFromNumber('record', loadedChildRecordCount)}
                  </span>
                )}
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
              background-color: var(--slds-g-color-surface-container-2, #f3f3f3);
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
              className="slds-button slds-button_brand slds-m-left_x-small"
              onClick={() => {
                setShowPreview(true);
                trackEvent(ANALYTICS_KEYS.query_InlineEditPreview, { changeCount: dirtyRows.length });
              }}
              disabled={isSavingRecords}
            >
              Preview Changes ({formatNumber(dirtyRows.length)})
            </button>
          </Grid>
        )}
        {showPreview && (
          <PreviewChangesModal
            org={org}
            serverUrl={serverUrl}
            skipFrontdoorLogin={skipFrontdoorLogin}
            isTooling={isTooling}
            dirtyRows={dirtyRows}
            columns={columns || []}
            fieldMetadata={fieldMetadata}
            isSaving={isSavingRecords}
            hasBlockingErrors={hasBlockingErrors}
            saveErrors={saveErrors}
            saveResults={lastSaveResults}
            batchSize={batchSize}
            serialMode={serialMode}
            onBatchSizeChange={setBatchSize}
            onSerialModeChange={setSerialMode}
            onSave={handleSaveRecords}
            onDownload={handleDownload}
            isHidden={!!downloadConfig}
            onDiscard={() => {
              handleCancelEditMode();
              setShowPreview(false);
              trackEvent(ANALYTICS_KEYS.query_InlineEditDiscard, { changeCount: dirtyRows.length });
            }}
            onClose={() => setShowPreview(false)}
          />
        )}
        {downloadConfig && (
          <FileDownloadModal
            org={org}
            googleIntegrationEnabled={hasGoogleDriveAccess}
            googleShowUpgradeToPro={googleShowUpgradeToPro}
            google_apiKey={google_apiKey}
            google_appId={google_appId}
            google_clientId={google_clientId}
            modalHeader={downloadConfig.modalHeader}
            data={downloadConfig.data}
            header={downloadConfig.header}
            fileNameParts={downloadConfig.fileNameParts}
            source={downloadConfig.source}
            trackEvent={trackEvent}
            onModalClose={() => setDownloadConfig(null)}
          />
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
              onSubqueryRecordsLoaded: handleSubqueryRecordsLoaded,
              confirmReplaceRecords: confirmDiscardUnsavedChanges,
              hasGoogleDriveAccess,
              googleShowUpgradeToPro,
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
              onRowsChange={(changedRows, data) => handleRowsChange(rows || [], changedRows, data)}
              onPaste={handlePaste}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onRevertCells={handleRevertCells}
              isCellDirty={isCellDirty}
              context={tableContext}
              contextMenuItems={TABLE_CONTEXT_MENU_ITEMS}
              contextMenuAction={handleContextMenuAction}
              getColumnHeaderMenuItems={getColumnHeaderMenuItems}
            />
          </DataTableSubqueryContext.Provider>
        </AutoFullHeightContainer>
        {fieldMetaModal && (
          <FieldMetadataModal
            field={fieldMetaModal.field}
            columnName={fieldMetaModal.columnName}
            onClose={() => setFieldMetaModal(null)}
            onDownload={() => trackEvent?.(ANALYTICS_KEYS.query_FieldMetadataDownloaded, { type: fieldMetaModal.field.type })}
          />
        )}
      </Fragment>
    ) : null;
  },
);

export default SalesforceRecordDataTable;

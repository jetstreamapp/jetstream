/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { queryRemainingSubqueryResults } from '@jetstream/shared/data';
import { appActionObservable, formatNumber } from '@jetstream/shared/ui-utils';
import { flattenRecord, getSubqueryPath, isIncompleteSubqueryResult, pluralizeFromNumber } from '@jetstream/shared/utils';
import { CloneEditView, ContextMenuItem, QueryResult } from '@jetstream/types';
import { RowSelectionState } from '@tanstack/react-table';
import { Dispatch, ReactNode, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RecordDownloadModal from '../../../file-download-modal/RecordDownloadModal';
import Grid from '../../../grid/Grid';
import AutoFullHeightContainer from '../../../layout/AutoFullHeightContainer';
import Modal from '../../../modal/Modal';
import { Popover, PopoverRef } from '../../../popover/Popover';
import { Breadcrumbs } from '../../../widgets/Breadcrumbs';
import { CopyRecordsToClipboardButton } from '../../../widgets/CopyRecordsToClipboardButton';
import Icon from '../../../widgets/Icon';
import Spinner from '../../../widgets/Spinner';
import Tooltip from '../../../widgets/Tooltip';
import { DataTableV2 } from '../DataTableV2';
import { copySalesforceRecordTableDataToClipboard } from '../grid-clipboard';
import { DEFAULT_ROW_HEIGHT, NON_DATA_COLUMN_KEYS, TABLE_CONTEXT_MENU_ITEMS } from '../grid-constants';
import { GridSubqueryContext } from '../grid-context';
import { getRowId, getSubqueryModalTagline, replaceSubqueryOnRecord } from '../grid-row-utils';
import { ContextAction, ContextMenuActionData, DataTableCellProps, RowWithKey, SubqueryContext, SubqueryLevel } from '../grid-types';

/**
 * Subquery cell — shows "N Records", plus a warning when Salesforce truncated the child records.
 *
 * At the top level it opens a modal with a nested data table (load-remaining + export). Salesforce allows subqueries to
 * be nested, so when this renders inside that modal it instead drills the modal down a level, which keeps navigation in
 * a single modal with a breadcrumb trail rather than stacking a modal per level.
 */
export const SubqueryRenderer = ({ column, row }: DataTableCellProps<RowWithKey>): ReactNode => {
  const [isActive, setIsActive] = useState(false);
  const [levels, setLevels] = useState<SubqueryLevel[]>([]);
  const queryResults: QueryResult<any> | undefined = row[column.key];
  const records = queryResults?.records;
  // Memoized because the check walks every child record, and the grid re-renders these cells on any scroll or
  // selection change.
  const isIncomplete = useMemo(() => isIncompleteSubqueryResult(queryResults), [queryResults]);

  if (!queryResults || !Array.isArray(records) || records.length === 0) {
    return <div />;
  }

  return (
    <GridSubqueryContext.Consumer>
      {(props) => {
        if (!props) {
          return null;
        }
        const relationshipPath = getSubqueryPath(props.nestedRender?.relationshipPath ?? '', column.key);
        const columns = props.columnDefinitions?.[relationshipPath.toLowerCase()];
        if (!columns) {
          return null;
        }
        const level: SubqueryLevel = { relationshipPath, columnKey: column.key, queryResults, parentRecord: row };

        function handleClick() {
          if (props?.nestedRender) {
            props.nestedRender.onDrillDown(level);
            return;
          }
          // The modal works against its own copy of the stack, rebuilt each time from the record - loading more
          // records writes them back through `onSubqueryRecordsLoaded`, so the record is always the newer copy.
          setLevels([level]);
          setIsActive(true);
        }

        return (
          <Grid verticalAlign="center">
            {isActive && !props.nestedRender && levels.length > 0 && (
              <SubqueryModal levels={levels} setLevels={setLevels} onClose={() => setIsActive(false)} {...props} />
            )}
            <button className="slds-button" tabIndex={-1} onClick={handleClick}>
              <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
              {`${formatNumber(records.length)} Records`}
            </button>
            {isIncomplete && (
              <IncompleteSubqueryPopover
                org={props.org}
                isTooling={props.isTooling}
                onSubqueryRecordsLoaded={props.onSubqueryRecordsLoaded}
                confirmReplaceRecords={props.confirmReplaceRecords}
                relationshipName={column.key}
                queryResults={queryResults}
                rowKey={row._key}
              />
            )}
          </Grid>
        );
      }}
    </GridSubqueryContext.Consumer>
  );
};

interface IncompleteSubqueryPopoverProps extends Pick<
  SubqueryContext,
  'org' | 'isTooling' | 'onSubqueryRecordsLoaded' | 'confirmReplaceRecords'
> {
  relationshipName: string;
  queryResults: QueryResult<any>;
  rowKey: string;
}

/**
 * Salesforce counts child rows toward the query's batch size, so a parent with many related records comes back with
 * only some of them. Nothing else in the table shows that the count in the cell is short of the real total, which is
 * how an export silently ends up missing records - hence the warning, and the offer to fetch the rest.
 */
function IncompleteSubqueryPopover({
  relationshipName,
  queryResults,
  rowKey,
  org,
  isTooling,
  onSubqueryRecordsLoaded,
  confirmReplaceRecords,
}: IncompleteSubqueryPopoverProps) {
  const [isLoading, setIsLoading] = useState(false);
  const popoverRef = useRef<PopoverRef>(null);
  const { records, done, totalSize, nextRecordsUrl } = queryResults;
  const isTruncatedItself = !done && !!nextRecordsUrl;

  async function handleLoadRemaining() {
    if (isLoading || !onSubqueryRecordsLoaded) {
      return;
    }
    // Asked before fetching: applying the records is what discards unsaved inline edits, and asking afterwards
    // would mean throwing away a load the user just waited for.
    if (confirmReplaceRecords && !(await confirmReplaceRecords())) {
      popoverRef.current?.close();
      return;
    }
    setIsLoading(true);
    try {
      onSubqueryRecordsLoaded(rowKey, relationshipName, await queryRemainingSubqueryResults(org, queryResults, isTooling));
      popoverRef.current?.close();
    } catch (ex) {
      // Query errors surface via the shared data layer; leave the popover open so the action can be retried
      logger.warn('[SUBQUERY] Unable to load remaining subquery records', ex);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Popover
      ref={popoverRef}
      placement="bottom"
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small">Related records not fully loaded</h2>
        </header>
      }
      content={
        <div className="slds-is-relative">
          {isLoading && <Spinner size="small" />}
          {isTruncatedItself ? (
            <p>
              Salesforce returned {formatNumber(records.length)} of {formatNumber(totalSize)} {relationshipName} records.
            </p>
          ) : (
            <p>Salesforce did not return all of the records related to these {relationshipName} records.</p>
          )}
          <p className="slds-m-top_x-small">Exports and the record count in this cell only cover the records already loaded.</p>
          {onSubqueryRecordsLoaded && (
            <button className="slds-button slds-button_brand slds-m-top_x-small" disabled={isLoading} onClick={handleLoadRemaining}>
              Load remaining records
            </button>
          )}
        </div>
      }
      buttonProps={{
        className: 'slds-button slds-button_icon',
        title: 'Some related records were not loaded',
        'aria-label': 'Some related records were not loaded',
        tabIndex: -1,
      }}
    >
      <Icon
        type="utility"
        icon="warning"
        className="slds-icon slds-icon_x-small slds-icon-text-warning"
        containerClassname="slds-icon_container slds-icon-utility-warning"
      />
    </Popover>
  );
}

interface SubqueryModalProps extends SubqueryContext {
  levels: SubqueryLevel[];
  setLevels: Dispatch<SetStateAction<SubqueryLevel[]>>;
  onClose: () => void;
}

/**
 * Write a level's updated records back through the stack.
 *
 * Every level's records physically live inside its parent's records, so records loaded at any depth only become
 * part of the record that owns the whole tree by being folded back up one level at a time.
 */
function applyQueryResultsToLevels(levels: SubqueryLevel[], levelIndex: number, queryResults: QueryResult<any>): SubqueryLevel[] {
  const updated = levels.slice();
  updated[levelIndex] = { ...levels[levelIndex], queryResults };
  for (let index = levelIndex; index > 0; index--) {
    const child = updated[index];
    const parent = updated[index - 1];
    const records = replaceSubqueryOnRecord(parent.queryResults.records, getRowId(child.parentRecord), child.columnKey, child.queryResults);
    updated[index - 1] = { ...parent, queryResults: { ...parent.queryResults, records } };
  }
  return updated;
}

/**
 * Owns the drill-down stack for nested subqueries. The last entry is what the table is showing; everything before it
 * becomes a breadcrumb the user can navigate back to.
 */
function SubqueryModal({
  levels,
  setLevels,
  isTooling,
  org,
  serverUrl,
  skipFrontdoorLogin,
  hasGoogleDriveAccess,
  googleShowUpgradeToPro,
  google_apiKey,
  google_appId,
  google_clientId,
  columnDefinitions,
  onSubqueryFieldReorder,
  onSubqueryRecordsLoaded,
  confirmReplaceRecords,
  onClose,
}: SubqueryModalProps) {
  const isMounted = useRef(true);
  const [downloadModalIsActive, setDownloadModalIsActive] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadedRecordCount, setLoadedRecordCount] = useState(0);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [filteredRows, setFilteredRows] = useState<readonly RowWithKey[]>([]);
  // Guards against re-entry while a load is in flight (the loading state hasn't re-rendered yet).
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const currentLevel = levels[levels.length - 1];
  const { records, totalSize } = currentLevel.queryResults;
  // "Load Remaining" covers this level's own paging plus anything truncated in the subqueries nested within it
  const isLevelIncomplete = useMemo(() => isIncompleteSubqueryResult(currentLevel.queryResults), [currentLevel.queryResults]);
  // Memoized so the empty fallback keeps a stable identity - the rows/fields memo below feeds an effect
  // that calls setFields, which would re-render endlessly on a new array every render.
  const columns = useMemo(
    () => columnDefinitions?.[currentLevel.relationshipPath.toLowerCase()] || [],
    [columnDefinitions, currentLevel.relationshipPath],
  );

  const handleRowAction = useCallback(() => undefined, []);

  const handleDrillDown = useCallback(
    (level: SubqueryLevel) => {
      setLevels((prev) => [...prev, level]);
    },
    [setLevels],
  );

  function handleCloseModal(canceled?: boolean) {
    if (typeof canceled === 'boolean' && canceled) {
      setDownloadModalIsActive(false);
    } else {
      setDownloadModalIsActive(false);
      onClose();
    }
  }

  /**
   * Apply records loaded at `levelIndex` to the stack and hand the rebuilt root back to the record that owns it.
   *
   * The owner is notified even when the user has navigated away from that level in the meantime - the records were
   * fetched either way, and dropping them would leave the table claiming they are still missing.
   */
  function publishLevelResults(levelIndex: number, level: SubqueryLevel, queryResults: QueryResult<any>) {
    const [rootLevel] = applyQueryResultsToLevels(levels, levelIndex, queryResults);
    onSubqueryRecordsLoaded?.(rootLevel.parentRecord._key, rootLevel.columnKey, rootLevel.queryResults);
    if (isMounted.current) {
      // Functional update against the stack's latest value. Levels are only ever appended or truncated, never
      // swapped in place, so an identity mismatch means the level the records belong to is no longer open.
      setLevels((prev) => (prev[levelIndex] === level ? applyQueryResultsToLevels(prev, levelIndex, queryResults) : prev));
    }
  }

  /** A subquery nested inside the level on screen finished loading whatever Salesforce had truncated from it. */
  const handleNestedSubqueryRecordsLoaded = (parentRowKey: string, relationshipName: string, queryResults: QueryResult<any>) => {
    const levelIndex = levels.length - 1;
    const level = levels[levelIndex];
    const records = replaceSubqueryOnRecord(level.queryResults.records, parentRowKey, relationshipName, queryResults);
    publishLevelResults(levelIndex, level, { ...level.queryResults, records });
  };

  /**
   * Fetch everything Salesforce left out of this level, including any subqueries nested within its records - paging
   * a locator one batch at a time only made the user click the same button over and over.
   */
  async function loadRemaining() {
    // Guard before the try so the finally only runs for calls that actually start a load.
    if (!isLevelIncomplete || isLoadingMoreRef.current) {
      return;
    }
    // These records are folded back into the record the table owns, which rebuilds its rows and drops any
    // in-progress inline edits - so ask first, before the fetch, exactly as the cell warning popover does.
    if (confirmReplaceRecords && !(await confirmReplaceRecords())) {
      return;
    }
    // Pin the level the request belongs to. The table and breadcrumbs stay interactive while loading, so by the
    // time the response lands the user may have drilled down or navigated back and a different level is on top.
    const targetLevel = currentLevel;
    const targetIndex = levels.length - 1;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadedRecordCount(0);
    try {
      const queryResults = await queryRemainingSubqueryResults(org, targetLevel.queryResults, isTooling, (fetched) => {
        if (isMounted.current) {
          setLoadedRecordCount(fetched);
        }
      });
      publishLevelResults(targetIndex, targetLevel, queryResults);
    } catch (ex) {
      // Query errors surface via the shared data layer; just stop the spinner here.
      logger.warn('[SUBQUERY] Unable to load remaining subquery records', ex);
    } finally {
      isLoadingMoreRef.current = false;
      if (isMounted.current) {
        setIsLoadingMore(false);
      }
    }
  }

  const { fields: initialFields, rows } = useMemo(() => {
    const columnKeys = columns?.map((col) => col.key) || null;
    const fields = columns.filter((column) => column.key && !NON_DATA_COLUMN_KEYS.has(column.key)).map((column) => column.key);
    const rows = records.map((row) => ({
      _key: getRowId(row),
      _action: handleRowAction,
      _record: row,
      ...(columnKeys ? flattenRecord(row, columnKeys, false) : row),
    }));
    return { fields, rows };
  }, [columns, handleRowAction, records]);

  const [fields, setFields] = useState(initialFields);
  useEffect(() => {
    setFields(initialFields);
  }, [initialFields]);

  // Each level has its own records, so a selection made before drilling down or navigating back is meaningless
  // once a different level is on top. Loading more records keeps both values, preserving the selection there.
  useEffect(() => {
    setRowSelection({});
  }, [currentLevel.relationshipPath, levels.length]);

  const selectedRecords = useMemo(() => rows.filter(({ _key }) => rowSelection[_key]).map(({ _record }) => _record), [rows, rowSelection]);
  const filteredRecords = useMemo(() => filteredRows.map(({ _record }) => _record), [filteredRows]);

  /**
   * Relationship paths nested beneath the level being viewed, relative to it and cased to match the record keys,
   * so the download modal can split them into their own worksheets instead of emitting JSON blobs.
   */
  const subqueryFields = useMemo(() => {
    const output: Record<string, string[]> = {};
    const collect = (relationshipPath: string, relativePath: string) => {
      const nestedColumns = columnDefinitions?.[relationshipPath.toLowerCase()];
      if (!nestedColumns) {
        return;
      }
      const nestedFields = nestedColumns.filter((column) => column.key && !NON_DATA_COLUMN_KEYS.has(column.key)).map(({ key }) => key);
      output[relativePath] = nestedFields;
      nestedFields.forEach((key) => collect(getSubqueryPath(relationshipPath, key), getSubqueryPath(relativePath, key)));
    };
    fields.forEach((key) => collect(getSubqueryPath(currentLevel.relationshipPath, key), key));
    return output;
  }, [columnDefinitions, currentLevel.relationshipPath, fields]);

  const handleContextMenuAction = useCallback(
    (item: ContextMenuItem<ContextAction>, data: ContextMenuActionData<RowWithKey>) => {
      copySalesforceRecordTableDataToClipboard(item.value as ContextAction, fields, data);
    },
    [fields],
  );

  const handleSortedAndFilteredRowsChange = useCallback((rows: readonly RowWithKey[]) => {
    setFilteredRows(rows);
  }, []);

  const handleColumnReorder = useCallback(
    (reordered: string[], columnOrder: number[]) => {
      setFields(reordered);
      onSubqueryFieldReorder?.(currentLevel.relationshipPath, reordered, columnOrder);
    },
    [currentLevel.relationshipPath, onSubqueryFieldReorder],
  );

  const subqueryContext: SubqueryContext = {
    isTooling,
    org,
    serverUrl,
    skipFrontdoorLogin,
    hasGoogleDriveAccess,
    googleShowUpgradeToPro,
    google_apiKey,
    google_appId,
    google_clientId,
    columnDefinitions,
    onSubqueryFieldReorder,
    onSubqueryRecordsLoaded: handleNestedSubqueryRecordsLoaded,
    // Records loaded here are folded back into the record the table owns, so the same warning about unsaved edits applies
    confirmReplaceRecords,
    nestedRender: { relationshipPath: currentLevel.relationshipPath, onDrillDown: handleDrillDown },
  };

  return (
    <>
      {!downloadModalIsActive && (
        <Modal
          size="lg"
          header={currentLevel.columnKey}
          tagline={
            <>
              {getSubqueryModalTagline(currentLevel.parentRecord)}
              {levels.length > 1 && (
                <>
                  <hr className="slds-m-vertical_small" />
                  <Breadcrumbs
                    items={levels.slice(0, -1).map((level, index) => ({
                      id: `${level.relationshipPath}-${index}`,
                      label: level.columnKey,
                      metadata: index,
                    }))}
                    currentItem={currentLevel.columnKey}
                    onClick={(item) => setLevels((prev) => prev.slice(0, (item.metadata as number) + 1))}
                  />
                </>
              )}
            </>
          }
          closeOnBackdropClick
          onClose={handleCloseModal}
          footerClassName="slds-is-relative"
          overrideZIndex={1001}
          footer={
            <Grid align="spread" verticalAlign="end" divProps={{ onContextMenu: (ev) => (ev.preventDefault(), ev.stopPropagation()) }}>
              <Grid verticalAlign="end">
                <span className="slds-m-right_small">
                  Showing {formatNumber(records.length)} of {formatNumber(totalSize)} records
                </span>
                {isLevelIncomplete && (
                  <Tooltip openDelay={1000} content="Fetch every related record Salesforce left out, including nested subqueries.">
                    <button className="slds-button slds-button_neutral" disabled={isLoadingMore} onClick={() => loadRemaining()}>
                      Load Remaining
                    </button>
                  </Tooltip>
                )}
                {isLoadingMore && (
                  <>
                    <Spinner size="small" />
                    <span className="slds-m-left_small slds-text-body_small">
                      Loaded {formatNumber(loadedRecordCount)} related {pluralizeFromNumber('record', loadedRecordCount)}
                    </span>
                  </>
                )}
              </Grid>
              <Grid verticalAlign="end">
                <CopyRecordsToClipboardButton
                  containerClassName="slds-m-right_xx-small"
                  fields={fields}
                  records={records}
                  filteredRecords={filteredRecords}
                  selectedRecords={selectedRecords}
                />
                <button className="slds-button slds-button_brand" onClick={() => setDownloadModalIsActive(true)}>
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Download Records
                </button>
              </Grid>
            </Grid>
          }
        >
          <div className="slds-scrollable_x" onContextMenu={(ev) => (ev.preventDefault(), ev.stopPropagation())}>
            <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
              <GridSubqueryContext.Provider value={subqueryContext}>
                <DataTableV2
                  serverUrl={serverUrl}
                  skipFrontdoorLogin={skipFrontdoorLogin}
                  org={org}
                  data={rows}
                  columns={columns}
                  getRowKey={getRowId}
                  rowHeight={DEFAULT_ROW_HEIGHT}
                  enableRowSelection
                  rowSelection={rowSelection}
                  onRowSelectionChange={setRowSelection}
                  contextMenuItems={TABLE_CONTEXT_MENU_ITEMS}
                  contextMenuAction={handleContextMenuAction}
                  onReorderColumns={handleColumnReorder}
                  onSortedAndFilteredRowsChange={handleSortedAndFilteredRowsChange}
                  context={{
                    org,
                    onRecordAction: (action: CloneEditView, recordId: string, objectName: string) => {
                      if (action === 'view') {
                        appActionObservable.next({ action: 'VIEW_RECORD', payload: { recordId, objectName } });
                      } else if (action === 'edit') {
                        appActionObservable.next({ action: 'EDIT_RECORD', payload: { recordId, objectName } });
                      }
                    },
                  }}
                />
              </GridSubqueryContext.Provider>
            </AutoFullHeightContainer>
          </div>
        </Modal>
      )}
      {downloadModalIsActive && (
        <RecordDownloadModal
          org={org}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          downloadModalOpen
          fields={fields}
          subqueryFields={subqueryFields}
          records={records}
          filteredRecords={filteredRecords}
          selectedRecords={selectedRecords}
          onModalClose={handleCloseModal}
          source="data_table_subquery"
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          trackEvent={() => {}}
        />
      )}
    </>
  );
}

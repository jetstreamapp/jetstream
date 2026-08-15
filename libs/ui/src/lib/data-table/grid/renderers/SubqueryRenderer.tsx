/* eslint-disable @typescript-eslint/no-explicit-any */
import { queryMore } from '@jetstream/shared/data';
import { appActionObservable, copyRecordsToClipboard, formatNumber } from '@jetstream/shared/ui-utils';
import { flattenRecord, getSubqueryPath } from '@jetstream/shared/utils';
import { CloneEditView, ContextMenuItem, QueryResult } from '@jetstream/types';
import { Dispatch, ReactNode, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RecordDownloadModal from '../../../file-download-modal/RecordDownloadModal';
import Grid from '../../../grid/Grid';
import AutoFullHeightContainer from '../../../layout/AutoFullHeightContainer';
import Modal from '../../../modal/Modal';
import { Breadcrumbs } from '../../../widgets/Breadcrumbs';
import Icon from '../../../widgets/Icon';
import Spinner from '../../../widgets/Spinner';
import { DataTableV2 } from '../DataTableV2';
import { copySalesforceRecordTableDataToClipboard } from '../grid-clipboard';
import { NON_DATA_COLUMN_KEYS, TABLE_CONTEXT_MENU_ITEMS } from '../grid-constants';
import { GridSubqueryContext } from '../grid-context';
import { getRowId, getSubqueryModalTagline } from '../grid-row-utils';
import { ContextAction, ContextMenuActionData, DataTableCellProps, RowWithKey, SubqueryContext, SubqueryLevel } from '../grid-types';

/**
 * Subquery cell — shows "N Records".
 *
 * At the top level it opens a modal with a nested data table (load-more + export). Salesforce allows subqueries to be
 * nested, so when this renders inside that modal it instead drills the modal down a level, which keeps navigation in a
 * single modal with a breadcrumb trail rather than stacking a modal per level.
 */
export const SubqueryRenderer = ({ column, row }: DataTableCellProps<RowWithKey>): ReactNode => {
  const [isActive, setIsActive] = useState(false);
  // The drill-down stack lives here rather than in the modal so that records appended by "Load More"
  // survive closing and reopening it. Opening returns to the top of the stack, keeping those records.
  const [levels, setLevels] = useState<SubqueryLevel[]>([]);
  const queryResults: QueryResult<any> = row[column.key] || {};
  const { records } = queryResults;
  // "Load More" appends onto the preserved stack rather than the row, so the label reads from the stack once it
  // exists - otherwise it keeps reporting the count the query originally returned after the user has loaded more.
  const recordCount = levels[0]?.queryResults.records.length ?? records?.length;

  if (!Array.isArray(records) || records.length === 0) {
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
          // Drop back to the top of the stack, but keep whatever it has already loaded
          setLevels((prev) => (prev.length ? prev.slice(0, 1) : [level]));
          setIsActive(true);
        }

        return (
          <div>
            {isActive && !props.nestedRender && levels.length > 0 && (
              <SubqueryModal levels={levels} setLevels={setLevels} onClose={() => setIsActive(false)} {...props} />
            )}
            <button className="slds-button" tabIndex={-1} onClick={handleClick}>
              <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
              {`${recordCount} Records`}
            </button>
          </div>
        );
      }}
    </GridSubqueryContext.Consumer>
  );
};

interface SubqueryModalProps extends SubqueryContext {
  levels: SubqueryLevel[];
  setLevels: Dispatch<SetStateAction<SubqueryLevel[]>>;
  onClose: () => void;
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
  onClose,
}: SubqueryModalProps) {
  const isMounted = useRef(true);
  const [downloadModalIsActive, setDownloadModalIsActive] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Guards against re-entry while a queryMore is in flight (the loading state hasn't re-rendered yet).
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const currentLevel = levels[levels.length - 1];
  const { records, done, totalSize, nextRecordsUrl } = currentLevel.queryResults;
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

  async function loadMore() {
    // Guard before the try so the finally only runs for calls that actually start a load.
    if (!nextRecordsUrl || isLoadingMoreRef.current) {
      return;
    }
    // Pin the level the request belongs to. The table and breadcrumbs stay interactive while loading, so by the
    // time the response lands the user may have drilled down or navigated back and a different level is on top.
    const targetLevel = currentLevel;
    const targetIndex = levels.length - 1;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const results = await queryMore(org, nextRecordsUrl, isTooling);
      if (isMounted.current) {
        // Functional update so the append merges onto that level's latest records. Levels are only ever
        // appended or truncated, never swapped in place, so an identity mismatch means the level is gone.
        setLevels((prev) => {
          if (prev[targetIndex] !== targetLevel) {
            return prev;
          }
          return prev.map((level, index) =>
            index === targetIndex
              ? {
                  ...level,
                  queryResults: {
                    ...results.queryResults,
                    records: [...level.queryResults.records, ...results.queryResults.records],
                  },
                }
              : level,
          );
        });
      }
    } catch {
      // Query errors surface via the shared data layer; just stop the spinner here.
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
                {!done && (
                  <button className="slds-button slds-button_neutral" disabled={isLoadingMore} onClick={() => loadMore()}>
                    Load More
                  </button>
                )}
                {isLoadingMore && <Spinner />}
              </Grid>
              <div>
                <button
                  className="slds-button slds-button_neutral"
                  onClick={() => copyRecordsToClipboard(records, 'excel', fields)}
                  title="Copy the queried records to the clipboard."
                >
                  <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Copy to Clipboard
                </button>
                <button className="slds-button slds-button_brand" onClick={() => setDownloadModalIsActive(true)}>
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Download Records
                </button>
              </div>
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
                  rowHeight={28.5}
                  enableRowSelection
                  contextMenuItems={TABLE_CONTEXT_MENU_ITEMS}
                  contextMenuAction={handleContextMenuAction}
                  onReorderColumns={handleColumnReorder}
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
          onModalClose={handleCloseModal}
          source="data_table_subquery"
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          trackEvent={() => {}}
        />
      )}
    </>
  );
}

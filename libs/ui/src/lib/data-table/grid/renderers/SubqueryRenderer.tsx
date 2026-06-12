/* eslint-disable @typescript-eslint/no-explicit-any */
import { queryMore } from '@jetstream/shared/data';
import { appActionObservable, copyRecordsToClipboard, formatNumber } from '@jetstream/shared/ui-utils';
import { flattenRecord } from '@jetstream/shared/utils';
import { CloneEditView, ContextMenuItem, Maybe, QueryResult, SalesforceOrgUi } from '@jetstream/types';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RecordDownloadModal from '../../../file-download-modal/RecordDownloadModal';
import Grid from '../../../grid/Grid';
import AutoFullHeightContainer from '../../../layout/AutoFullHeightContainer';
import Modal from '../../../modal/Modal';
import Icon from '../../../widgets/Icon';
import Spinner from '../../../widgets/Spinner';
import { DataTableV2 } from '../DataTableV2';
import { copySalesforceRecordTableDataToClipboard } from '../grid-clipboard';
import { NON_DATA_COLUMN_KEYS, TABLE_CONTEXT_MENU_ITEMS } from '../grid-constants';
import { GridSubqueryContext } from '../grid-context';
import { getRowId, getSubqueryModalTagline } from '../grid-row-utils';
import { ColumnWithFilter, ContextAction, ContextMenuActionData, DataTableCellProps, RowWithKey, SubqueryContext } from '../grid-types';

/** Subquery cell — shows "N Records" and opens a modal with a nested data table (load-more + export). */
export const SubqueryRenderer = ({ column, row }: DataTableCellProps<RowWithKey>): ReactNode => {
  const isMounted = useRef(true);
  const [isActive, setIsActive] = useState(false);
  const [modalTagline, setModalTagline] = useState<Maybe<string>>(null);
  const [downloadModalIsActive, setDownloadModalIsActive] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [queryResults, setQueryResults] = useState<QueryResult<any>>(row[column.key] || {});

  const { records, nextRecordsUrl } = queryResults;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleRowAction = useCallback(() => undefined, []);

  function handleViewData() {
    if (isActive) {
      setIsActive(false);
    } else {
      if (!modalTagline && row) {
        setModalTagline(getSubqueryModalTagline(row));
      }
      setIsActive(true);
    }
  }

  function handleCloseModal(canceled?: boolean) {
    if (typeof canceled === 'boolean' && canceled) {
      setIsActive(true);
      setDownloadModalIsActive(false);
    } else {
      setIsActive(false);
      setDownloadModalIsActive(false);
    }
  }

  function openDownloadModal() {
    setIsActive(false);
    setDownloadModalIsActive(true);
  }

  function handleCopyToClipboard(fields: string[]) {
    copyRecordsToClipboard(records, 'excel', fields);
  }

  async function loadMore(org: SalesforceOrgUi, isTooling: boolean) {
    try {
      if (!nextRecordsUrl) {
        return;
      }
      setIsLoadingMore(true);
      const results = await queryMore(org, nextRecordsUrl, isTooling);
      if (!isMounted.current) {
        return;
      }
      setQueryResults({ ...results.queryResults, records: [...records, ...results.queryResults.records] });
      setIsLoadingMore(false);
    } catch {
      if (isMounted.current) {
        setIsLoadingMore(false);
      }
    }
  }

  if (!Array.isArray(records) || records.length === 0) {
    return <div />;
  }

  return (
    <GridSubqueryContext.Consumer>
      {(props) => {
        if (!props) {
          return null;
        }
        const columns = props.columnDefinitions?.[column.key.toLowerCase()];
        if (!columns) {
          return null;
        }
        return (
          <div>
            {(downloadModalIsActive || isActive) && (
              <ModalDataTable
                isActive={isActive}
                columnKey={column.key}
                columns={columns}
                modalTagline={modalTagline}
                queryResults={queryResults}
                isLoadingMore={isLoadingMore}
                downloadModalIsActive={downloadModalIsActive}
                loadMore={loadMore}
                openDownloadModal={openDownloadModal}
                handleCloseModal={handleCloseModal}
                handleCopyToClipboard={handleCopyToClipboard}
                handleRowAction={handleRowAction}
                {...props}
              />
            )}
            <button className="slds-button" onClick={handleViewData}>
              <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
              {`${records.length} Records`}
            </button>
          </div>
        );
      }}
    </GridSubqueryContext.Consumer>
  );
};

interface ModalDataTableProps extends SubqueryContext {
  isActive: boolean;
  columnKey: string;
  columns: ColumnWithFilter<any, unknown>[];
  modalTagline?: Maybe<string>;
  queryResults: QueryResult<any>;
  isLoadingMore: boolean;
  downloadModalIsActive: boolean;
  loadMore: (org: SalesforceOrgUi, isTooling: boolean) => void;
  openDownloadModal: () => void;
  handleCloseModal: (canceled?: boolean) => void;
  handleCopyToClipboard: (fields: string[]) => void;
  handleRowAction: (row: any, action: 'view' | 'edit' | 'clone' | 'apex') => void;
}

function ModalDataTable({
  isActive,
  columnKey,
  columns,
  modalTagline,
  queryResults,
  isLoadingMore,
  isTooling,
  org,
  downloadModalIsActive,
  serverUrl,
  skipFrontdoorLogin,
  hasGoogleDriveAccess,
  googleShowUpgradeToPro,
  google_apiKey,
  google_appId,
  google_clientId,
  onSubqueryFieldReorder,
  loadMore,
  openDownloadModal,
  handleCloseModal,
  handleCopyToClipboard,
  handleRowAction,
}: ModalDataTableProps) {
  const { records, done, totalSize } = queryResults;

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

  const handleContextMenuAction = useCallback(
    (item: ContextMenuItem<ContextAction>, data: ContextMenuActionData<RowWithKey>) => {
      copySalesforceRecordTableDataToClipboard(item.value as ContextAction, fields, data);
    },
    [fields],
  );

  const handleColumnReorder = useCallback(
    (reordered: string[], columnOrder: number[]) => {
      setFields(reordered);
      onSubqueryFieldReorder?.(columnKey, reordered, columnOrder);
    },
    [columnKey, onSubqueryFieldReorder],
  );

  return (
    <>
      {isActive && (
        <Modal
          size="lg"
          header={columnKey}
          tagline={modalTagline}
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
                  <button className="slds-button slds-button_neutral" onClick={() => loadMore(org, isTooling)}>
                    Load More
                  </button>
                )}
                {isLoadingMore && <Spinner />}
              </Grid>
              <div>
                <button
                  className="slds-button slds-button_neutral"
                  onClick={() => handleCopyToClipboard(fields)}
                  title="Copy the queried records to the clipboard."
                >
                  <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Copy to Clipboard
                </button>
                <button className="slds-button slds-button_brand" onClick={openDownloadModal}>
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Download Records
                </button>
              </div>
            </Grid>
          }
        >
          <div className="slds-scrollable_x" onContextMenu={(ev) => (ev.preventDefault(), ev.stopPropagation())}>
            <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
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

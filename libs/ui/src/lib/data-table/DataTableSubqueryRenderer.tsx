import { queryMore } from '@jetstream/shared/data';
import { copyRecordsToClipboard, formatNumber } from '@jetstream/shared/ui-utils';
import { flattenRecord } from '@jetstream/shared/utils';
import { Maybe, QueryResult, SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RenderCellProps } from 'react-data-grid';
import RecordDownloadModal from '../file-download-modal/RecordDownloadModal';
import Grid from '../grid/Grid';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import Modal from '../modal/Modal';
import { ContextMenuItem } from '../popover/ContextMenu';
import Icon from '../widgets/Icon';
import Spinner from '../widgets/Spinner';
import { DataTable } from './DataTable';
import { DataTableSubqueryContext } from './data-table-context';
import { ColumnWithFilter, ContextAction, ContextMenuActionData, RowWithKey, SubqueryContext } from './data-table-types';
import {
  NON_DATA_COLUMN_KEYS,
  TABLE_CONTEXT_MENU_ITEMS,
  copySalesforceRecordTableDataToClipboard,
  getRowId,
  getSubqueryModalTagline,
} from './data-table-utils';

export const SubqueryRenderer: FunctionComponent<RenderCellProps<RowWithKey, unknown>> = ({ column, row, onRowChange }) => {
  const isMounted = useRef(true);
  const [isActive, setIsActive] = useState(false);
  const [modalTagline, setModalTagline] = useState<Maybe<string>>(null);
  const [downloadModalIsActive, setDownloadModalIsActive] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [queryResults, setQueryResults] = useState<QueryResult<any>>(row[column.key] || {});
  // const [rows, setRows] = useState<RowWithKey[]>([]);
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(() => new Set());

  const { records, nextRecordsUrl } = queryResults;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Not yet supported
  const handleRowAction = useCallback((row: any, action: 'view' | 'edit' | 'clone' | 'apex') => {
    // logger.info('row action', row, action);
    // switch (action) {
    //   case 'edit':
    //     onEdit(row);
    //     break;
    //   case 'clone':
    //     onClone(row);
    //     break;
    //   case 'view':
    //     onView(row);
    //     break;
    //   case 'apex':
    //     onGetAsApex(row);
    //     break;
    //   default:
    //     break;
    // }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleCloseModal(cancelled?: boolean) {
    if (typeof cancelled === 'boolean' && cancelled) {
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
      results.queryResults.records = records.concat(results.queryResults.records);
      setQueryResults(results.queryResults);
      setIsLoadingMore(false);
    } catch (ex) {
      if (!isMounted.current) {
        return;
      }
      setIsLoadingMore(false);
    }
  }

  if (!Array.isArray(records) || records.length === 0) {
    return <div />;
  }

  return (
    <DataTableSubqueryContext.Consumer>
      {(props) => {
        if (!props) {
          return null;
        }
        const {
          serverUrl,
          skipFrontdoorLogin,
          org,
          columnDefinitions,
          onSubqueryFieldReorder,
          isTooling,
          google_apiKey,
          google_appId,
          google_clientId,
        } = props;

        if (!columnDefinitions || !columnDefinitions[column.key]) {
          return null;
        }

        return (
          <div>
            {(downloadModalIsActive || isActive) && (
              <ModalDataTable
                isActive={isActive}
                columnKey={column.key}
                columns={columnDefinitions[column.key]!}
                modalTagline={modalTagline}
                queryResults={queryResults}
                selectedRows={selectedRows}
                isLoadingMore={isLoadingMore}
                columnDefinitions={columnDefinitions}
                isTooling={isTooling}
                org={org}
                downloadModalIsActive={downloadModalIsActive}
                serverUrl={serverUrl}
                skipFrontdoorLogin={skipFrontdoorLogin}
                google_apiKey={google_apiKey}
                google_appId={google_appId}
                google_clientId={google_clientId}
                onSubqueryFieldReorder={onSubqueryFieldReorder}
                loadMore={loadMore}
                openDownloadModal={openDownloadModal}
                handleCloseModal={handleCloseModal}
                handleCopyToClipboard={handleCopyToClipboard}
                handleRowAction={handleRowAction}
                setSelectedRows={setSelectedRows}
              />
            )}
            <button className="slds-button" onClick={handleViewData}>
              <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
              {Array.isArray(records) ? `${records.length} Records` : 'View Data'}
            </button>
          </div>
        );
      }}
    </DataTableSubqueryContext.Consumer>
  );
};

interface ModalDataTableProps extends SubqueryContext {
  isActive: boolean;
  columnKey: string;
  columns: ColumnWithFilter<any, unknown>[];
  modalTagline?: Maybe<string>;
  queryResults: QueryResult<any>;
  isLoadingMore: boolean;
  selectedRows: ReadonlySet<string>;
  downloadModalIsActive: boolean;
  onSubqueryFieldReorder?: (columnKey: string, fields: string[], columnOrder: number[]) => void;
  loadMore: (org: SalesforceOrgUi, isTooling: boolean) => void;
  openDownloadModal: () => void;
  handleCloseModal: (cancelled?: boolean) => void;
  handleCopyToClipboard: (fields: string[]) => void;
  handleRowAction: (row: any, action: 'view' | 'edit' | 'clone' | 'apex') => void;
  setSelectedRows: (rows: ReadonlySet<string>) => void;
}

function ModalDataTable({
  isActive,
  columnKey,
  columns,
  modalTagline,
  queryResults,
  selectedRows,
  isLoadingMore,
  columnDefinitions,
  isTooling,
  org,
  downloadModalIsActive,
  serverUrl,
  skipFrontdoorLogin,
  google_apiKey,
  google_appId,
  google_clientId,
  onSubqueryFieldReorder,
  loadMore,
  openDownloadModal,
  handleCloseModal,
  handleCopyToClipboard,
  handleRowAction,
  setSelectedRows,
}: ModalDataTableProps) {
  const modalRef = useRef();

  const { records, done, totalSize } = queryResults;

  const { fields: _fields, rows } = useMemo(() => {
    const columnKeys = columns?.map((col) => col.key) || null;
    const fields = columns.filter((column) => column.key && !NON_DATA_COLUMN_KEYS.has(column.key)).map((column) => column.key);
    const rows = records.map((row) => {
      return {
        _key: getRowId(row),
        _action: handleRowAction,
        _record: row,
        ...(columnKeys ? flattenRecord(row, columnKeys, false) : row),
      };
    });
    return {
      fields,
      rows,
    };
  }, [columns, handleRowAction, records]);

  const [fields, setFields] = useState(_fields);

  useEffect(() => {
    setFields(_fields);
  }, [_fields]);

  const handleContextMenuAction = useCallback(
    (item: ContextMenuItem<ContextAction>, data: ContextMenuActionData<RowWithKey>) => {
      copySalesforceRecordTableDataToClipboard(item.value, fields, data);
    },
    [fields]
  );

  const handleColumnReorder = useCallback((columns: string[], columnOrder: number[]) => {
    setFields(columns);
    onSubqueryFieldReorder && onSubqueryFieldReorder(columnKey, columns, columnOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {isActive && (
        <Modal
          ref={modalRef}
          size="lg"
          header={columnKey}
          tagline={modalTagline}
          closeOnBackdropClick
          onClose={handleCloseModal}
          footerClassName="slds-is-relative"
          overrideZIndex={1001}
          additionalOverlayProps={{ shouldCloseOnInteractOutside: () => false }}
          footer={
            <Grid
              align="spread"
              verticalAlign="end"
              divProps={{
                onContextMenu: (ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                },
              }}
            >
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
                  title="Copy the queried records to the clipboard. The records can then be pasted into a spreadsheet."
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
          <div
            className="slds-scrollable_x"
            onContextMenu={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
            }}
          >
            <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
              <DataTable
                serverUrl={serverUrl}
                skipFrontdoorLogin={skipFrontdoorLogin}
                org={org}
                data={rows}
                columns={columns}
                getRowKey={getRowId}
                rowHeight={28.5}
                selectedRows={selectedRows}
                onSelectedRowsChange={setSelectedRows as any}
                context={{ portalRefForFilters: modalRef }}
                contextMenuItems={TABLE_CONTEXT_MENU_ITEMS}
                contextMenuAction={handleContextMenuAction}
                onReorderColumns={handleColumnReorder}
              />
            </AutoFullHeightContainer>
          </div>
        </Modal>
      )}
      {downloadModalIsActive && (
        <RecordDownloadModal
          org={org}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          downloadModalOpen
          fields={fields}
          records={records}
          onModalClose={handleCloseModal}
        />
      )}
    </>
  );
}

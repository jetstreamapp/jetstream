/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { ContextMenuItem, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  ContextAction,
  ContextMenuActionData,
  CopyRecordsToClipboardButton,
  CopyToClipboardWithToolTip,
  DataTable,
  getRowTypeFromValue,
  Grid,
  Icon,
  Modal,
  RowWithKey,
  setColumnFromType,
  Spinner,
  TABLE_CONTEXT_MENU_ITEMS,
  copyGenericTableDataToClipboard,
} from '@jetstream/ui';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useCallback, useMemo, useState } from 'react';
import type { Key } from 'react';
import { SelectColumn } from 'react-data-grid';

const COL_WIDTH_MAP = {
  _id: 195,
  _success: 110,
  _errors: 450,
};

const getRowHeight = (row: any) => (row?._errors ? 75 : 25);

const getDefaultSelectedRows = (rows: any[], selectable: boolean): ReadonlySet<Key> =>
  selectable ? new Set(rows.map((_row, i) => `id-${i}`)) : new Set();

export interface LoadRecordsResultsModalProps {
  org: SalesforceOrgUi;
  type: 'results' | 'failures';
  loading?: boolean;
  header: string[];
  rows: any[];
  /** When true, shows checkboxes for row selection and a "Retry Selected" button */
  selectable?: boolean;
  onRetrySelected?: (selectedRows: any[]) => void;
  onDownload: (type: 'results' | 'failures', rows: any[], header: string[]) => void;
  onClose: () => void;
}

export const LoadRecordsResultsModal: FunctionComponent<LoadRecordsResultsModalProps> = ({
  type,
  loading = false,
  header,
  rows,
  org,
  selectable = false,
  onRetrySelected,
  onDownload,
  onClose,
}) => {
  const { serverUrl, defaultApiVersion } = useAtomValue(applicationCookieState);
  const skipFrontdoorLogin = useAtomValue(selectSkipFrontdoorAuth);
  // Store each row as key and the index as a value to use as a unique id for the row
  const rowsMap = useMemo(() => new WeakMap(rows.map((row, i) => [row, `id-${i}`])), [rows]);
  const firstRow = rows?.[0];
  const columns = useMemo<ColumnWithFilter<any>[] | null>(() => {
    if (!header) {
      return null;
    }

    const baseColumns: ColumnWithFilter<any>[] = header.map((item) => {
      const baseColumn = setColumnFromType(item, item === '_id' ? 'salesforceId' : getRowTypeFromValue(firstRow?.[item], false));
      return {
        ...baseColumn,
        name: item,
        key: item,
        field: item,
        resizable: true,
        width: COL_WIDTH_MAP[item],
        formatter:
          item === '_errors'
            ? ({ row }) => (
                <p
                  css={css`
                    white-space: pre-wrap;
                    line-height: normal;
                  `}
                >
                  {row._errors && (
                    <CopyToClipboardWithToolTip
                      content={row._errors}
                      icon={{ type: 'utility', icon: 'error', description: 'Click to copy to clipboard' }}
                      className="slds-text-color_error slds-p-right_x-small"
                    />
                  )}
                  {row?._errors}
                </p>
              )
            : baseColumn.renderCell,
      };
    });

    if (selectable) {
      baseColumns.unshift({ ...SelectColumn, resizable: false } as ColumnWithFilter<any>);
    }

    return baseColumns;
  }, [firstRow, header, selectable]);
  const defaultSelectedRows = useMemo(() => getDefaultSelectedRows(rows, selectable), [rows, selectable]);
  const [selectedRowsState, setSelectedRowsState] = useState<{
    rows: any[];
    selectable: boolean;
    keys: ReadonlySet<Key>;
  }>(() => ({
    rows,
    selectable,
    keys: getDefaultSelectedRows(rows, selectable),
  }));
  const selectedRows =
    selectedRowsState.rows === rows && selectedRowsState.selectable === selectable ? selectedRowsState.keys : defaultSelectedRows;
  const selectedCount = selectable ? selectedRows.size : 0;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const getRowKey = useCallback((row: any) => rowsMap.get(row)!, [rowsMap]);

  const handleContextMenuAction = useCallback(
    (item: ContextMenuItem<ContextAction>, data: ContextMenuActionData<RowWithKey>) => {
      copyGenericTableDataToClipboard(item.value, header, data);
    },
    [header],
  );

  function handleDownload() {
    // TODO: allow user to choose filtered records to download
    onDownload(type, rows, header);
  }

  const selectedRowData = useMemo(() => {
    if (!selectable) {
      return [];
    }
    return rows.filter((row) => selectedRows.has(getRowKey(row)));
  }, [selectable, rows, selectedRows, getRowKey]);

  function handleRetrySelected() {
    if (onRetrySelected && selectedRowData.length > 0) {
      onRetrySelected(selectedRowData);
    }
  }

  return (
    <div>
      <Modal
        testId="load-records-results-modal"
        size="lg"
        header="Load Results"
        closeOnBackdropClick
        footer={
          <Grid verticalAlign="center" align="spread">
            <div>
              {Array.isArray(rows) && (
                <>
                  {formatNumber(rows.length)} {pluralizeFromNumber('Record', rows.length)}
                  {selectable && <> ({formatNumber(selectedCount)} selected)</>}
                </>
              )}
            </div>
            <Grid verticalAlign="center" align="end">
              {selectable && onRetrySelected && (
                <button
                  className="slds-button slds-button_neutral slds-m-left_x-small"
                  onClick={handleRetrySelected}
                  disabled={loading || selectedCount === 0}
                >
                  <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Retry Selected ({formatNumber(selectedCount)})
                </button>
              )}
              <CopyRecordsToClipboardButton containerClassName="slds-m-right_xx-small" fields={header} records={rows} />
              <button className="slds-button slds-button_neutral slds-m-left_x-small" onClick={onClose}>
                Close
              </button>
              <button className="slds-button slds-button_brand" onClick={handleDownload} disabled={loading}>
                <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                Download
              </button>
            </Grid>
          </Grid>
        }
        onClose={onClose}
      >
        <div className="slds-is-relative slds-scrollable_x">
          <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
            {loading && <Spinner />}
            {Array.isArray(rows) && Array.isArray(columns) && (
              <DataTable
                org={org}
                serverUrl={serverUrl}
                skipFrontdoorLogin={skipFrontdoorLogin}
                columns={columns}
                data={rows}
                getRowKey={getRowKey}
                rowHeight={getRowHeight}
                context={{ defaultApiVersion }}
                contextMenuItems={TABLE_CONTEXT_MENU_ITEMS}
                contextMenuAction={handleContextMenuAction}
                selectedRows={selectable ? selectedRows : undefined}
                onSelectedRowsChange={selectable ? (keys) => setSelectedRowsState({ rows, selectable, keys }) : undefined}
              />
            )}
          </AutoFullHeightContainer>
        </div>
      </Modal>
    </div>
  );
};

export default LoadRecordsResultsModal;

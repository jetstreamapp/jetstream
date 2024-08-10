import { css } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  CopyToClipboardWithToolTip,
  DataTable,
  getRowTypeFromValue,
  Icon,
  Modal,
  setColumnFromType,
  Spinner,
} from '@jetstream/ui';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { applicationCookieState, selectSkipFrontdoorAuth } from '../state-management/app-state';

const COL_WIDTH_MAP = {
  _id: 195,
  _success: 110,
  _errors: 450,
};

const getRowHeight = (row: any) => (row?._errors ? 75 : 25);

export interface LoadRecordsResultsModalProps {
  org: SalesforceOrgUi;
  type: 'results' | 'failures';
  loading?: boolean;
  header: string[];
  rows: any[];
  onDownload: (type: 'results' | 'failures', rows: any[], header: string[]) => void;
  onClose: () => void;
}

export const LoadRecordsResultsModal: FunctionComponent<LoadRecordsResultsModalProps> = ({
  type,
  loading = false,
  header,
  rows,
  org,
  onDownload,
  onClose,
}) => {
  const { serverUrl, defaultApiVersion } = useRecoilValue(applicationCookieState);
  const skipFrontdoorLogin = useRecoilValue(selectSkipFrontdoorAuth);
  const modalRef = useRef();
  const [columns, setColumns] = useState<ColumnWithFilter<any>[] | null>(null);
  // Store each row as key and the index as a value to use as a unique id for the row
  const [rowsMap, setRowsMap] = useState<WeakMap<any, string>>(() => new WeakMap(rows.map((row, i) => [row, `id-${i}`])));

  useEffect(() => {
    if (header) {
      setColumns(
        header.map((item) => {
          const baseColumn = setColumnFromType(item, item === '_id' ? 'salesforceId' : getRowTypeFromValue(rows?.[0]?.[item], false));
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
        })
      );
    }
  }, [header]);

  useNonInitialEffect(() => {
    setRowsMap(new WeakMap(rows.map((row, i) => [row, `id-${i}`])));
  }, [rows]);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const getRowKey = useCallback((row: any) => rowsMap.get(row)!, [rowsMap]);

  function handleDownload() {
    // TODO: allow user to choose filtered records to download
    onDownload(type, rows, header);
  }

  return (
    <div>
      <Modal
        ref={modalRef}
        size="lg"
        header="Load Results"
        closeOnBackdropClick
        footer={
          <div>
            <button className="slds-button slds-button_neutral" onClick={onClose}>
              Close
            </button>
            <button className="slds-button slds-button_brand" onClick={handleDownload} disabled={loading}>
              <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
              Download
            </button>
          </div>
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
                context={{ defaultApiVersion, portalRefForFilters: modalRef }}
              />
            )}
          </AutoFullHeightContainer>
        </div>
      </Modal>
    </div>
  );
};

export default LoadRecordsResultsModal;

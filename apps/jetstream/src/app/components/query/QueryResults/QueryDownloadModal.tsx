/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { saveFile } from '@jetstream/shared/ui-utils';
import { flattenRecords } from '@jetstream/shared/utils';
import { Record, QueryFieldHeader } from '@jetstream/types';
import { Modal, Radio, RadioGroup } from '@jetstream/ui';
import { unparse } from 'papaparse';
import { Fragment, FunctionComponent, useState } from 'react';
import numeral from 'numeral';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryDownloadModalProps {
  downloadModalOpen: boolean;
  fields: QueryFieldHeader[];
  records: Record[];
  selectedRecords: Record[];
  totalRecordCount?: number;
  onModalClose: () => void;
  onDownloadFromServer: () => void;
}

export const RADIO_ALL_BROWSER = 'all-browser';
export const RADIO_ALL_SERVER = 'all-server';
export const RADIO_SELECTED = 'selected';

export const QueryDownloadModal: FunctionComponent<QueryDownloadModalProps> = ({
  downloadModalOpen,
  fields,
  records,
  selectedRecords,
  totalRecordCount,
  onModalClose,
  onDownloadFromServer,
  children,
}) => {
  const [radioValue, setRadioValue] = useState<string>(RADIO_ALL_BROWSER);

  function downloadRecords() {
    // open modal
    try {
      if (radioValue === RADIO_ALL_SERVER) {
        // emit event, which starts job, which downloads in the background
        onDownloadFromServer();
        onModalClose();
      } else {
        const stringFields = fields.map((field) => field.accessor);
        const activeRecords = radioValue === RADIO_ALL_BROWSER ? records : selectedRecords;
        const csv = unparse(
          {
            data: flattenRecords(activeRecords, stringFields),
            fields: stringFields,
          },
          { header: true, quotes: true }
        );
        saveFile(csv, 'query-results.csv', MIME_TYPES.CSV);
        onModalClose();
      }
    } catch (ex) {
      // TODO: show error message somewhere
    }
  }

  return (
    <Fragment>
      {downloadModalOpen && (
        <Modal
          header="Download Records"
          footer={
            <button className="slds-button slds-button_brand" onClick={downloadRecords}>
              Download
            </button>
          }
          onClose={() => onModalClose()}
        >
          <div>
            <RadioGroup label="Which Records" required>
              {totalRecordCount && totalRecordCount > records.length && (
                <Fragment>
                  <Radio
                    name="radio-download"
                    label={`All records (${numeral(totalRecordCount).format('0,0')})`}
                    value={RADIO_ALL_SERVER}
                    checked={radioValue === RADIO_ALL_SERVER}
                    onChange={setRadioValue}
                  />
                  <Radio
                    name="radio-download"
                    label={`First set of records (${numeral(records.length).format('0,0')})`}
                    value={RADIO_ALL_BROWSER}
                    checked={radioValue === RADIO_ALL_BROWSER}
                    onChange={setRadioValue}
                  />
                </Fragment>
              )}
              {(!totalRecordCount || totalRecordCount <= records.length) && (
                <Radio
                  name="radio-download"
                  label={`All records (${numeral(totalRecordCount).format('0,0')})`}
                  value={RADIO_ALL_BROWSER}
                  checked={radioValue === RADIO_ALL_BROWSER}
                  onChange={setRadioValue}
                />
              )}
              <Radio
                name="radio-download"
                label={`Selected records (${selectedRecords?.length || 0})`}
                value={RADIO_SELECTED}
                disabled={!selectedRecords?.length}
                checked={radioValue === RADIO_SELECTED}
                onChange={setRadioValue}
              />
            </RadioGroup>
          </div>
        </Modal>
      )}
      {children}
    </Fragment>
  );
};

export default QueryDownloadModal;

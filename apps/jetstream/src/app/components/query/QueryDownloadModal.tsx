/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { MIME_TYPES } from '@silverthorn/shared/constants';
import { saveFile } from '@silverthorn/shared/ui-utils';
import { flattenRecords } from '@silverthorn/shared/utils';
import { Modal, RadioGroup, Radio } from '@silverthorn/ui';
import { unparse } from 'papaparse';
import { Fragment, FunctionComponent, useState } from 'react';
import { Record } from '@silverthorn/types';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryDownloadModalProps {
  downloadModalOpen: boolean;
  fields: string[];
  records: Record[];
  selectedRecords: Record[];
  onModalClose: () => void;
}

export const RADIO_ALL_BROWSER = 'all-browser';
export const RADIO_SELECTED = 'selected';

export const QueryDownloadModal: FunctionComponent<QueryDownloadModalProps> = ({
  downloadModalOpen,
  fields,
  records,
  selectedRecords,
  onModalClose,
  children,
}) => {
  const [radioValue, setRadioValue] = useState<string>(RADIO_ALL_BROWSER);

  function downloadRecords() {
    // open modal
    try {
      const activeRecords = radioValue === RADIO_ALL_BROWSER ? records : selectedRecords;
      const csv = unparse({ data: flattenRecords(activeRecords, fields), fields }, { header: true, quotes: true });
      saveFile(csv, 'query-results.csv', MIME_TYPES.CSV);
      onModalClose();
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
            {selectedRecords?.length > 0 && true}
            <RadioGroup label="Which Records" required>
              <Radio
                name="radio-download"
                label={`All records (${records.length})`}
                value={RADIO_ALL_BROWSER}
                disabled={false}
                checked={radioValue === RADIO_ALL_BROWSER}
                onChange={setRadioValue}
              />
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

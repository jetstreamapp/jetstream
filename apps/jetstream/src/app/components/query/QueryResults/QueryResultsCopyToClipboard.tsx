/** @jsx jsx */
import { jsx } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { transformTabularDataToExcelStr } from '@jetstream/shared/ui-utils';
import { flattenRecords } from '@jetstream/shared/utils';
import { Record } from '@jetstream/types';
import { Icon, Modal, Radio, RadioGroup } from '@jetstream/ui';
import copyToClipboard from 'copy-to-clipboard';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useAmplitude } from '../../core/analytics';

type WhichRecords = 'all' | 'filtered' | 'selected';

export interface QueryResultsCopyToClipboardProps {
  hasRecords: boolean;
  fields: string[];
  records: Record[];
  filteredRows: Record[];
  selectedRows: Record[];
  isTooling: boolean;
}

export const QueryResultsCopyToClipboard: FunctionComponent<QueryResultsCopyToClipboardProps> = ({
  hasRecords,
  fields,
  records,
  filteredRows,
  selectedRows,
  isTooling,
}) => {
  const { trackEvent } = useAmplitude();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [whichRecords, setWhichRecords] = useState<WhichRecords>('all');
  const [hasFilteredRows, setHasFilteredRows] = useState<boolean>(false);
  const [hasPartialSelectedRows, setHasPartialSelectedRows] = useState<boolean>(false);

  useEffect(() => {
    if (filteredRows && records) {
      setHasFilteredRows(filteredRows.length > 0 && filteredRows.length < records.length);
    }
  }, [filteredRows, records]);

  useEffect(() => {
    if (selectedRows && records) {
      setHasPartialSelectedRows(selectedRows.length > 0 && selectedRows.length < records.length);
    }
  }, [selectedRows, records]);

  useEffect(() => {
    setWhichRecords('all');
  }, [records, filteredRows, selectedRows]);

  async function handleCopyToClipboard() {
    if ((hasFilteredRows && filteredRows.length < records.length) || (hasPartialSelectedRows && selectedRows.length < records.length)) {
      setIsModalOpen(true);
      return;
    }

    // copy all records because no filter/selection applied
    const flattenedData = flattenRecords(records, fields);
    copyToClipboard(transformTabularDataToExcelStr(flattenedData, fields), { format: 'text/plain' });
    trackEvent(ANALYTICS_KEYS.query_CopyToClipboard, { isTooling, whichRecords });
  }

  function handleModalConfirmation(doCopy) {
    setIsModalOpen(false);

    if (!doCopy) {
      return;
    }

    let recordsToCopy = records;

    if (whichRecords === 'filtered') {
      recordsToCopy = filteredRows;
    } else if (whichRecords === 'selected') {
      recordsToCopy = selectedRows;
    }

    const flattenedData = flattenRecords(recordsToCopy, fields);
    copyToClipboard(transformTabularDataToExcelStr(flattenedData, fields), { format: 'text/plain' });
    trackEvent(ANALYTICS_KEYS.query_CopyToClipboard, { isTooling, whichRecords });

    setWhichRecords('all');
  }

  return (
    <Fragment>
      <button
        className="slds-button slds-button_neutral"
        onClick={() => handleCopyToClipboard()}
        disabled={!hasRecords}
        title="Copy the queried records to the clipboard. The records can then be pasted into a spreadsheet."
      >
        <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
        Copy to Clipboard
      </button>
      {isModalOpen && (
        <Modal
          header="Which records would you like to copy?"
          footer={
            <Fragment>
              <button className="slds-button slds-button_neutral" onClick={() => handleModalConfirmation(false)}>
                Cancel
              </button>
              <button className="slds-button slds-button_brand" onClick={() => handleModalConfirmation(true)}>
                Copy
              </button>
            </Fragment>
          }
          closeOnBackdropClick
          closeOnEsc
          onClose={() => handleModalConfirmation(false)}
        >
          <div>
            <RadioGroup>
              <Radio
                idPrefix="all"
                id="radio-all"
                name="which-records"
                label={`All Records (${records.length})`}
                value="all"
                checked={whichRecords === 'all'}
                onChange={(value) => setWhichRecords('all')}
              />
              {hasFilteredRows && (
                <Radio
                  idPrefix="filtered"
                  id="radio-filtered"
                  name="which-records"
                  label={`Filtered Records (${filteredRows.length})`}
                  value="filtered"
                  checked={whichRecords === 'filtered'}
                  onChange={(value) => setWhichRecords('filtered')}
                />
              )}
              {hasPartialSelectedRows && (
                <Radio
                  idPrefix="selected"
                  id="radio-selected"
                  name="which-records"
                  label={`Selected Records (${selectedRows.length})`}
                  value="selected"
                  checked={whichRecords === 'selected'}
                  onChange={(value) => setWhichRecords('selected')}
                />
              )}
            </RadioGroup>
          </div>
        </Modal>
      )}
    </Fragment>
  );
};

export default QueryResultsCopyToClipboard;

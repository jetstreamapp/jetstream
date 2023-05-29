import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { copyRecordsToClipboard } from '@jetstream/shared/ui-utils';
import { Maybe, Record } from '@jetstream/types';
import { ButtonGroupContainer, DropDown, Icon, Modal, Radio, RadioGroup } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useAmplitude } from '../../core/analytics';

type WhichRecords = 'all' | 'filtered' | 'selected';

export interface QueryResultsCopyToClipboardProps {
  className?: string;
  hasRecords: boolean;
  fields: Maybe<string[]>;
  records: Maybe<Record[]>;
  filteredRows: Record[];
  selectedRows: Record[];
  isTooling: boolean;
}

export const QueryResultsCopyToClipboard: FunctionComponent<QueryResultsCopyToClipboardProps> = ({
  className,
  hasRecords,
  fields,
  records,
  filteredRows,
  selectedRows,
  isTooling,
}) => {
  const { trackEvent } = useAmplitude();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [format, setFormat] = useState<'excel' | 'text' | 'json'>('excel');
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

  async function handleCopyToClipboard(format: 'excel' | 'text' | 'json' = 'excel') {
    if (
      (records && hasFilteredRows && filteredRows.length < records.length) ||
      (records && hasPartialSelectedRows && selectedRows.length < records.length)
    ) {
      setFormat(format);
      setIsModalOpen(true);
      return;
    }

    copyRecordsToClipboard(records, format);
    trackEvent(ANALYTICS_KEYS.query_CopyToClipboard, { isTooling, whichRecords, format });
  }

  function handleModalConfirmation(doCopy) {
    setIsModalOpen(false);

    if (!doCopy) {
      setFormat('excel');
      setWhichRecords('all');
      return;
    }

    let recordsToCopy = records;

    if (whichRecords === 'filtered') {
      recordsToCopy = filteredRows;
    } else if (whichRecords === 'selected') {
      recordsToCopy = selectedRows;
    }

    copyRecordsToClipboard(recordsToCopy, format);
    trackEvent(ANALYTICS_KEYS.query_CopyToClipboard, { isTooling, whichRecords, format });

    setFormat('excel');
    setWhichRecords('all');
  }

  return (
    <Fragment>
      {/* TODO */}
      <ButtonGroupContainer>
        <button
          className={classNames('slds-button slds-button_neutral', className)}
          onClick={() => handleCopyToClipboard()}
          disabled={!hasRecords}
          title="Copy the queried records to the clipboard. The records can then be pasted into a spreadsheet."
        >
          <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
          <span>Copy to Clipboard</span>
        </button>
        <DropDown
          className="slds-button_last"
          dropDownClassName="slds-dropdown_actions"
          position="right"
          disabled={!hasRecords}
          items={[
            { id: 'text', value: 'Copy as Text' },
            { id: 'json', value: 'Copy as JSON' },
          ]}
          onSelected={(item) => handleCopyToClipboard(item as 'excel' | 'text' | 'json')}
        />
      </ButtonGroupContainer>
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
                label={`All Records (${records?.length || 0})`}
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

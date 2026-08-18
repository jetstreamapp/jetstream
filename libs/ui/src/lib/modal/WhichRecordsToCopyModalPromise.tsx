import { formatNumber } from '@jetstream/shared/ui-utils';
import { Maybe, SalesforceRecord } from '@jetstream/types';
import { Fragment, FunctionComponent, useState } from 'react';
import { create, InstanceProps } from 'react-modal-promise';
import { hasSelectableSubset } from '../file-download-modal/download-modal-utils';
import Radio from '../form/radio/Radio';
import RadioGroup from '../form/radio/RadioGroup';
import Modal from './Modal';

export type WhichRecordsToCopy = 'all' | 'filtered' | 'selected';

export interface WhichRecordsToCopyModalProps extends InstanceProps<Maybe<WhichRecordsToCopy>, never> {
  isOpen: boolean;
  records: SalesforceRecord[];
  filteredRecords?: Maybe<SalesforceRecord[]>;
  selectedRecords?: Maybe<SalesforceRecord[]>;
  onResolve: (whichRecords?: Maybe<WhichRecordsToCopy>) => void;
}

const WhichRecordsToCopyModal: FunctionComponent<WhichRecordsToCopyModalProps> = ({
  isOpen,
  records,
  filteredRecords,
  selectedRecords,
  onResolve,
}) => {
  const [whichRecords, setWhichRecords] = useState<WhichRecordsToCopy>('all');
  const hasFilteredRecords = hasSelectableSubset(filteredRecords, records);
  const hasSelectedRecords = hasSelectableSubset(selectedRecords, records);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      header="Which records would you like to copy?"
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onResolve()}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" onClick={() => onResolve(whichRecords)}>
            Copy
          </button>
        </Fragment>
      }
      closeOnBackdropClick
      closeOnEsc
      onClose={() => onResolve()}
    >
      <div>
        <RadioGroup>
          <Radio
            idPrefix="all"
            id="radio-all"
            name="which-records"
            label={`All Records (${formatNumber(records.length)})`}
            value="all"
            checked={whichRecords === 'all'}
            onChange={() => setWhichRecords('all')}
          />
          {hasFilteredRecords && (
            <Radio
              idPrefix="filtered"
              id="radio-filtered"
              name="which-records"
              label={`Filtered Records (${formatNumber(filteredRecords?.length || 0)})`}
              value="filtered"
              checked={whichRecords === 'filtered'}
              onChange={() => setWhichRecords('filtered')}
            />
          )}
          {hasSelectedRecords && (
            <Radio
              idPrefix="selected"
              id="radio-selected"
              name="which-records"
              label={`Selected Records (${formatNumber(selectedRecords?.length || 0)})`}
              value="selected"
              checked={whichRecords === 'selected'}
              onChange={() => setWhichRecords('selected')}
            />
          )}
        </RadioGroup>
      </div>
    </Modal>
  );
};

/**
 * Asks which subset of records to copy, resolving to the choice or `undefined` if canceled.
 *
 * Rendered through react-modal-promise (i.e. in the app-root modal tree) rather than inline, so that it also
 * works when the copy button lives inside another modal - a nested modal dismisses its parent on any click.
 */
export const WhichRecordsToCopyModalPromise = create<WhichRecordsToCopyModalProps, Maybe<WhichRecordsToCopy>, never>(
  WhichRecordsToCopyModal,
);

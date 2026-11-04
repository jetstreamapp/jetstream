import { copyRecordsToClipboard } from '@jetstream/shared/ui-utils';
import { CopyAsDataType, Maybe, SalesforceRecord } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { hasSelectableSubset } from '../file-download-modal/download-modal-utils';
import ButtonGroupContainer from '../form/button/ButtonGroupContainer';
import DropDown from '../form/dropdown/DropDown';
import { WhichRecordsToCopy, WhichRecordsToCopyModalPromise } from '../modal/WhichRecordsToCopyModalPromise';
import Icon from './Icon';
import Tooltip from './Tooltip';

export interface CopyRecordsToClipboardButtonProps {
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
  fields: Maybe<string[]>;
  records: Maybe<SalesforceRecord[]>;
  /** Records left after the table's filters, when the caller tracks them - offered as a choice when it is a subset of `records` */
  filteredRecords?: Maybe<SalesforceRecord[]>;
  /** Records the user checked in the table - offered as a choice when it is a subset of `records` */
  selectedRecords?: Maybe<SalesforceRecord[]>;
  onCopy?: (options: { format: CopyAsDataType; whichRecords: WhichRecordsToCopy }) => void;
}

export const CopyRecordsToClipboardButton: FunctionComponent<CopyRecordsToClipboardButtonProps> = ({
  className,
  containerClassName,
  disabled,
  fields,
  records,
  filteredRecords,
  selectedRecords,
  onCopy,
}) => {
  const isDisabled = disabled || !records?.length;
  // Copying everything is only ambiguous once the user has narrowed the table down to a subset
  const hasSubsetToChooseFrom = hasSelectableSubset(filteredRecords, records || []) || hasSelectableSubset(selectedRecords, records || []);

  async function handleCopyToClipboard(format: CopyAsDataType = 'excel') {
    let whichRecords: WhichRecordsToCopy = 'all';
    if (hasSubsetToChooseFrom) {
      const choice = await WhichRecordsToCopyModalPromise({ records: records || [], filteredRecords, selectedRecords });
      if (!choice) {
        return;
      }
      whichRecords = choice;
    }

    let recordsToCopy = records;
    if (whichRecords === 'filtered') {
      recordsToCopy = filteredRecords;
    } else if (whichRecords === 'selected') {
      recordsToCopy = selectedRecords;
    }

    copyRecordsToClipboard(recordsToCopy, format, fields);
    onCopy?.({ format, whichRecords });
  }

  return (
    <ButtonGroupContainer className={containerClassName}>
      <Tooltip
        openDelay={1000}
        content="This will copy in a format compatible with a spreadsheet program, such as Excel or Google Sheets. Use the dropdown for additional options."
      >
        <button
          className={classNames('slds-button slds-button_neutral slds-button_first', className)}
          onClick={() => handleCopyToClipboard()}
          disabled={isDisabled}
        >
          <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
          <span>Copy to Clipboard</span>
        </button>
      </Tooltip>
      <DropDown
        className="slds-button_last"
        dropDownClassName="slds-dropdown_actions"
        position="right"
        description="More copy formats"
        disabled={isDisabled}
        items={[
          { id: 'csv', value: 'Copy as CSV' },
          { id: 'json', value: 'Copy as JSON' },
        ]}
        onSelected={(item) => handleCopyToClipboard(item as CopyAsDataType)}
      />
    </ButtonGroupContainer>
  );
};

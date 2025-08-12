import { copyRecordsToClipboard } from '@jetstream/shared/ui-utils';
import { CopyAsDataType, Maybe, SalesforceRecord } from '@jetstream/types';
import { ButtonGroupContainer, DropDown, Icon, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';

export interface CopyRecordsToClipboardButtonProps {
  className?: string;
  containerClassName?: string;
  fields: Maybe<string[]>;
  records: Maybe<SalesforceRecord[]>;
}

export const CopyRecordsToClipboardButton: FunctionComponent<CopyRecordsToClipboardButtonProps> = ({
  className,
  containerClassName,
  fields,
  records,
}) => {
  function handleCopyToClipboard(format: CopyAsDataType = 'excel') {
    copyRecordsToClipboard(records, format, fields);
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
          disabled={!records?.length}
        >
          <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
          <span>Copy to Clipboard</span>
        </button>
      </Tooltip>
      <DropDown
        className="slds-button_last"
        dropDownClassName="slds-dropdown_actions"
        position="right"
        disabled={!records?.length}
        items={[
          { id: 'csv', value: 'Copy as CSV' },
          { id: 'json', value: 'Copy as JSON' },
        ]}
        onSelected={(item) => handleCopyToClipboard(item as CopyAsDataType)}
      />
    </ButtonGroupContainer>
  );
};

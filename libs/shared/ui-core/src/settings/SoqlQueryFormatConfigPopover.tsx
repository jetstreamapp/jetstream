import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { SoqlQueryFormatOptions } from '@jetstream/types';
import { fireToast, Icon, Popover, PopoverRef } from '@jetstream/ui';
import { useRef } from 'react';
import { useAmplitude } from '../analytics';
import { SoqlQueryFormatConfig } from './SoqlQueryFormatConfig';

interface SoqlQueryFormatConfigPopoverProps {
  /**
   * Location string for analytics purposes
   */
  location: string;
  value: SoqlQueryFormatOptions;
  onChange: (value: SoqlQueryFormatOptions) => void;
}

export const SoqlQueryFormatConfigPopover = ({ location, value, onChange }: SoqlQueryFormatConfigPopoverProps) => {
  const { trackEvent } = useAmplitude();
  const popoverRef = useRef<PopoverRef>(null);

  async function handleSave(updatedValue: SoqlQueryFormatOptions) {
    try {
      onChange(updatedValue);
      popoverRef.current?.close();
    } catch (ex) {
      logger.warn('Error saving SOQL format options', ex);
      fireToast({ type: 'error', message: 'There was an error saving the SOQL format options.' });
    }
  }
  return (
    <Popover
      ref={popoverRef}
      placement="top"
      onChange={(isOpen) => {
        if (isOpen) {
          trackEvent(ANALYTICS_KEYS.soql_format_opened, { location });
        }
      }}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small">SOQL Format Options</h2>
        </header>
      }
      content={
        <SoqlQueryFormatConfig
          location={location}
          omitHeader
          value={value}
          onChange={handleSave}
          onCancel={() => popoverRef.current?.close()}
        />
      }
      buttonProps={{ className: 'slds-button slds-button_icon' }}
    >
      <Icon className="slds-button__icon slds-button__icon_small" type="utility" icon="settings" description="Settings" omitContainer />
    </Popover>
  );
};

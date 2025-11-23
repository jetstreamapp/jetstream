import { css } from '@emotion/react';
import { Icon, Popover, PopoverRef } from '@jetstream/ui';
import { FunctionComponent, ReactNode, useEffect, useRef } from 'react';

export interface HeaderAnnouncementPopoverProps {
  children: ReactNode;
}

export const HeaderAnnouncementPopover: FunctionComponent<HeaderAnnouncementPopoverProps> = ({ children }) => {
  const isMounted = useRef(true);
  const popoverRef = useRef<PopoverRef>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <Popover
      ref={popoverRef}
      placement="bottom-end"
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="Get Help">
            Announcement
          </h2>
        </header>
      }
      content={children}
      buttonProps={{
        className:
          'slds-button slds-button_icon slds-button_icon slds-button_icon-warning slds-button_icon-container slds-button_icon-small cursor-pointer',
      }}
    >
      <Icon
        type="action"
        icon="announcement"
        className="slds-button__icon slds-icon slds-icon-text-warning"
        svgCss={css`
          color: #fe9339;
        `}
        omitContainer
      />
    </Popover>
  );
};

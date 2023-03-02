import { Icon, Popover, PopoverRef } from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HeaderDonatePopoverProps {}

export const HeaderDonatePopover: FunctionComponent<HeaderDonatePopoverProps> = () => {
  const isMounted = useRef(true);
  const popoverRef = useRef<PopoverRef>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function closePopover() {
    popoverRef.current?.close();
  }

  return (
    <Popover
      ref={popoverRef}
      placement="bottom-end"
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="Get Help">
            Support Jetstream
          </h2>
        </header>
      }
      content={
        <div>
          <p>Jetstream is an open source project and is paid for and supported by volunteers.</p>
          <a
            href="https://github.com/sponsors/jetstreamapp"
            className="slds-button slds-button_brand slds-m-top_medium"
            target="_blank"
            rel="noreferrer"
            onClick={closePopover}
          >
            <Icon type="custom" icon="heart" className="slds-button__icon slds-m-right_x-small" omitContainer />
            Become a sponsor
          </a>
        </div>
      }
      buttonProps={{
        className:
          'slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__help slds-global-actions__item-action cursor-pointer',
      }}
    >
      <Icon type="custom" icon="heart" className="text-color-pink slds-button__icon slds-global-header__icon" omitContainer />
    </Popover>
  );
};

export default HeaderDonatePopover;

import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { Icon, Popover, PopoverRef } from '@jetstream/ui';
import { useEffect, useRef } from 'react';
import { useAmplitude } from '@jetstream/ui-core';

export const HeaderDonatePopover = () => {
  const { trackEvent } = useAmplitude();
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
    trackEvent(ANALYTICS_KEYS.donate_popover_cta_click);
  }

  return (
    <Popover
      ref={popoverRef}
      placement="bottom-end"
      onChange={(isOpen) => isOpen && trackEvent(ANALYTICS_KEYS.donate_popover_open)}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="Get Help">
            Support the Future of Jetstream
          </h2>
        </header>
      }
      content={
        <div>
          <p>Jetstream thrives on the generosity and support of its community.</p>
          <p className="slds-m-top_x-small">
            Jetstream not only offers you a comprehensive suite of tools that save time, enhance productivity, and streamline data
            management, but also delivers a best-in-class experience for managing Salesforce effectively.
          </p>
          <p className="slds-m-top_x-small">
            <strong>
              If Jetstream has made a difference in your work, please consider supporting us with a one-time or monthly donation.
            </strong>
          </p>
          <a
            href="https://github.com/sponsors/jetstreamapp"
            className="slds-button slds-button_brand slds-button_stretch slds-m-top_medium"
            target="_blank"
            rel="noreferrer"
            onClick={closePopover}
          >
            <Icon type="custom" icon="heart" className="slds-button__icon slds-m-right_x-small" omitContainer />
            Donate Now
          </a>
        </div>
      }
      buttonProps={{
        className: 'slds-button slds-button_brand slds-global-actions__help cursor-pointer',
      }}
    >
      <Icon type="custom" icon="heart" className="slds-button__icon slds-m-right_x-small" omitContainer />
      Donate
    </Popover>
  );
};

export default HeaderDonatePopover;

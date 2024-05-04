import { FeedbackLink, Icon, Popover, PopoverRef } from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HeaderHelpPopoverProps {}

export const HeaderHelpPopover: FunctionComponent<HeaderHelpPopoverProps> = () => {
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
            Get Support
          </h2>
        </header>
      }
      content={
        <div>
          <ul>
            <li className="slds-box slds-box_x-small slds-m-bottom_x-small">
              <a href="https://docs.getjetstream.app" target="_blank" rel="noreferrer" onClick={() => closePopover()}>
                <span className="slds-truncate" title="Documentation">
                  Documentation
                </span>
                <Icon
                  type="utility"
                  icon="new_window"
                  className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-left_xx-small"
                  omitContainer
                />
              </a>
            </li>
            <li className="slds-box slds-box_x-small slds-m-bottom_x-small">
              <FeedbackLink type="GH_ISSUE" label="Report a bug or feature request" onClick={() => closePopover()} />
            </li>
            <li className="slds-box slds-box_x-small slds-m-bottom_x-small">
              <FeedbackLink type="GH_DISCUSSION" label="Start a discussion" onClick={() => closePopover()} />
            </li>
            <li className="slds-box slds-box_x-small slds-m-bottom_x-small">
              <FeedbackLink type="DISCORD" label="SFXD Discord" onClick={() => closePopover()} />
              <p>#vendors-jetstream channel</p>
            </li>
            <li className="slds-box slds-box_x-small slds-m-bottom_x-small">
              <FeedbackLink type="EMAIL" label="Send us an email" onClick={() => closePopover()} />
            </li>
          </ul>
        </div>
      }
      buttonProps={{
        className:
          'slds-button slds-button_icon slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__help slds-global-actions__item-action cursor-pointer',
      }}
    >
      <Icon type="utility" icon="help" className="slds-button__icon slds-global-header__icon" omitContainer />
    </Popover>
  );
};

export default HeaderHelpPopover;

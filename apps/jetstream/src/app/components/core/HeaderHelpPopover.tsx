import { Icon, Popover } from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HeaderHelpPopoverProps {}

export const HeaderHelpPopover: FunctionComponent<HeaderHelpPopoverProps> = () => {
  const isMounted = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function toggleOpen() {
    setIsOpen(!isOpen);
  }

  return (
    <Popover
      placement="bottom-end"
      isOpen={isOpen}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="Refresh Metadata">
            Get Help
          </h2>
        </header>
      }
      content={
        <div>
          <ul>
            <li className="slds-p-around_x-small">
              {/* slds-button slds-button_reset slds-p-vertical_xx-small slds-size_1-of-1 */}
              <a href="https://docs.getjetstream.app" target="_blank" rel="noreferrer">
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
            <li className="slds-p-around_x-small">
              <Link to={{ pathname: '/feedback' }} onClick={() => setIsOpen(false)} target="blank">
                <span className="slds-truncate" title={'File a support ticket'}>
                  File a support ticket
                </span>
                <Icon
                  type="utility"
                  icon="new_window"
                  className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-left_xx-small"
                  omitContainer
                />
              </Link>
            </li>
          </ul>
        </div>
      }
    >
      <button
        className="slds-button slds-button_icon slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__help slds-global-actions__item-action"
        onClick={toggleOpen}
      >
        <Icon type="utility" icon="help" className="slds-button__icon slds-global-header__icon" omitContainer />
      </button>
    </Popover>
  );
};

export default HeaderHelpPopover;

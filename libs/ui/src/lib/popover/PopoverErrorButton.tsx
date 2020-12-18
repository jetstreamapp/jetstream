/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FunctionComponent, useState } from 'react';
import Icon from '../widgets/Icon';
import Popover from './Popover';

export interface PopoverErrorButtonProps {
  initOpenState?: boolean;
  header?: string;
  listHeader?: string;
  errors: string[];
}

export const PopoverErrorButton: FunctionComponent<PopoverErrorButtonProps> = ({
  initOpenState = true,
  header = 'We hit a snag.',
  listHeader = 'Review the following errors',
  errors,
}) => {
  const [isOpen, setIsOpen] = useState(initOpenState || true);

  return (
    <div
      css={css`
        display: inline-block;
      `}
    >
      <Popover
        containerClassName="slds-popover_error"
        inverseIcons
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onOpen={() => setIsOpen(true)}
        header={
          <header className="slds-popover__header">
            <div className="slds-media slds-media_center slds-has-flexi-truncate">
              <div className="slds-media__figure">
                <Icon
                  type="utility"
                  icon="error"
                  className="slds-icon slds-icon_x-small"
                  containerClassname="slds-icon-utility-error slds-icon_container"
                />
              </div>
              <div className="slds-media__body">
                <h2 className="slds-truncate slds-text-heading_medium">{header}</h2>
              </div>
            </div>
          </header>
        }
        content={
          <div>
            <div>
              <strong>{listHeader}</strong>
            </div>
            <ul className="slds-list_dotted slds-m-left_medium">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        }
      >
        <button className="slds-button slds-button_icon slds-button-icon-error slds-m-right_small" onClick={() => setIsOpen(!isOpen)}>
          <Icon
            type="utility"
            icon="error"
            description="Review errors"
            className="slds-icon slds-icon-text-error slds-icon_small"
            containerClassname="slds-icon-utility-error slds-icon_container"
          />
        </button>
      </Popover>
    </div>
  );
};

export default PopoverErrorButton;

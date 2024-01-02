import { css } from '@emotion/react';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useRef } from 'react';
import Icon from '../widgets/Icon';
import Popover, { PopoverRef } from './Popover';

export interface PopoverErrorButtonProps {
  className?: string;
  initOpenState?: boolean;
  header?: string;
  listHeader?: string | null;
  errors: string | string[];
  omitPortal?: boolean;
  portalRef?: Element;
}

export const PopoverErrorButton: FunctionComponent<PopoverErrorButtonProps> = ({
  className,
  initOpenState = true,
  header = 'We hit a snag.',
  listHeader = 'Review the following errors',
  errors,
  omitPortal,
  portalRef,
}) => {
  const popoverRef = useRef<PopoverRef>(null);

  useEffect(() => {
    if (initOpenState) {
      setTimeout(() => {
        if (popoverRef.current) {
          popoverRef.current?.open();
        }
      });
    }
  }, []);

  return (
    <div
      css={css`
        display: inline-block;
      `}
    >
      <Popover
        ref={popoverRef}
        containerClassName="slds-popover_error"
        inverseIcons
        omitPortal={omitPortal}
        portalRef={portalRef}
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
            {Array.isArray(errors) ? (
              <ul className="slds-list_dotted slds-m-left_medium">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            ) : (
              <div>{errors}</div>
            )}
          </div>
        }
        buttonProps={{
          className: classNames('slds-button slds-button_icon slds-button-icon-error', className),
        }}
      >
        <Icon
          type="utility"
          icon="error"
          description="Review errors"
          className="slds-icon slds-icon-text-error slds-icon_small"
          containerClassname="slds-icon-utility-error slds-icon_container"
        />
      </Popover>
    </div>
  );
};

export default PopoverErrorButton;

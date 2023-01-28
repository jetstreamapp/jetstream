import React, { FunctionComponent } from 'react';
import { InfoWarningErrorOffline } from '@jetstream/types';
import classNames from 'classnames';
import Icon from '../widgets/Icon';
import { IconName } from '@jetstream/icon-factory';

export interface AlertProps {
  className?: string;
  type: InfoWarningErrorOffline;
  leadingIcon?: IconName;
  allowClose?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
}

/**
 * This is used when a button is inline on a form where there needs to be top-margin to align with the inputs
 * (e.x. ExpressionConditionRow)
 */
export const Alert: FunctionComponent<AlertProps> = ({ className, type, leadingIcon, allowClose, children, onClose }) => {
  return (
    <div className={classNames('slds-notify slds-notify_alert slds-theme_alert-texture', `slds-theme_${type}`, className)} role="alert">
      <span className="slds-assistive-text">{type}</span>
      {leadingIcon && (
        <Icon
          type="utility"
          icon={leadingIcon}
          containerClassname={classNames('slds-m-right_x-small', `slds-icon-utility-${type}`)}
          className="slds-icon slds-icon_x-small"
        />
      )}
      <h2>{children}</h2>
      <div className="slds-notify__close">
        {allowClose && (
          <button
            className="slds-button slds-button_icon slds-button_icon-small slds-button_icon-inverse"
            title="Close"
            onClick={() => onClose && onClose()}
          >
            <Icon type="utility" icon="close" omitContainer className="slds-button__icon" />{' '}
            <span className="slds-assistive-text">Close</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;

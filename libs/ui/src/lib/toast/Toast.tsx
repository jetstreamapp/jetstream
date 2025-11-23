import { css } from '@emotion/react';
import { InfoSuccessWarningError } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, ReactNode } from 'react';
import Icon from '../widgets/Icon';

export interface ToastProps {
  type?: InfoSuccessWarningError;
  showIcon?: boolean;
  className?: string;
  headingClassName?: string;
  children?: ReactNode;
  onClose?: () => void;
}

function getCssClass(type?: InfoSuccessWarningError) {
  switch (type) {
    case 'success':
      return 'slds-theme_success';
    case 'warning':
      return 'slds-theme_warning';
    case 'error':
      return 'slds-theme_error';
    default:
      return 'slds-theme_info';
  }
}

function getIcon(type?: InfoSuccessWarningError) {
  return (
    <Icon
      type="utility"
      icon={type || 'info'}
      className="slds-icon slds-icon_small"
      containerClassname="slds-icon_container slds-m-right_small slds-no-flex slds-align-top"
    />
  );
}

export const Toast: FunctionComponent<ToastProps> = ({
  type = 'info',
  showIcon = true,
  className = 'slds-notify_container slds-is-relative',
  headingClassName = 'slds-text-heading_small',
  onClose,
  children,
}) => {
  return (
    <div className={className}>
      <div className={classNames('slds-notify slds-notify_toast', getCssClass(type))} role="status">
        <span className="slds-assistive-text">{type || 'info'}</span>
        {showIcon && getIcon(type)}
        <div
          css={css`
            app-region: no-drag;
          `}
          className="slds-notify__content"
        >
          <h2 className={headingClassName}>{children}</h2>
        </div>
        {onClose && (
          <div
            css={css`
              app-region: no-drag;
            `}
            className="slds-notify__close"
          >
            <button className="slds-button slds-button_icon slds-button_icon-inverse" title="Close" onClick={onClose}>
              <Icon type="utility" icon="close" className="slds-button__icon slds-button__icon_large" omitContainer />
              <span className="slds-assistive-text">Close</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Toast;

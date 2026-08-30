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
  /**
   * Render the toast itself as a live region (default). AppToast passes false for non-error toasts
   * because it announces them through one persistent region instead — a status region that is
   * inserted already containing its text is unreliably announced.
   */
  liveRegion?: boolean;
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
  liveRegion = true,
  onClose,
  children,
}) => {
  const liveRegionProps = liveRegion
    ? {
        // Errors interrupt (assertive); everything else waits its turn. aria-atomic so the whole
        // toast is announced, not just the text node that changed.
        role: type === 'error' ? 'alert' : 'status',
        'aria-live': type === 'error' ? ('assertive' as const) : ('polite' as const),
        'aria-atomic': true,
      }
    : {};
  return (
    <div className={className}>
      <div className={classNames('slds-notify slds-notify_toast', getCssClass(type))} {...liveRegionProps}>
        <span className="slds-assistive-text">{type || 'info'}</span>
        {showIcon && getIcon(type)}
        <div
          css={css`
            app-region: no-drag;
          `}
          className="slds-notify__content"
        >
          {typeof children === 'string' ? (
            <h2 className={headingClassName}>{children}</h2>
          ) : (
            <div className={headingClassName}>{children}</div>
          )}
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

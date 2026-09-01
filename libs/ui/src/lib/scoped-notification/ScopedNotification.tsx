import { ScopedNotificationTypes } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useState } from 'react';
import Icon from '../widgets/Icon';

export interface ScopedNotificationProps {
  className?: string;
  theme: ScopedNotificationTypes;
  icon?: React.ReactNode;
  /** When true, renders a close button that hides the notification when clicked */
  allowClose?: boolean;
  /** Invoked when the close button is clicked (only relevant when allowClose is true) */
  onClose?: () => void;
  /**
   * Resets a prior dismissal when this value changes. Pass an identifier for the underlying content
   * (e.g. a job/run id) so re-running with a new result re-shows the notification the user dismissed
   * for the previous result; leave undefined to keep dismissal sticky for the component's lifetime.
   */
  dismissResetKey?: string | number | null;
  children?: React.ReactNode;
}

// Themes with a light background need dark button icons; the rest have colored/dark backgrounds and need inverse (light) icons
function isInverseCloseButton(theme: ScopedNotificationTypes) {
  return theme !== 'warning' && theme !== 'light';
}

function getIcon(theme: ScopedNotificationTypes, icon?: React.ReactNode) {
  if (icon) {
    return icon;
  }
  switch (theme) {
    case 'success':
      return (
        <Icon
          type="utility"
          icon="success"
          title="success"
          containerClassname="slds-icon_container slds-icon-utility-success"
          className="slds-icon slds-icon_small"
        />
      );
    case 'warning':
      return (
        <Icon
          type="utility"
          icon="warning"
          title="warning"
          containerClassname="slds-icon_container slds-icon-utility-warning"
          className="slds-icon slds-icon_small"
        />
      );
    case 'error':
      return (
        <Icon
          type="utility"
          icon="error"
          title="error"
          containerClassname="slds-icon_container slds-icon-utility-error"
          className="slds-icon slds-icon_small"
        />
      );
    case 'light':
      return (
        <Icon
          type="utility"
          icon="info"
          title="information"
          containerClassname="slds-icon_container slds-icon-utility-info"
          className="slds-icon slds-icon_small slds-icon-text-default"
        />
      );
    case 'dark':
    case 'info':
    default:
      return (
        <Icon
          type="utility"
          icon="info"
          title="information"
          containerClassname="slds-icon_container slds-icon-utility-info"
          className="slds-icon slds-icon_small"
        />
      );
  }
}

export const ScopedNotification: FunctionComponent<ScopedNotificationProps> = ({
  className,
  theme,
  icon,
  allowClose,
  onClose,
  dismissResetKey,
  children,
}) => {
  const [iconEl, setIconEl] = useState(() => getIcon(theme, icon));
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastDismissResetKey, setLastDismissResetKey] = useState(dismissResetKey);

  useEffect(() => {
    setIconEl(getIcon(theme, icon));
  }, [icon, theme]);

  // Un-dismiss when the caller signals new content so a fresh notification is not hidden by a prior dismissal.
  if (dismissResetKey !== lastDismissResetKey) {
    setLastDismissResetKey(dismissResetKey);
    setIsDismissed(false);
  }

  if (isDismissed) {
    return null;
  }

  function handleClose() {
    setIsDismissed(true);
    onClose?.();
  }

  return (
    <div
      // Inline outcomes (save/deploy/load errors, results summaries) render through this component, so
      // it is a live region: errors interrupt, everything else is announced politely. Notifications
      // present at page load are ignored by assistive tech, which is the desired behaviour for banners.
      role={theme === 'error' ? 'alert' : 'status'}
      className={classNames(
        'slds-scoped-notification slds-media slds-media_center',
        {
          'slds-scoped-notification_light': theme === 'light',
          'slds-scoped-notification_dark': theme === 'dark',
          'slds-theme_info': theme === 'info',
          'slds-theme_success': theme === 'success',
          'slds-theme_warning': theme === 'warning',
          'slds-theme_error': theme === 'error',
        },
        className,
      )}
    >
      <div className="slds-media__figure">{iconEl}</div>
      <div className="slds-media__body">{children}</div>
      {allowClose && (
        <div className="slds-media__figure slds-media__figure_reverse">
          <button
            type="button"
            className={classNames('slds-button slds-button_icon slds-button_icon-small', {
              'slds-button_icon-inverse': isInverseCloseButton(theme),
            })}
            title="Close"
            onClick={handleClose}
          >
            <Icon type="utility" icon="close" omitContainer className="slds-button__icon" />
            <span className="slds-assistive-text">Close</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ScopedNotification;

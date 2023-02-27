import { ScopedNotificationTypes } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useState } from 'react';
import Icon from '../widgets/Icon';

export interface ScopedNotificationProps {
  className?: string;
  theme: ScopedNotificationTypes;
  icon?: JSX.Element;
  children?: React.ReactNode;
}

function getIcon(theme: ScopedNotificationTypes, icon?: JSX.Element) {
  if (icon) {
    return icon;
  }
  switch (theme) {
    case 'success':
      return (
        <Icon
          type="utility"
          icon="success"
          title="information"
          containerClassname="slds-icon_container slds-icon-utility-success"
          className="slds-icon slds-icon_small"
        />
      );
    case 'warning':
      return (
        <Icon
          type="utility"
          icon="warning"
          title="information"
          containerClassname="slds-icon_container slds-icon-utility-warning"
          className="slds-icon slds-icon_small"
        />
      );
    case 'error':
      return (
        <Icon
          type="utility"
          icon="error"
          title="information"
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

export const ScopedNotification: FunctionComponent<ScopedNotificationProps> = ({ className, theme, icon, children }) => {
  const [iconEl, setIconEl] = useState(() => getIcon(theme, icon));

  useEffect(() => {
    setIconEl(getIcon(theme, icon));
  }, [icon, theme]);

  return (
    <div
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
        className
      )}
    >
      <div className="slds-media__figure">{iconEl}</div>
      <div className="slds-media__body">{children}</div>
    </div>
  );
};

export default ScopedNotification;

import { css } from '@emotion/react';
import classNames from 'classnames';
import React, { FunctionComponent, ReactNode } from 'react';

export interface BadgeNotificationProps {
  className?: string;
  animate?: boolean;
  children?: ReactNode;
}

export const BadgeNotification: FunctionComponent<BadgeNotificationProps> = ({ className, animate, children }) => {
  return (
    <span
      css={css`
        opacity: 1;
      `}
      aria-hidden="true"
      className={classNames('slds-notification-badge', { 'slds-show-notification': animate }, className)}
    >
      {children}
    </span>
  );
};

export default BadgeNotification;

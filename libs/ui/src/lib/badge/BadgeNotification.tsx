import { css } from '@emotion/react';
import classNames from 'classnames';
import { ReactNode } from 'react';

export interface BadgeNotificationProps {
  className?: string;
  animate?: boolean;
  onClear?: () => void;
  children?: ReactNode;
}

export const BadgeNotification = ({ className, animate = false, onClear, children }: BadgeNotificationProps) => {
  return (
    <span
      css={css`
        opacity: 1;
        ${onClear ? 'cursor: pointer;' : ''}
      `}
      aria-hidden="true"
      className={classNames('slds-notification-badge', { 'slds-show-notification': animate }, className)}
      onClick={onClear}
    >
      {children}
    </span>
  );
};

export default BadgeNotification;

import { css } from '@emotion/react';
import { Badge, BadgeProps } from './Badge';
import { Popover, PopoverProps } from '../popover/Popover';
import { FunctionComponent, ReactNode } from 'react';

export interface BadgePopoverProps {
  popoverTitle: string;
  badgeLabel: string;
  badgeProps?: BadgeProps;
  popoverProps?: PopoverProps;
  children?: ReactNode;
}

export const BadgePopover: FunctionComponent<BadgePopoverProps> = ({ badgeProps, popoverProps, popoverTitle, badgeLabel, children }) => {
  return (
    <Popover
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title={popoverTitle}>
            {popoverTitle}
          </h2>
        </header>
      }
      content={
        <div
          css={css`
            max-height: 80vh;
          `}
        >
          {children}
        </div>
      }
      buttonProps={{ className: 'slds-button' }}
      {...popoverProps}
    >
      <Badge {...badgeProps}>{badgeLabel}</Badge>
    </Popover>
  );
};

export default BadgePopover;

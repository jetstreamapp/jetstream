import { ListItem } from '@jetstream/types';
import { EmptyState } from '../illustrations/EmptyState';
import { Fragment, FunctionComponent } from 'react';

export interface BadgePopoverListProps {
  items: ListItem[];
  emptyStateHeadline?: string;
  /** If provided, no other classes will be added */
  ulClassName?: string;
  /** Good options: slds-item, slds-item read-only */
  liClassName?: string;
  /** Click only allowed if provided */
  onClick?: (item: ListItem) => void;
}

export const BadgePopoverList: FunctionComponent<BadgePopoverListProps> = ({
  items,
  emptyStateHeadline = `You don't have any items selected`,
  ulClassName = 'slds-has-dividers_top-space slds-dropdown_length-10',
  liClassName,
  onClick,
}) => {
  return (
    <Fragment>
      {!items.length && <EmptyState headline={emptyStateHeadline}></EmptyState>}
      <ul className={ulClassName}>
        {items.map((item) => (
          <li key={item.id} className={liClassName} onClick={() => onClick && onClick(item)}>
            <div className="slds-truncate">{item.label}</div>
            {/* TODO: add secondary label */}
          </li>
        ))}
      </ul>
    </Fragment>
  );
};

export default BadgePopoverList;

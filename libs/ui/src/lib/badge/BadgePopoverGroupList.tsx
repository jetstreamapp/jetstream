import { ListItem, ListItemGroup } from '@jetstream/types';
import { Fragment, FunctionComponent } from 'react';
import { EmptyState } from '../illustrations/EmptyState';

export interface BadgePopoverGroupListProps {
  items: ListItemGroup[];
  emptyStateHeadline?: string;
  /** If provided, no other classes will be added */
  ulClassName?: string;
  /** Good options: slds-item, slds-item read-only */
  liClassName?: string;
  /** Click only allowed if provided */
  onClick?: (groupId: string, item: ListItem) => void;
}

export const BadgePopoverGroupList: FunctionComponent<BadgePopoverGroupListProps> = ({
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
        {items.map((group) => (
          <li className="slds-item read-only" key={group.id}>
            <div className="slds-truncate slds-text-heading_small">{group.label}</div>
            <ul>
              {group.items.map((item) => (
                <li key={item.id} className={liClassName} onClick={() => onClick && onClick(group.id, item)}>
                  <div className="slds-truncate">{item.label}</div>
                  {/* TODO: add secondary label */}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Fragment>
  );
};

export default BadgePopoverGroupList;

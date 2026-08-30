import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { SyntheticEvent } from 'react';
import Icon from '../widgets/Icon';
import { TreeItems } from './Tree';

export interface TreeItemProps {
  item: TreeItems;
  level: number;
  selectedItem?: Maybe<string>;
  /** The one item in the tree's roving tab order (see Tree) */
  focusableItemId?: Maybe<string>;
  expandedItems: Set<string>;
  onSelected: (item: TreeItems) => void;
}

export const TreeItem = ({ item, expandedItems, level, selectedItem, focusableItemId, onSelected }: TreeItemProps) => {
  const { id, label, title, treeItems } = item;
  const selected = id === selectedItem;
  const expanded = expandedItems.has(id);

  function handleSelection(event: SyntheticEvent<HTMLLIElement | HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onSelected(item);
  }

  return (
    <li
      // Leaf items must not claim expand/collapse semantics
      aria-expanded={treeItems?.length ? expanded : undefined}
      aria-level={level}
      aria-selected={selected}
      role="treeitem"
      data-tree-item-id={id}
      tabIndex={id === focusableItemId ? 0 : -1}
      onClick={handleSelection}
    >
      <div className="slds-tree__item">
        <button
          className={classNames('slds-button slds-button_icon slds-m-right_x-small', { 'slds-hidden': !treeItems?.length })}
          aria-hidden="true"
          tabIndex={-1}
          title="Expand Item"
          onClick={handleSelection}
        >
          <Icon
            type="utility"
            icon="chevronright"
            description="Expand Item"
            className="slds-button__icon slds-button__icon_small"
            omitContainer
          />
        </button>
        <span className="slds-has-flexi-truncate">
          {isString(label) ? (
            <span className="slds-tree__item-label slds-truncate" title={title || label}>
              {label}
            </span>
          ) : (
            label
          )}
        </span>
      </div>
      {/* ONE group for all children — a group per child made screen readers announce every child as "1 of 1" */}
      {expanded && treeItems && treeItems.length > 0 && (
        <ul role="group">
          {treeItems.map((childItem) => (
            <TreeItem
              key={`${level}-${childItem.id}`}
              item={childItem}
              level={level + 1}
              selectedItem={selectedItem}
              focusableItemId={focusableItemId}
              expandedItems={expandedItems}
              onSelected={onSelected}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default TreeItem;

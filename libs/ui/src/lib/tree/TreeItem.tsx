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
  expandedItems: Set<string>;
  onSelected: (item: TreeItems) => void;
}

export const TreeItem = ({ item, expandedItems, level, selectedItem, onSelected }: TreeItemProps) => {
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
      aria-expanded={expanded}
      aria-level={level}
      aria-selected={selected}
      role="treeitem"
      tabIndex={selected ? 0 : -1}
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
      {expanded &&
        treeItems?.map((childItem) => (
          <ul role="group" key={`${level}-${childItem.id}`}>
            <TreeItem
              item={childItem}
              level={level + 1}
              selectedItem={selectedItem}
              expandedItems={expandedItems}
              onSelected={onSelected}
            />
          </ul>
        ))}
    </li>
  );
};

export default TreeItem;

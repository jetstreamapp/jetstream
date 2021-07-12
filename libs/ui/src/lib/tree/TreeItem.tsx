/** @jsx jsx */
import { jsx } from '@emotion/react';
import classNames from 'classnames';
import { SyntheticEvent } from 'react';
import Icon from '../widgets/Icon';
import { TreeItems } from './Tree';

export interface TreeItemProps {
  id: string;
  label: string;
  title?: string;
  treeItems?: TreeItems[];
  level: number;
  selectedItem: string;
  expandedItems: Set<string>;
  onSelected: (id: string) => void;
}

export const TreeItem = ({ id, label, title, expandedItems, treeItems, level, selectedItem, onSelected }: TreeItemProps) => {
  const selected = id === selectedItem;
  const expanded = expandedItems.has(id);

  function handleSelection(event: SyntheticEvent<HTMLLIElement | HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onSelected(id);
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
          <span className="slds-tree__item-label slds-truncate" title={title || label}>
            {label}
          </span>
        </span>
      </div>
      {expanded &&
        treeItems?.map((item) => (
          <ul role="group" key={`${level}-${item.id}`}>
            <TreeItem
              id={item.id}
              label={item.label}
              title={item.title}
              treeItems={item.treeItems}
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

/* eslint-disable jsx-a11y/anchor-is-valid */
/** @jsx jsx */
import { jsx } from '@emotion/react';
import classNames from 'classnames';
import TreeItem from 'libs/ui/src/lib/tree/TreeItem';
import { useState } from 'react';

export interface TreeItems {
  id: string;
  label: string;
  title?: string;
  meta?: any;
  treeItems?: TreeItems[];
}

export interface TreeProps {
  className?: string;
  header?: string;
  items: TreeItems[];
  onSelected?: (item: TreeItems) => void;
}

export const Tree = ({ className, header, items, onSelected }: TreeProps) => {
  const [selectedItem, setSelectedItem] = useState<string>();
  const [expandedItems, setExpandedItems] = useState(new Set<string>());

  function handleSelection(id: string) {
    setSelectedItem(id);
    expandedItems.has(id) ? expandedItems.delete(id) : expandedItems.add(id);
    setExpandedItems(new Set(expandedItems));
    onSelected && onSelected(items.find((item) => item.id));
  }

  return (
    <div className={classNames('slds-tree_container', className)}>
      {header && (
        <h4 className="slds-tree__group-header" id="tree-heading">
          {header}
        </h4>
      )}
      <ul aria-labelledby="tree-heading" className="slds-tree" role="tree">
        {items.map((item) => (
          <TreeItem
            key={`0-${item.id}`}
            id={item.id}
            label={item.label}
            title={item.title}
            treeItems={item.treeItems}
            level={1}
            selectedItem={selectedItem}
            expandedItems={expandedItems}
            onSelected={handleSelection}
          />
        ))}
      </ul>
    </div>
  );
};

export default Tree;

/* eslint-disable jsx-a11y/anchor-is-valid */

import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import classNames from 'classnames';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import TreeItem from './TreeItem';

export interface TreeItems<T = any> {
  id: string;
  label: string | React.ReactNode | JSX.Element;
  title?: string;
  meta?: T;
  treeItems?: TreeItems[];
}

export interface TreeProps {
  className?: string;
  header?: string;
  items: TreeItems[];
  expandAllOnInit?: boolean;
  selectFirstLeafNodeOnInit?: boolean;
  /** If true, don't call onSelected when an expandable node is called */
  onlyEmitOnLeafNodeClick?: boolean;
  /** If the list of items changes, then re-emit the selected item. Existing use-case is that some additional metadata is added to items and parent needs to know about it */
  reEmitSelectionOnItemsChange?: boolean;
  onSelected?: (item: TreeItems) => void;
}

export interface TreeHandleRefFns {
  collapseAll: () => void;
  expandAll: () => void;
  selectItem: (id: string) => void;
}

function getAllIds(
  items: TreeItems[],
  output?: { ids: Set<string>; idMap: Record<string, TreeItems> }
): { ids: Set<string>; idMap: Record<string, TreeItems> } {
  output = output || { ids: new Set(), idMap: {} };
  items.forEach((item) => {
    output && output.ids.add(item.id);
    output && (output.idMap[item.id] = item);
    if (Array.isArray(item.treeItems)) {
      return getAllIds(item.treeItems, output);
    }
  });

  return output;
}

export const Tree = forwardRef<any, TreeProps>(
  (
    {
      className,
      header,
      items,
      expandAllOnInit = false,
      selectFirstLeafNodeOnInit = false,
      onlyEmitOnLeafNodeClick = false,
      reEmitSelectionOnItemsChange = false,
      onSelected,
    },
    ref
  ) => {
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState(new Set<string>());

    useNonInitialEffect(() => {
      if (onSelected && reEmitSelectionOnItemsChange && items?.length > 0 && selectedItem) {
        const { ids, idMap } = getAllIds(items);
        onSelected && onSelected(idMap[selectedItem]);
      }
    }, [reEmitSelectionOnItemsChange, items]);

    useEffect(() => {
      if (Array.isArray(items)) {
        const { ids, idMap } = getAllIds(items);
        if (expandAllOnInit) {
          // set all items that are expandable
          setExpandedItems(new Set(Array.from(ids).filter((id) => idMap[id].treeItems?.length)));
        }
        if (selectFirstLeafNodeOnInit) {
          const firstLeafNode = Array.from(ids).find((id) => !idMap[id].treeItems?.length);
          if (firstLeafNode) {
            setSelectedItem(firstLeafNode);
            onSelected && onSelected(idMap[firstLeafNode]);
          }
        }
      }
    }, []);

    useImperativeHandle<any, TreeHandleRefFns>(ref, () => ({
      collapseAll() {
        setExpandedItems(new Set<string>());
      },
      expandAll() {
        const { ids, idMap } = getAllIds(items);
        setExpandedItems(new Set(Array.from(ids).filter((id) => idMap[id].treeItems?.length)));
      },
      selectItem(id: string) {
        expandedItems.add(id);
        setExpandedItems(new Set(expandedItems));
      },
    }));

    function handleSelection(item: TreeItems) {
      setSelectedItem(item.id);
      expandedItems.has(item.id) ? expandedItems.delete(item.id) : expandedItems.add(item.id);
      setExpandedItems(new Set(expandedItems));
      if (!onlyEmitOnLeafNodeClick || !item.treeItems || !item.treeItems.length) {
        onSelected && onSelected(item);
      }
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
              item={item}
              level={1}
              selectedItem={selectedItem}
              expandedItems={expandedItems}
              onSelected={handleSelection}
            />
          ))}
        </ul>
      </div>
    );
  }
);

export default Tree;

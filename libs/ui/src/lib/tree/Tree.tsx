/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import classNames from 'classnames';
import { forwardRef, KeyboardEvent, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import TreeItem from './TreeItem';

export interface TreeItems<T = any> {
  id: string;
  label: string | React.ReactNode;
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
  /**
   * If the list of items changes, then re-emit the selected item. Existing use-case is that some additional metadata is added to items and parent needs to know about it.
   * If the selected item is no longer in the list of items (e.g. it was filtered out), the first remaining leaf node is selected and emitted instead.
   */
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
  output?: { ids: Set<string>; idMap: Record<string, TreeItems> },
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

function getFirstLeafNodeId(ids: Set<string>, idMap: Record<string, TreeItems>): string | undefined {
  return Array.from(ids).find((id) => !idMap[id].treeItems?.length);
}

/** Depth-first ids of the items currently rendered (children only when their parent is expanded). */
function getVisibleIds(items: TreeItems[], expandedItems: Set<string>, output: string[] = []): string[] {
  items.forEach((item) => {
    output.push(item.id);
    if (expandedItems.has(item.id) && item.treeItems?.length) {
      getVisibleIds(item.treeItems, expandedItems, output);
    }
  });
  return output;
}

function getParentIdMap(items: TreeItems[], parentId: string | null = null, output: Record<string, string | null> = {}) {
  items.forEach((item) => {
    output[item.id] = parentId;
    if (item.treeItems?.length) {
      getParentIdMap(item.treeItems, item.id, output);
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
    ref,
  ) => {
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState(new Set<string>());
    const [focusedItem, setFocusedItem] = useState<string | null>(null);
    const ulRef = useRef<HTMLUListElement>(null);
    const onSelectedRef = useRef(onSelected);
    onSelectedRef.current = onSelected;

    useNonInitialEffect(() => {
      if (!onSelectedRef.current || !reEmitSelectionOnItemsChange || !items?.length || !selectedItem) {
        return;
      }
      const { ids, idMap } = getAllIds(items);
      const item = idMap[selectedItem];
      if (item) {
        onSelectedRef.current(item);
        return;
      }
      // The selected item is no longer in the tree (e.g. it was filtered out), fall back to the first remaining leaf node.
      // Updating the selection re-runs this effect, which is what emits the new selection.
      const firstLeafNode = getFirstLeafNodeId(ids, idMap);
      if (firstLeafNode) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedItem(firstLeafNode);
      }
    }, [items, reEmitSelectionOnItemsChange, selectedItem]);

    useEffect(() => {
      if (Array.isArray(items)) {
        const { ids, idMap } = getAllIds(items);
        if (expandAllOnInit) {
          // set all items that are expandable
          setExpandedItems(new Set(Array.from(ids).filter((id) => idMap[id].treeItems?.length)));
        }
        if (selectFirstLeafNodeOnInit) {
          const firstLeafNode = getFirstLeafNodeId(ids, idMap);
          if (firstLeafNode) {
            setSelectedItem(firstLeafNode);
            onSelectedRef.current && onSelectedRef.current(idMap[firstLeafNode]);
          }
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setFocusedItem(item.id);
      expandedItems.has(item.id) ? expandedItems.delete(item.id) : expandedItems.add(item.id);
      setExpandedItems(new Set(expandedItems));
      if (!onlyEmitOnLeafNodeClick || !item.treeItems || !item.treeItems.length) {
        onSelectedRef.current && onSelectedRef.current(item);
      }
    }

    const { idMap, parentIdMap } = useMemo(() => ({ idMap: getAllIds(items).idMap, parentIdMap: getParentIdMap(items) }), [items]);

    // Roving tabindex: exactly one treeitem is tabbable — the last focused item, falling back to the
    // current selection, falling back to the first root item.
    const visibleIds = useMemo(() => getVisibleIds(items, expandedItems), [items, expandedItems]);
    const focusableItemId =
      (focusedItem && visibleIds.includes(focusedItem) && focusedItem) ||
      (selectedItem && visibleIds.includes(selectedItem) && selectedItem) ||
      visibleIds[0] ||
      null;

    function focusTreeItem(id: string) {
      setFocusedItem(id);
      window.requestAnimationFrame(() => {
        ulRef.current?.querySelector<HTMLElement>(`[data-tree-item-id="${CSS.escape(id)}"]`)?.focus();
      });
    }

    /**
     * APG tree pattern: Up/Down move through visible items, Right expands (or steps into an expanded
     * group), Left collapses (or steps to the parent), Enter/Space activate (select a leaf / toggle a
     * group), Home/End jump to the first/last visible item.
     */
    function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
      const targetId = (event.target as HTMLElement).closest('[data-tree-item-id]')?.getAttribute('data-tree-item-id');
      if (!targetId || !idMap[targetId]) {
        return;
      }
      const item = idMap[targetId];
      const isExpandable = !!item.treeItems?.length;
      const currentIndex = visibleIds.indexOf(targetId);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          event.stopPropagation();
          if (currentIndex < visibleIds.length - 1) {
            focusTreeItem(visibleIds[currentIndex + 1]);
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          if (currentIndex > 0) {
            focusTreeItem(visibleIds[currentIndex - 1]);
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          event.stopPropagation();
          if (isExpandable && !expandedItems.has(targetId)) {
            setExpandedItems(new Set(expandedItems).add(targetId));
          } else if (isExpandable && item.treeItems?.length) {
            focusTreeItem(item.treeItems[0].id);
          }
          break;
        case 'ArrowLeft': {
          event.preventDefault();
          event.stopPropagation();
          if (isExpandable && expandedItems.has(targetId)) {
            const next = new Set(expandedItems);
            next.delete(targetId);
            setExpandedItems(next);
          } else {
            const parentId = parentIdMap[targetId];
            if (parentId) {
              focusTreeItem(parentId);
            }
          }
          break;
        }
        case 'Enter':
        case ' ':
          event.preventDefault();
          event.stopPropagation();
          handleSelection(item);
          break;
        case 'Home':
          event.preventDefault();
          event.stopPropagation();
          if (visibleIds.length) {
            focusTreeItem(visibleIds[0]);
          }
          break;
        case 'End':
          event.preventDefault();
          event.stopPropagation();
          if (visibleIds.length) {
            focusTreeItem(visibleIds[visibleIds.length - 1]);
          }
          break;
        default:
          break;
      }
    }

    return (
      <div className={classNames('slds-tree_container', className)}>
        {header && (
          <h4 className="slds-tree__group-header" id="tree-heading">
            {header}
          </h4>
        )}
        {/* Composite-widget pattern: the ul delegates keyboard handling for its treeitem descendants */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <ul ref={ulRef} aria-labelledby="tree-heading" className="slds-tree" role="tree" onKeyDown={handleKeyDown}>
          {items.map((item) => (
            <TreeItem
              key={`0-${item.id}`}
              item={item}
              level={1}
              selectedItem={selectedItem}
              focusableItemId={focusableItemId}
              expandedItems={expandedItems}
              onSelected={handleSelection}
            />
          ))}
        </ul>
      </div>
    );
  },
);

export default Tree;

import { getFlattenedListItemsById } from '@jetstream/shared/ui-utils';
import { ListItem, Maybe } from '@jetstream/types';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { ComboboxProps } from './Combobox';
import ComboboxWithItems, { ComboboxWithItemsProps, ComboboxWithItemsRef } from './ComboboxWithItems';

export interface ComboboxWithDrillInItemsProps extends Pick<ComboboxWithItemsProps, 'selectedItemLabelFn' | 'selectedItemTitleFn'> {
  comboboxProps: ComboboxProps;
  items: ListItem[];
  selectedItemId?: string | null;
  /** Used as the heading in the dropdown when no items are selected. Will be pre-pended to child item labels */
  rootHeadingLabel?: string;
  /** Optional. If not provided, standard multi-word search will be used */
  filterFn?: (filter: string) => (value: unknown, index: number, array: unknown[]) => boolean;
  onSelected: (item: Maybe<ListItem>) => void;
  /** Parent component is in charge of loading items and adding items as drillInItems to this item */
  onLoadItems?: (item: ListItem) => Promise<ListItem[]>;
}

/**
 * Combobox that allows drill in for nested objects
 * This is primarily designed for fields, but could be used for other things
 *
 * Data Flow:
 * * Parent passes in the initial items and includes `isDrillInItem` on any items that have children
 * * If children already exist on the item, they will be used - otherwise onLoadItems will be called to fetch the children
 * * The parent just passes in the root items, and this component keeps track of the current items to show
 * * If the item is rendered the first time with selectedItemId, it will be used to determine what initial set of items will be displayed
 * * If user closes without selection after drilling in, the list will be reset to the top level
 *
 * Review `BulkUpdateFromQueryModal` for a reference implementation
 * You can utilize useFieldListItemsWithDrillIn() to handle the data fetching
 *
 * Baked in assumptions:
 * * The `id` of the item is the path to the item, separated by periods
 * * Root level items do not have a period in the id
 */
export const ComboboxWithDrillInItems: FunctionComponent<ComboboxWithDrillInItemsProps> = ({
  comboboxProps,
  items,
  selectedItemId,
  rootHeadingLabel,
  filterFn,
  onSelected,
  onLoadItems,
  ...rest
}) => {
  const comboboxRef = useRef<ComboboxWithItemsRef>(null);
  // Ref to keep track of selected item without re-rendering, used to know if should reset to top level on close if no selection
  const selectedItem = useRef<Maybe<ListItem>>(null);
  // Current visible items, will change based on drill in
  const [currentItems, setCurrentItems] = useState(items);
  // Map for quick lookup when user makes selection
  const [allItemsById, setAllItemsById] = useState<Record<string, ListItem>>({});
  // Used to determine which items to show and what heading to show
  const [activeItemId, setActiveItemId] = useState<string>(() => {
    if (!selectedItemId) {
      return '';
    }
    // The selected itemId includes, but the active item is the parent object
    return selectedItemId.split('.').slice(0, -1).join('.');
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAllItemsById(getFlattenedListItemsById(items));
  }, [items]);

  useEffect(() => {
    if (!activeItemId || !allItemsById[activeItemId]) {
      setCurrentItems(items);
    } else {
      setCurrentItems(allItemsById[activeItemId].childItems || []);
    }
  }, [activeItemId, allItemsById, items]);

  const handleSelection = useCallback(async (item: ListItem) => {
    if (!item.isDrillInItem) {
      onSelected(item);
      selectedItem.current = item;
      return;
    } else {
      comboboxRef.current?.clearSearchTerm();
      // see if we have items already, if so set them
      // otherwise call to parent to get the items
      if (item.childItems) {
        setCurrentItems(item.childItems);
        setActiveItemId(item.id);
      } else if (onLoadItems) {
        setLoading(true);
        const newItems = await onLoadItems(item);
        setCurrentItems(newItems);
        setActiveItemId(item.id);
        setLoading(false);
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    if (!selectedItem.current) {
      setCurrentItems(items);
      setActiveItemId('');
    }
  }, [items]);

  // Ensure loading state is set for drill-in items
  let comboboxPropsInternal = comboboxProps;
  if (loading) {
    comboboxPropsInternal = { ...comboboxProps, loading: true };
  }

  let heading: Maybe<ComboboxWithItemsProps['heading']> = undefined;
  if (activeItemId) {
    heading = {
      label: rootHeadingLabel ? `${rootHeadingLabel}.${activeItemId}` : activeItemId,
      actionLabel: 'Reset',
      onActionClick: () => {
        setCurrentItems(items);
        setActiveItemId('');
        onSelected(null);
        selectedItem.current = null;
        comboboxRef.current?.clearSearchTerm();
      },
    };
  } else if (rootHeadingLabel) {
    heading = { label: rootHeadingLabel };
  }

  return (
    <ComboboxWithItems
      ref={comboboxRef}
      comboboxProps={comboboxPropsInternal}
      heading={heading}
      items={currentItems}
      selectedItemId={selectedItemId}
      filterFn={filterFn}
      onSelected={handleSelection}
      onClose={handleClose}
      {...rest}
    />
  );
};

export default ComboboxWithDrillInItems;

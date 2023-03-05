import { useDebounce } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { ListItem, Maybe } from '@jetstream/types';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Combobox, ComboboxProps, ComboboxPropsRef } from './Combobox';
import { ComboboxListVirtual } from './ComboboxListVirtual';

const defaultFilterFn = (filter) => multiWordObjectFilter<ListItem<string, any>>(['label', 'value'], filter);
const defaultSelectedItemLabelFn = (item: ListItem) => item.label;
const defaultSelectedItemTitleFn = (item: ListItem) => item.title;

export interface ComboboxWithItemsVirtualProps {
  comboboxProps: Omit<ComboboxProps, 'selectedItemLabel' | 'selectedItemTitle' | 'onInputChange' | 'onInputEnter'>;
  /** For groups, set isGroup: true on an item */
  items: ListItem[];
  selectedItemId?: string | null;
  /** Optional. If not provided, standard multi-word search will be used */
  filterFn?: (filter: string) => (value: unknown, index: number, array: unknown[]) => boolean;
  /** Used to customize what shows upon selection */
  selectedItemLabelFn?: (item: ListItem) => string;
  selectedItemTitleFn?: (item: ListItem) => string;
  onSelected: (item: ListItem) => void;
}

/**
 * Combobox wrapper to simplify the creation of a combobox
 * This allow text filtering/search with a simple picklist like interaction
 *
 * Does not support groups
 * TODO: create ComboboxWithGroups component
 */
export const ComboboxWithItemsVirtual: FunctionComponent<ComboboxWithItemsVirtualProps> = ({
  comboboxProps,
  items,
  selectedItemId,
  filterFn = defaultFilterFn,
  selectedItemLabelFn = defaultSelectedItemLabelFn,
  selectedItemTitleFn = defaultSelectedItemTitleFn,
  onSelected,
}) => {
  const comboboxRef = useRef<ComboboxPropsRef>();
  const [popoverContainerRef, setPopoverContainerRef] = useState<HTMLDivElement | null>(null);
  const [filterTextNonDebounced, setFilterText] = useState<string>('');
  const filterText = useDebounce(filterTextNonDebounced, 300);
  const [selectedItem, setSelectedItem] = useState<Maybe<ListItem>>(() =>
    selectedItemId ? items.find((item) => item.id === selectedItemId) : null
  );
  const [visibleItems, setVisibleItems] = useState(items);
  const [selectedItemLabel, setSelectedItemLabel] = useState<string | null>(() => {
    if (selectedItem) {
      const selectedItem = items.find((item) => item.id === selectedItemId);
      return selectedItem ? selectedItemLabelFn(selectedItem) : null;
    }
    return null;
  });
  const [selectedItemTitle, setSelectedItemTitle] = useState<string | null>(() => {
    if (selectedItem) {
      const selectedItem = items.find((item) => item.id === selectedItemId);
      return selectedItem ? selectedItemLabelFn(selectedItem) : null;
    }
    return null;
  });

  useEffect(() => {
    if (selectedItemId) {
      setSelectedItem(items.find((item) => item.id === selectedItemId));
    } else {
      setSelectedItem(null);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    if (selectedItem) {
      setSelectedItemLabel(selectedItemLabelFn(selectedItem));
      setSelectedItemTitle(selectedItemTitleFn(selectedItem) || '');
    } else {
      setSelectedItemLabel(null);
      setSelectedItemTitle(null);
    }
  }, [selectedItem, selectedItemLabelFn, selectedItemTitleFn]);

  useEffect(() => {
    if (!filterText) {
      setVisibleItems(items);
    } else {
      const filter = filterText.toLowerCase().trim();
      setVisibleItems(items.filter(filterFn(filter)));
    }
  }, [items, filterText, filterFn]);

  const onInputEnter = useCallback(() => {
    if (visibleItems.length > 0) {
      onSelected(visibleItems[0]);
    }
  }, [onSelected, visibleItems]);

  return (
    <Combobox
      ref={comboboxRef}
      {...comboboxProps}
      selectedItemLabel={selectedItemLabel}
      selectedItemTitle={selectedItemTitle}
      onInputChange={setFilterText}
      onInputEnter={onInputEnter}
    >
      {/* <ComboboxListVirtual
        items={visibleItems}
        parentRef={comboboxRef.current?.getPopoverRef() || null}
        // getScrollElement={() => {
        //   console.log('comboboxRef.current', comboboxRef.current?.getPopoverRef());
        //   return comboboxRef.current?.getPopoverRef();
        // }}
        selectedItem={selectedItem}
        onSelected={onSelected}
      /> */}
      {comboboxRef.current?.getPopoverRef() ? (
        <ComboboxListVirtual
          items={visibleItems}
          parentRef={comboboxRef.current?.getPopoverRef() || null}
          // getScrollElement={() => {
          //   console.log('comboboxRef.current', comboboxRef.current?.getPopoverRef());
          //   return comboboxRef.current?.getPopoverRef();
          // }}
          selectedItem={selectedItem}
          onSelected={onSelected}
        />
      ) : (
        <></>
      )}
    </Combobox>
  );
};

export default ComboboxWithItemsVirtual;

import { getFlattenedListItemsById, useDebounce } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { ListItem, Maybe } from '@jetstream/types';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Combobox, ComboboxProps, ComboboxPropsRef } from './Combobox';
import { ComboboxListItem } from './ComboboxListItem';
import { ComboboxListItemHeading } from './ComboboxListItemHeading';

const defaultFilterFn = (filter) => multiWordObjectFilter<ListItem<string, any>>(['label', 'value'], filter);
const defaultSelectedItemLabelFn = (item: ListItem) => item.label;
const defaultSelectedItemTitleFn = (item: ListItem) => item.title;

export interface ComboboxWithItemsRef {
  clearSearchTerm: () => void;
}

export interface ComboboxWithItemsProps {
  comboboxProps: ComboboxProps;
  items: ListItem[];
  selectedItemId?: string | null;
  /** Heading for list (just like grouped items) */
  heading?: {
    label: string;
    actionLabel?: string;
    onActionClick?: () => void;
  };
  /** Optional. If not provided, standard multi-word search will be used */
  filterFn?: (filter: string) => (value: unknown, index: number, array: unknown[]) => boolean;
  /** Used to customize what shows upon selection */
  selectedItemLabelFn?: (item: ListItem) => string;
  selectedItemTitleFn?: (item: ListItem) => Maybe<string>;
  onSelected: (item: ListItem) => void;
  onClose?: () => void;
}

/**
 * Combobox wrapper to simplify the creation of a combobox
 * This allow text filtering/search with a simple picklist like interaction
 *
 * Does not support groups
 * TODO: create ComboboxWithGroups component
 */
export const ComboboxWithItems = forwardRef<ComboboxWithItemsRef, ComboboxWithItemsProps>(
  (
    {
      comboboxProps,
      items,
      selectedItemId,
      heading,
      filterFn = defaultFilterFn,
      selectedItemLabelFn = defaultSelectedItemLabelFn,
      selectedItemTitleFn = defaultSelectedItemTitleFn,
      onSelected,
      onClose,
    },
    ref
  ) => {
    const comboboxRef = useRef<ComboboxPropsRef>(null);
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

    useImperativeHandle<unknown, ComboboxWithItemsRef>(
      ref,
      () => ({
        clearSearchTerm: () => {
          setFilterText('');
          comboboxRef.current?.clearInputText();
        },
      }),
      []
    );

    useEffect(() => {
      if (selectedItemId) {
        setSelectedItem(getFlattenedListItemsById(items)[selectedItemId]);
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
        onClose={onClose}
      >
        {heading && (
          <ComboboxListItemHeading label={heading.label} actionLabel={heading.actionLabel} onActionClick={heading.onActionClick} />
        )}
        {visibleItems.map((item) => (
          <ComboboxListItem
            key={item.id}
            id={item.id}
            label={item.label}
            secondaryLabel={item.secondaryLabel}
            secondaryLabelOnNewLine={item.secondaryLabelOnNewLine}
            isDrillInItem={item.isDrillInItem}
            selected={item === selectedItem}
            onSelection={(id) => {
              onSelected(item);
              if (!item.isDrillInItem) {
                comboboxRef.current?.close();
                onClose && onClose();
              }
            }}
          />
        ))}
      </Combobox>
    );
  }
);

export default ComboboxWithItems;

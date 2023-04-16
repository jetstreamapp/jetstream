import { css } from '@emotion/react';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, NOOP } from '@jetstream/shared/utils';
import { ListItem, Maybe } from '@jetstream/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import isNumber from 'lodash/isNumber';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Combobox, ComboboxPropsRef, ComboboxSharedProps } from './Combobox';
import { ComboboxListItem } from './ComboboxListItem';

const defaultFilterFn = (filter) => multiWordObjectFilter<ListItem<string, any>>(['label', 'value'], filter);
const defaultSelectedItemLabelFn = (item: ListItem) => item.label;
const defaultSelectedItemTitleFn = (item: ListItem) => item.title;

export interface ComboboxWithItemsVirtualProps {
  comboboxProps: Omit<ComboboxSharedProps, 'onInputChange' | 'onInputEnter'>;
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
 * Combobox with virtualized list of items
 * Groups are supported but only using a flat list of ListItems with the isGroup=true property
 * You can use getFlattenedListItems to handle this
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
  const comboboxRef = useRef<ComboboxPropsRef>(null);
  const [filterTextNonDebounced, setFilterText] = useState<string>('');
  const filterText = useDebounce(filterTextNonDebounced, 300);
  const [selectedItem, setSelectedItem] = useState<Maybe<ListItem>>(() =>
    selectedItemId ? items.find((item) => item.id === selectedItemId) : null
  );
  const [visibleItems, setVisibleItems] = useState(items);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
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

  const rowVirtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => comboboxRef.current?.getRefs().popoverRef.current || null,
    estimateSize: (index: number) => {
      const item = visibleItems[index];
      if (item.isGroup) {
        return 37;
      }
      return item.secondaryLabelOnNewLine && item.secondaryLabel ? 50 : 36;
    },
  });

  const handleSelection = useCallback(
    (value: ListItem) => {
      onSelected(value);
      setFocusedIndex(null);
      comboboxRef?.current?.close();
    },
    [onSelected]
  );

  // ensure that focused item is removed if user types something
  useEffect(() => {
    setFocusedIndex(null);
  }, [filterTextNonDebounced]);

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

      // Since data coming in is flat, ensure that groups with items stay in the list
      let visibleItemsAndGroups = items.filter((item, index, array) => item.isGroup || filterFn(filter)(item, index, array));
      const visibleGroups = new Set(visibleItemsAndGroups.map((item) => item.group?.id).filter(Boolean));
      visibleItemsAndGroups = visibleItemsAndGroups.filter((item) => !item.isGroup || (item.isGroup && visibleGroups.has(item.id)));

      setVisibleItems(visibleItemsAndGroups);
    }
  }, [items, filterText, filterFn]);

  // FIXME: scroll on open
  // TODO: if combobox is open, scroll to selected item - combobx can return fn as child optionally in this case

  const handleKeyboardNavigation = (action: 'up' | 'down' | 'enter') => {
    if (visibleItems.length <= 1) {
      return;
    }
    let tempFocusedIndex = focusedIndex;
    const maxIndex = visibleItems.length - 1;
    switch (action) {
      case 'down': {
        if (tempFocusedIndex == null) {
          tempFocusedIndex = 0;
        }
        tempFocusedIndex++;
        break;
      }
      case 'up': {
        if (tempFocusedIndex == null) {
          tempFocusedIndex = maxIndex;
        }
        tempFocusedIndex--;
        break;
      }
      case 'enter': {
        if (isNumber(tempFocusedIndex)) {
          tempFocusedIndex = null;
          setFocusedIndex(tempFocusedIndex);
        }
        isNumber(focusedIndex) && handleSelection(visibleItems[focusedIndex]);
        return;
      }
      default:
        break;
    }

    if (isNumber(tempFocusedIndex)) {
      let count = 0;
      while (visibleItems[tempFocusedIndex]?.isGroup || tempFocusedIndex < 0 || tempFocusedIndex > maxIndex) {
        // wrap if needed
        if (tempFocusedIndex < 0) {
          // set to max item
          tempFocusedIndex = maxIndex;
        } else if (tempFocusedIndex > maxIndex) {
          // if > max item
          tempFocusedIndex = 0;
        }
        // Ensure we don't land on group
        if (visibleItems[tempFocusedIndex]?.isGroup) {
          action === 'up' ? tempFocusedIndex-- : tempFocusedIndex++;
        }
        count++;
        // should only take a couple iterations to correct - break otherwise to avoid infinite loop
        if (count > 3) {
          break;
        }
      }
      // TODO: need to focus on element - maybe we can send prop to child to auto-focus
      rowVirtualizer.scrollToIndex(tempFocusedIndex, { behavior: 'auto', align: 'auto' });
    }
    if (tempFocusedIndex !== focusedIndex) {
      setFocusedIndex(tempFocusedIndex);
    }
  };

  const onInputEnter = useCallback(() => {
    const firstItem = visibleItems.find((item) => !item.isGroup);
    if (firstItem) {
      handleSelection(firstItem);
    }
  }, [handleSelection, visibleItems]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <Combobox
      ref={comboboxRef}
      {...comboboxProps}
      selectedItemLabel={selectedItemLabel}
      selectedItemTitle={selectedItemTitle}
      isVirtual
      onInputChange={setFilterText}
      onInputEnter={onInputEnter}
      onKeyboardNavigation={handleKeyboardNavigation}
    >
      <ul
        className="slds-listbox slds-listbox_vertical"
        role="group"
        css={css`
          height: ${rowVirtualizer.getTotalSize() || 36}px;
          width: 100%;
          position: relative;
        `}
      >
        {virtualItems.length === 0 && (
          <ComboboxListItem
            containerCss={css`
              position: absolute;
              top: 0;
              left: 0;
              width: 99%;
              height: 36px;
            `}
            id="placeholder"
            placeholder
            label="There are no items for selection"
            selected={false}
            onSelection={NOOP}
          />
        )}
        {virtualItems.map((virtualItem) => {
          const item = visibleItems[virtualItem.index];

          const styles = css`
            position: absolute;
            top: 0;
            left: 0;
            width: 99%;
            height: ${virtualItem.size}px;
            transform: translateY(${virtualItem.start}px);
          `;

          return item.isGroup ? (
            <li key={item.id} data-type="group" role="presentation" className="slds-listbox__item" css={styles}>
              <div className="slds-media slds-listbox__option slds-listbox__option_plain slds-media_small" role="presentation">
                <h3 className="slds-listbox__option-header" role="presentation">
                  {item.label}
                </h3>
              </div>
            </li>
          ) : (
            <ComboboxListItem
              key={item.id}
              id={item.id}
              containerCss={styles}
              label={item.label}
              secondaryLabel={item.secondaryLabel}
              secondaryLabelOnNewLine={item.secondaryLabelOnNewLine}
              selected={item.id === selectedItem?.id}
              focused={virtualItem.index === focusedIndex}
              onSelection={() => {
                handleSelection(item);
              }}
            />
          );
        })}
      </ul>
    </Combobox>
  );
};

export default ComboboxWithItemsVirtual;

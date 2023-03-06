import { css } from '@emotion/react';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, NOOP } from '@jetstream/shared/utils';
import { ListItem, Maybe } from '@jetstream/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Combobox, ComboboxProps, ComboboxPropsRef } from './Combobox';
import { ComboboxListItem } from './ComboboxListItem';

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
    getScrollElement: () => comboboxRef.current?.getPopoverRef() || null,
    estimateSize: (index: number) => {
      const item = visibleItems[index];
      if (item.isGroup) {
        return 37;
      }
      return item.secondaryLabelOnNewLine && item.secondaryLabel ? 53 : 36;
    },
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

      // Since data coming in is flat, ensure that groups with items stay in the list
      let visibleItemsAndGroups = items.filter((item, index, array) => item.isGroup || filterFn(filter)(item, index, array));
      const visibleGroups = new Set(visibleItemsAndGroups.map((item) => item.group?.id).filter(Boolean));
      visibleItemsAndGroups = visibleItemsAndGroups.filter((item) => !item.isGroup || (item.isGroup && visibleGroups.has(item.id)));

      setVisibleItems(visibleItemsAndGroups);
    }
  }, [items, filterText, filterFn]);

  const onInputEnter = useCallback(() => {
    const firstItem = visibleItems.find((item) => !item.isGroup);
    if (firstItem) {
      onSelected(firstItem);
    }
  }, [onSelected, visibleItems]);

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
            <li key={item.id} role="presentation" className="slds-listbox__item slds-item" css={styles}>
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
              onSelection={() => {
                onSelected(item);
              }}
            />
          );
        })}
      </ul>
    </Combobox>
  );
};

export default ComboboxWithItemsVirtual;

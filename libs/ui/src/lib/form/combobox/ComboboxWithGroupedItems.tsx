import { focusElementFromRefWhenAvailable, getFlattenedListItemsById, menuItemSelectScroll, useDebounce } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, NOOP } from '@jetstream/shared/utils';
import { ListItem, ListItemGroup, Maybe } from '@jetstream/types';
import isNumber from 'lodash/isNumber';
import { createRef, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Combobox, ComboboxPropsRef, ComboboxSharedProps } from './Combobox';
import { ComboboxListItem, ComboboxListItemProps } from './ComboboxListItem';
import { ComboboxListItemGroup } from './ComboboxListItemGroup';

const defaultFilterFn = (filter) => multiWordObjectFilter<ListItem<string, any>>(['label', 'value'], filter);
const defaultGroupFilterFn = (filter) => multiWordObjectFilter<ListItemGroup>(['label'], filter);
const defaultSelectedItemLabelFn = (item: ListItem) => item.label;
const defaultSelectedItemTitleFn = (item: ListItem) => item.title;

export interface ComboboxWithGroupedItemsRef {
  clearSearchTerm: () => void;
}

export interface ComboboxWithGroupedItemsProps {
  comboboxProps: ComboboxSharedProps;
  groups: ListItemGroup[];
  selectedItemId?: string | null;
  /**
   * Show all items in a group if the group label matches the filter text
   * default: true
   */
  allowGroupToMatchFilterText?: boolean;
  /** Function called for each item to customize the props of <ComboboxListItem /> */
  itemProps?: (item: ListItem) => Partial<ComboboxListItemProps>;
  /**
   * Optional. If not provided, standard multi-word search will be used
   * only applies if allowGroupToMatchFilterText is true
   */
  groupFilterFn?: (filter: string) => (value: unknown, index: number, array: unknown[]) => boolean;
  /** Optional. If not provided, standard multi-word search will be used */
  filterFn?: (filter: string) => (value: unknown, index: number, array: unknown[]) => boolean;
  /** Used to customize what shows upon selection */
  selectedItemLabelFn?: (item: ListItem) => string;
  selectedItemTitleFn?: (item: ListItem) => Maybe<string>;
  onSelected: (item: ListItem) => void;
  onClose?: () => void;
}

/**
 * Combobox wrapper for groups to simplify the creation of a combobox
 * This allow text filtering/search with a simple picklist like interaction
 */
export const ComboboxWithGroupedItems = forwardRef<ComboboxWithGroupedItemsRef, ComboboxWithGroupedItemsProps>(
  (
    {
      comboboxProps,
      groups,
      selectedItemId,
      allowGroupToMatchFilterText = true,
      itemProps = NOOP,
      groupFilterFn = defaultGroupFilterFn,
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
      selectedItemId ? groups.flatMap((group) => group.items).find((item) => item.id === selectedItemId) : null
    );
    const [visibleItems, setVisibleItems] = useState(groups);
    const [selectedItemLabel, setSelectedItemLabel] = useState<string | null>(() => {
      if (selectedItem) {
        const selectedItem = groups.flatMap((group) => group.items).find((item) => item.id === selectedItemId);
        return selectedItem ? selectedItemLabelFn(selectedItem) : null;
      }
      return null;
    });
    const [selectedItemTitle, setSelectedItemTitle] = useState<string | null>(() => {
      if (selectedItem) {
        const selectedItem = groups.flatMap((group) => group.items).find((item) => item.id === selectedItemId);
        return selectedItem ? selectedItemLabelFn(selectedItem) : null;
      }
      return null;
    });
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const refs = visibleItems.flatMap((group) => group.items).map((value) => createRef<HTMLLIElement>());

    useImperativeHandle<unknown, ComboboxWithGroupedItemsRef>(
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
        setSelectedItem(getFlattenedListItemsById(groups.flatMap((group) => group.items))[selectedItemId]);
      } else {
        setSelectedItem(null);
      }
    }, [groups, selectedItemId]);

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
        setVisibleItems(groups);
        setFocusedIndex(null);
      } else {
        const filter = filterText.toLowerCase().trim();
        setVisibleItems(
          groups
            .map((group) => {
              const isGroupMatch = [group].filter(groupFilterFn(filter)).length > 0;
              return allowGroupToMatchFilterText && isGroupMatch
                ? { ...group, items: group.items } // keep all items if the group label matches the filter text
                : { ...group, items: group.items.filter(filterFn(filter)) };
            })
            .filter((group) => group.items.length > 0)
        );
        setFocusedIndex(null);
      }
    }, [groups, filterText, filterFn, groupFilterFn, allowGroupToMatchFilterText]);

    const onInputEnter = useCallback(() => {
      const items = visibleItems.flatMap((group) => group.items);
      if (items.length > 0) {
        onSelected(items[0]);
      }
    }, [onSelected, visibleItems]);

    const handleKeyboardNavigation = (action: 'up' | 'down' | 'right' | 'enter') => {
      // if loading, items may not be ready yet and when they are ready it can cause issues with navigation
      if (comboboxProps?.loading) {
        return;
      }
      const items = visibleItems.flatMap((group) => group.items);
      let tempFocusedIndex = focusedIndex;
      const maxIndex = items.length - 1;
      switch (action) {
        case 'down': {
          if (tempFocusedIndex == null) {
            tempFocusedIndex = 0;
          } else {
            tempFocusedIndex++;
          }
          break;
        }
        case 'up': {
          if (tempFocusedIndex == null) {
            tempFocusedIndex = maxIndex;
          } else {
            tempFocusedIndex--;
          }
          break;
        }
        // Right drills-in
        case 'right': {
          if (isNumber(focusedIndex) && items[focusedIndex].isDrillInItem) {
            const item = items[focusedIndex];
            onSelected(item);
            setFocusedIndex(null);
            if (comboboxRef.current?.getRefs().inputEl) {
              // if focused too fast, then the input will get the keydown event and select the first item
              setTimeout(() => {
                focusElementFromRefWhenAvailable(comboboxRef.current?.getRefs().inputEl);
              }, 50);
            }
          }

          break;
        }
        case 'enter': {
          if (isNumber(tempFocusedIndex)) {
            tempFocusedIndex = null;
            setFocusedIndex(tempFocusedIndex);
          }
          if (isNumber(focusedIndex)) {
            const item = items[focusedIndex];
            onSelected(item);
            setFocusedIndex(null);
            if (item.isDrillInItem) {
              if (comboboxRef.current?.getRefs().inputEl) {
                // if focused too fast, then the input will get the keydown event and select the first item
                setTimeout(() => {
                  focusElementFromRefWhenAvailable(comboboxRef.current?.getRefs().inputEl);
                }, 50);
              }
            } else {
              comboboxRef.current?.close();
              onClose && onClose();
            }
            return;
          }
          break;
        }
        default:
          break;
      }

      if (isNumber(tempFocusedIndex)) {
        if (tempFocusedIndex < 0) {
          // set to max item
          tempFocusedIndex = maxIndex;
        } else if (tempFocusedIndex > maxIndex) {
          // if > max item
          tempFocusedIndex = 0;
        }
        refs[tempFocusedIndex]?.current?.focus();
      }
      if (tempFocusedIndex !== focusedIndex) {
        setFocusedIndex(tempFocusedIndex);
      }
      const divContainerEl = comboboxRef.current?.getRefs().divContainerEl;
      if (divContainerEl?.current && isNumber(tempFocusedIndex)) {
        menuItemSelectScroll({
          container: divContainerEl.current,
          focusedIndex: tempFocusedIndex,
        });
      }
    };

    let counter = 0;

    return (
      <Combobox
        ref={comboboxRef}
        {...comboboxProps}
        hasGroups
        selectedItemLabel={selectedItemLabel}
        selectedItemTitle={selectedItemTitle}
        isEmpty={visibleItems.length === 0}
        onKeyboardNavigation={handleKeyboardNavigation}
        onInputChange={setFilterText}
        onInputEnter={onInputEnter}
        onClose={onClose}
      >
        {visibleItems.map((group, i) => (
          <ComboboxListItemGroup key={group.id} label={group.label}>
            {group.items.map((item, j) =>
              !item.customRenderer ? (
                <ComboboxListItem
                  key={item.id}
                  ref={refs[counter++]}
                  id={item.id}
                  label={item.label}
                  secondaryLabel={item.secondaryLabel}
                  secondaryLabelOnNewLine={item.secondaryLabelOnNewLine}
                  tertiaryLabel={item.tertiaryLabel}
                  isDrillInItem={item.isDrillInItem}
                  selected={item === selectedItem}
                  onSelection={(id) => {
                    onSelected(item);
                    if (!item.isDrillInItem) {
                      comboboxRef.current?.close();
                      onClose && onClose();
                    }
                  }}
                  {...itemProps(item)}
                />
              ) : (
                <ComboboxListItem
                  key={item.id}
                  ref={refs[counter++]}
                  id={item.id}
                  selected={item === selectedItem}
                  onSelection={(id) => {
                    onSelected(item);
                    if (!item.isDrillInItem) {
                      comboboxRef.current?.close();
                      onClose && onClose();
                    }
                  }}
                  {...itemProps(item)}
                >
                  {item.customRenderer(item)}
                </ComboboxListItem>
              )
            )}
          </ComboboxListItemGroup>
        ))}
      </Combobox>
    );
  }
);

export default ComboboxWithGroupedItems;

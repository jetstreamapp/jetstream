import {
  focusElementFromRefWhenAvailable,
  getFlattenedListItemsById,
  menuItemSelectScroll,
  useFuzzySearchFilter,
} from '@jetstream/shared/ui-utils';
import { NOOP } from '@jetstream/shared/utils';
import { ListItem, Maybe } from '@jetstream/types';
import isNumber from 'lodash/isNumber';
import { createRef, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Combobox, ComboboxPropsRef, ComboboxSharedProps } from './Combobox';
import { ComboboxListItem, ComboboxListItemProps } from './ComboboxListItem';
import { ComboboxListItemHeading } from './ComboboxListItemHeading';

const defaultSelectedItemLabelFn = (item: ListItem) => item.label;
const defaultSelectedItemTitleFn = (item: ListItem) => item.title;

export interface ComboboxWithItemsRef {
  clearSearchTerm: () => void;
}

export interface ComboboxWithItemsProps {
  comboboxProps: ComboboxSharedProps;
  items: ListItem[];
  selectedItemId?: string | null;
  /** Heading for list (just like grouped items) */
  heading?: {
    label: string;
    actionLabel?: string;
    onActionClick?: () => void;
  };
  /** Function called for each item to customize the props of <ComboboxListItem /> */
  itemProps?: (item: ListItem) => Partial<ComboboxListItemProps>;
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
 */
export const ComboboxWithItems = forwardRef<ComboboxWithItemsRef, ComboboxWithItemsProps>(
  (
    {
      comboboxProps,
      items,
      selectedItemId,
      heading,
      itemProps = NOOP,
      selectedItemLabelFn = defaultSelectedItemLabelFn,
      selectedItemTitleFn = defaultSelectedItemTitleFn,
      onSelected,
      onClose,
    },
    ref
  ) => {
    const comboboxRef = useRef<ComboboxPropsRef>(null);
    const [filterText, setFilterText] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<Maybe<ListItem>>(() =>
      selectedItemId ? items.find((item) => item.id === selectedItemId) : null
    );
    const visibleItems = useFuzzySearchFilter(items, filterText);
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
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const refs = visibleItems.map((value) => createRef<HTMLLIElement>());

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

    const onInputEnter = useCallback(() => {
      if (visibleItems.length > 0) {
        onSelected(visibleItems[0]);
      }
    }, [onSelected, visibleItems]);

    const handleKeyboardNavigation = (action: 'up' | 'down' | 'right' | 'enter') => {
      // if loading, items may not be ready yet and when they are ready it can cause issues with navigation
      if (comboboxProps?.loading) {
        return;
      }
      let tempFocusedIndex = focusedIndex;
      const maxIndex = visibleItems.length - 1;
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
          if (isNumber(focusedIndex) && visibleItems[focusedIndex].isDrillInItem) {
            const item = visibleItems[focusedIndex];
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
            const item = visibleItems[focusedIndex];
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

    function handleHeadingClick() {
      heading?.onActionClick && heading.onActionClick();
      // Ensure next cycle so that input does not get keyup event
      setTimeout(() => {
        focusElementFromRefWhenAvailable(comboboxRef.current?.getRefs().inputEl);
      }, 50);
    }

    return (
      <Combobox
        ref={comboboxRef}
        {...comboboxProps}
        selectedItemLabel={selectedItemLabel}
        selectedItemTitle={selectedItemTitle}
        isEmpty={visibleItems.length === 0}
        onKeyboardNavigation={handleKeyboardNavigation}
        onInputChange={setFilterText}
        onInputEnter={onInputEnter}
        onClose={onClose}
      >
        {heading && <ComboboxListItemHeading label={heading.label} actionLabel={heading.actionLabel} onActionClick={handleHeadingClick} />}
        {visibleItems.map((item, i) =>
          !item.customRenderer ? (
            <ComboboxListItem
              key={item.id}
              ref={refs[i]}
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
              ref={refs[i]}
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
      </Combobox>
    );
  }
);

export default ComboboxWithItems;

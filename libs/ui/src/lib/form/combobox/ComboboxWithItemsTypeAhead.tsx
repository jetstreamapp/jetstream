import { menuItemSelectScroll, useDebounce } from '@jetstream/shared/ui-utils';
import { ListItem, Maybe } from '@jetstream/types';
import isNumber from 'lodash/isNumber';
import { createRef, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Combobox, ComboboxPropsRef, ComboboxSharedProps } from './Combobox';
import { ComboboxListItem } from './ComboboxListItem';

const defaultSelectedItemLabelFn = (item: ListItem) => item.label;
const defaultSelectedItemTitleFn = (item: ListItem) => item.title;

export interface ComboboxWithItemsTypeAheadProps {
  comboboxProps: ComboboxSharedProps;
  items: ListItem[];
  selectedItemId: Maybe<string>;
  /** called when search filter changes to fetch new items */
  onSearch: (filter: string) => Promise<void>;
  /** Used to customize what shows upon selection */
  selectedItemLabelFn?: (item: ListItem) => string;
  selectedItemTitleFn?: (item: ListItem) => string;
  onSelected: (item: ListItem | null) => void;
  onClose?: () => void;
}

export const ComboboxWithItemsTypeAhead: FunctionComponent<ComboboxWithItemsTypeAheadProps> = ({
  comboboxProps,
  items,
  selectedItemId,
  onSearch,
  selectedItemLabelFn = defaultSelectedItemLabelFn,
  selectedItemTitleFn = defaultSelectedItemTitleFn,
  onSelected,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const comboboxRef = useRef<ComboboxPropsRef>(null);
  const [filterTextNonDebounced, setFilterText] = useState<string>('');
  const filterText = useDebounce(filterTextNonDebounced, 300);
  const [selectedItem, setSelectedItem] = useState<Maybe<ListItem>>(() =>
    selectedItemId ? items.find((item) => item.id === selectedItemId) : null
  );
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
  const refs = items.map((value) => createRef<HTMLLIElement>());

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
    setLoading(true);
    setFocusedIndex(null);
    onSearch(filterText)
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [filterText, onSearch]);

  const onInputEnter = useCallback(() => {
    if (items.length > 0) {
      onSelected(items[0]);
    }
  }, [onSelected, items]);

  function handleClear() {
    onSelected(null);
    onSearch('')
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }

  const handleKeyboardNavigation = (action: 'up' | 'down' | 'right' | 'enter') => {
    // if loading, items may not be ready yet and when they are ready it can cause issues with navigation
    if (comboboxProps?.loading) {
      return;
    }
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
      case 'enter': {
        if (isNumber(tempFocusedIndex)) {
          tempFocusedIndex = null;
          setFocusedIndex(tempFocusedIndex);
        }
        if (isNumber(focusedIndex)) {
          const item = items[focusedIndex];
          onSelected(item);
          setFocusedIndex(null);
          comboboxRef.current?.close();
          onClose && onClose();
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

  return (
    <Combobox
      ref={comboboxRef}
      {...comboboxProps}
      loading={loading}
      selectedItemLabel={selectedItemLabel}
      selectedItemTitle={selectedItemTitle}
      onKeyboardNavigation={handleKeyboardNavigation}
      onFilterInputChange={setFilterText}
      onInputEnter={onInputEnter}
      onClear={handleClear}
      showSelectionAsButton
    >
      {items.map((item, i) => (
        <ComboboxListItem
          key={item.id}
          ref={refs[i]}
          id={item.id}
          label={item.label}
          secondaryLabel={item.secondaryLabel}
          secondaryLabelOnNewLine={item.secondaryLabelOnNewLine}
          selected={item === selectedItem}
          onSelection={(id) => {
            onSelected(item);
            comboboxRef.current?.close();
          }}
        />
      ))}
    </Combobox>
  );
};

export default ComboboxWithItemsTypeAhead;

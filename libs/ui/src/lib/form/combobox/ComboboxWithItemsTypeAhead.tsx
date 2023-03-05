import { useDebounce } from '@jetstream/shared/ui-utils';
import { ListItem, Maybe } from '@jetstream/types';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Combobox, ComboboxProps, ComboboxPropsRef } from './Combobox';
import { ComboboxListItem } from './ComboboxListItem';

const defaultSelectedItemLabelFn = (item: ListItem) => item.label;
const defaultSelectedItemTitleFn = (item: ListItem) => item.title;

export interface ComboboxWithItemsTypeAheadProps {
  comboboxProps: ComboboxProps;
  items: ListItem[];
  selectedItemId: Maybe<string>;
  /** called when search filter changes to fetch new items */
  onSearch: (filter: string) => Promise<void>;
  /** Used to customize what shows upon selection */
  selectedItemLabelFn?: (item: ListItem) => string;
  selectedItemTitleFn?: (item: ListItem) => string;
  onSelected: (item: ListItem | null) => void;
}

export const ComboboxWithItemsTypeAhead: FunctionComponent<ComboboxWithItemsTypeAheadProps> = ({
  comboboxProps,
  items,
  selectedItemId,
  onSearch,
  selectedItemLabelFn = defaultSelectedItemLabelFn,
  selectedItemTitleFn = defaultSelectedItemTitleFn,
  onSelected,
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

  return (
    <Combobox
      ref={comboboxRef}
      {...comboboxProps}
      loading={loading}
      selectedItemLabel={selectedItemLabel}
      selectedItemTitle={selectedItemTitle}
      onFilterInputChange={setFilterText}
      onInputEnter={onInputEnter}
      onClear={handleClear}
      showSelectionAsButton
    >
      {items.map((item) => (
        <ComboboxListItem
          key={item.id}
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

import { FormGroupDropdownItem, ListItem } from '@jetstream/types';
import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import React from 'react';
import Combobox from './Combobox';
import { ComboboxListItem } from './ComboboxListItem';
import { ComboboxListItemGroup } from './ComboboxListItemGroup';
import { ComboboxListItemLoadMore } from './ComboboxListItemLoadMore';
import ComboboxWithItemsVirtual from './ComboboxWithItemsVirtual';

export default {
  component: Combobox,
  title: 'forms/Combobox',
};

export const base = () => (
  <Combobox label={text('label', 'My Combobox')} onInputChange={action('onInputChange')} isRequired={boolean('isRequired', true)}>
    <ComboboxListItem id="item1" label="Item 1" secondaryLabel="secondary label" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item2" label="Item 2" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item3" label="Item 3" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item4" label="Item 4" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item5" label="Item 5" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item6" label="Item 6" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item7" label="Item 7" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item8" label="Item 8" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item9" label="Item 9" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item10" label="Item 10" selected={false} onSelection={action('selected')} />
  </Combobox>
);

export const customContent = () => (
  <Combobox label={text('label', 'My Combobox')} onInputChange={action('onInputChange')}>
    <ComboboxListItem id="item10" label="Item 10" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item1" selected={false} onSelection={action('selected')}>
      <span className="slds-listbox__option-text slds-listbox__option-text_entity">
        <span title="AccountNumber" className="slds-truncate">
          Account Number
        </span>
      </span>
      <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">
        <span title="Account Number" className="slds-truncate">
          AccountNumber
        </span>
      </span>
    </ComboboxListItem>
    <ComboboxListItem id="item2" selected={false} onSelection={action('selected')}>
      <span className="slds-listbox__option-text slds-listbox__option-text_entity">
        <span title="AccountNumber" className="slds-truncate">
          Account Number
        </span>
      </span>
      <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">
        <span title="Account Number" className="slds-truncate">
          AccountNumber
        </span>
      </span>
    </ComboboxListItem>
  </Combobox>
);

export const withGroup = () => (
  <Combobox label={text('label', 'My Combobox')} onInputChange={action('onInputChange')}>
    <ComboboxListItemGroup label="Group 1">
      <ComboboxListItem id="item1" label="Item 1" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item2" label="Item 2" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item3" label="Item 3" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item4" label="Item 4" selected={false} onSelection={action('selected')} />
    </ComboboxListItemGroup>
    <ComboboxListItemGroup label="Group 2">
      <ComboboxListItem id="item5" label="Item 5" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item6" label="Item 6" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item7" label="Item 7" selected={false} onSelection={action('selected')} />
    </ComboboxListItemGroup>
    <ComboboxListItemGroup label="Group 3">
      <ComboboxListItem id="item8" label="Item 8" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item9" label="Item 9" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item10" label="Item 10" selected={false} onSelection={action('selected')} />
    </ComboboxListItemGroup>
  </Combobox>
);

export const withDropdownGroup = () => (
  <Combobox
    label={text('label', 'My Combobox')}
    onInputChange={action('onInputChange')}
    leadingDropdown={{
      label: 'Leading Group',
      items: [
        { id: '1', label: 'Item 1' },
        { id: '2', label: 'Item 2' },
      ],
    }}
  >
    <ComboboxListItemGroup label="Group 1">
      <ComboboxListItem id="item1" label="Item 1" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item2" label="Item 2" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item3" label="Item 3" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item4" label="Item 4" selected={false} onSelection={action('selected')} />
    </ComboboxListItemGroup>
    <ComboboxListItemGroup label="Group 2">
      <ComboboxListItem id="item5" label="Item 5" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item6" label="Item 6" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item7" label="Item 7" selected={false} onSelection={action('selected')} />
    </ComboboxListItemGroup>
    <ComboboxListItemGroup label="Group 3">
      <ComboboxListItem id="item8" label="Item 8" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item9" label="Item 9" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item10" label="Item 10" selected={false} onSelection={action('selected')} />
    </ComboboxListItemGroup>
  </Combobox>
);

export const selectedItem = () => (
  <Combobox label={text('label', 'My Combobox')} selectedItemLabel="Item 2" onInputChange={action('onInputChange')}>
    <ComboboxListItem id="item1" label="Item 1" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item2" label="Item 2" selected onSelection={action('selected')} />
    <ComboboxListItem id="item3" label="Item 3" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item4" label="Item 4" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item5" label="Item 5" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item6" label="Item 6" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item7" label="Item 7" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item8" label="Item 8" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item9" label="Item 9" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item10" label="Item 10" selected={false} onSelection={action('selected')} />
  </Combobox>
);

export const multipleSelections = () => (
  <Combobox label={text('label', 'My Combobox')} onInputChange={action('onInputChange')}>
    <ComboboxListItem id="item1" label="Item 1" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item2" label="Item 2" selected onSelection={action('selected')} />
    <ComboboxListItem id="item3" label="Item 3" selected onSelection={action('selected')} />
    <ComboboxListItem id="item4" label="Item 4" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item5" label="Item 5" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item6" label="Item 6" selected onSelection={action('selected')} />
    <ComboboxListItem id="item7" label="Item 7" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item8" label="Item 8" selected onSelection={action('selected')} />
    <ComboboxListItem id="item9" label="Item 9" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item10" label="Item 10" selected onSelection={action('selected')} />
  </Combobox>
);

export const loading = () => (
  <Combobox label={text('label', 'My Combobox')} loading onInputChange={action('onInputChange')}>
    <ComboboxListItem id="item1" label="Item 1" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item2" label="Item 2" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item3" label="Item 3" selected={false} onSelection={action('selected')} />
  </Combobox>
);

export const loadMore = () => (
  <Combobox label={text('label', 'My Combobox')} onInputChange={action('onInputChange')}>
    <ComboboxListItem id="item1" label="Item 1" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item2" label="Item 2" selected={false} onSelection={action('selected')} />
    <ComboboxListItem id="item3" label="Item 3" selected={false} onSelection={action('selected')} />
    <ComboboxListItemLoadMore />
  </Combobox>
);

export const leadingDropDown = () => {
  const items: FormGroupDropdownItem[] = [
    { id: 'apex', label: 'Apex', icon: { type: 'utility', icon: 'apex' } },
    { id: 'decisions', label: 'Decisions', icon: { type: 'utility', icon: 'signpost' } },
    { id: 'rules', label: 'Rules', icon: { type: 'utility', icon: 'rules' } },
  ];
  return (
    <Combobox
      label={text('label', 'My Combobox')}
      onInputChange={action('onInputChange')}
      onLeadingDropdownChange={action('onLeadingDropdownChange')}
      leadingDropdown={{
        label: 'Additional Stuff!',
        items: items,
      }}
    >
      <ComboboxListItem id="item1" label="Item 1" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item2" label="Item 2" selected={false} onSelection={action('selected')} />
      <ComboboxListItem id="item3" label="Item 3" selected={false} onSelection={action('selected')} />
    </Combobox>
  );
};

export const virtualized = () => {
  const items: ListItem[] = new Array(50)
    .fill(50)
    .map((_, i) => ({ id: `${i}`, label: `Item ${i}`, value: `${i}`, isGroup: i === 0 || i === 15 }));
  return (
    <ComboboxWithItemsVirtual
      comboboxProps={{
        label: text('label', 'My Combobox'),
        labelHelp: text('label', 'Help text'),
        itemLength: 10,
      }}
      // selectedItemLabelFn={getSelectionLabel}
      // selectedItemId={selected.resource}
      items={items}
      onSelected={action('selected')}
    />
  );
};

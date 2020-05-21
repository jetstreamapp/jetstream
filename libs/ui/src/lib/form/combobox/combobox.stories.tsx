import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import React from 'react';
import Combobox from './Combobox';
import { ComboboxListItem } from './ComboboxListItem';
import { ComboboxListItemLoadMore } from './ComboboxListItemLoadMore';

export default {
  component: Combobox,
  title: 'Combobox',
};

export const base = () => (
  <Combobox label={text('label', 'My Combobox')} onInputChange={action('onInputChange')}>
    <ComboboxListItem id="item1" label="Item 1" selected={false} onSelection={action('selected')} />
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

export const selectedItem = () => (
  <Combobox label={text('label', 'My Combobox')} onInputChange={action('onInputChange')}>
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

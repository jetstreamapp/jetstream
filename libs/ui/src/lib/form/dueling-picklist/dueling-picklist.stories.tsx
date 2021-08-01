import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import React from 'react';
import DuelingPicklist from './DuelingPicklist';
import { DuelingPicklistItem } from './DuelingPicklistTypes';

export default {
  component: DuelingPicklist,
  title: 'DuelingPicklist',
};

const ITEMS: DuelingPicklistItem[] = [
  { label: 'Apples', value: 'item 1' },
  { label: 'Bananas', value: 'item 2' },
  { label: 'Pairs', value: 'item 3' },
  { label: 'Oranges', value: 'item 4' },
  { label: 'Rhubarb', value: 'item 5' },
];

export const base = () => (
  <DuelingPicklist
    label={text('label', 'Label')}
    hideLabel={boolean('hideLabel', false)}
    labelHelp={text('labelHelp', undefined)}
    isRequired={boolean('isRequired', false)}
    items={ITEMS}
    initialSelectedItems={['item 1']}
    labelLeft="Left Items"
    labelRight="Right Items"
    disabled={boolean('disabled', false)}
    omitReorder={boolean('omitReorder', false)}
    onChange={action('onChange')}
  ></DuelingPicklist>
);

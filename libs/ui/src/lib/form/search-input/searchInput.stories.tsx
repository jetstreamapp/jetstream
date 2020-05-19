import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React from 'react';
import SearchInput from './SearchInput';

export default {
  component: SearchInput,
  title: 'SearchInput',
};

export const base = () => (
  <SearchInput id={uniqueId('search')} placeholder={text('placeholder', 'Search for Items')} onChange={action('onChange')} />
);

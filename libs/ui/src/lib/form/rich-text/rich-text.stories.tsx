import { action } from '@storybook/addon-actions';
import { text, boolean } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React from 'react';
import RichText from './RichText';

export default {
  component: RichText,
  title: 'RichText',
};

export const base = () => {
  const id = uniqueId('select');
  return <RichText options={{}} onChange={action('onChange')}></RichText>;
};

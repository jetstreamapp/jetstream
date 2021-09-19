import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React from 'react';
import Textarea from './Textarea';

export default {
  component: Textarea,
  title: 'forms/Textarea',
};

export const base = () => (
  <Textarea id={uniqueId('search')} label={text('label', 'My Textarea')}>
    <textarea className="slds-textarea" rows={15} value={text('value', 'This is my fancy textarea')} onChange={action('onChange')} />
  </Textarea>
);

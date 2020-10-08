import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React from 'react';
import Select from './Select';

export default {
  component: Select,
  title: 'Select',
};

export const base = () => (
  <Select id={uniqueId('select')} label={text('label', 'My Select')}>
    <select className="slds-select" id="select-01">
      <option value="">Select…</option>
      <option>Option One</option>
      <option>Option Two</option>
      <option>Option Three</option>
    </select>
  </Select>
);

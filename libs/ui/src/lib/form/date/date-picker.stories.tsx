import React from 'react';
import DatePicker from './DatePicker';
import { action } from '@storybook/addon-actions';

export default {
  component: DatePicker,
  title: 'DatePicker',
};

export const datePicker = () => <DatePicker label="Date" onChange={action('onChange')} />;

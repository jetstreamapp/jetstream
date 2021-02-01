import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import { addYears } from 'date-fns';
import React from 'react';
import DatePicker from './DatePicker';

export default {
  component: DatePicker,
  title: 'DatePicker',
};

export const datePicker = () => <DatePicker label="Date" onChange={action('onChange')} />;

export const datePickerWithAllTheThings = () => (
  <DatePicker
    label="Date"
    hideLabel={boolean('hideLabel', false)}
    labelHelp={text('labelHelp', 'My fancy label help text')}
    helpText={text('helpText', 'My fancy help text')}
    isRequired={boolean('isRequired', false)}
    hasError={boolean('hasError', false)}
    errorMessageId="error-id-used-for-accessibility"
    errorMessage={text('errorMessage', 'Error Message')}
    disabled={boolean('disabled', false)}
    onChange={action('onChange')}
  />
);

export const datePickerWithLimitedDates = () => (
  <DatePicker
    label="Date"
    minAvailableDate={addYears(new Date(), -3)}
    maxAvailableDate={new Date()}
    labelHelp="No dates beyond today are allowed to be selected"
    helpText="No dates beyond today are allowed to be selected"
    isRequired={true}
    onChange={action('onChange')}
  />
);

export const beforeToday = () => (
  <DatePicker
    label="Date"
    maxAvailableDate={new Date()}
    labelHelp="No dates beyond today are allowed to be selected"
    helpText="No dates beyond today are allowed to be selected"
    isRequired={true}
    onChange={action('onChange')}
  />
);

import { action } from '@storybook/addon-actions';
import { boolean, number, select, text } from '@storybook/addon-knobs';
import React from 'react';
import TimePicker from './TimePicker';

export default {
  component: TimePicker,
  title: 'forms/TimePicker',
};

export const base = () => (
  <TimePicker
    stepInMinutes={number('stepInMinutes', 15)}
    label={text('label', 'Time')}
    placeholder="Select a time"
    labelHelp={text('labelHelp', 'Time input label help text')}
    helpText={text('helpText', 'Time input help')}
    isRequired={boolean('isRequired', false)}
    hasError={boolean('hasError', false)}
    errorMessageId="error-id-used-for-accessibility"
    errorMessage={text('errorMessage', 'Error Message')}
    scrollLength={select(
      'scrollLength',
      {
        Five: 5,
        Seven: 7,
        Ten: 10,
      },
      5
    )}
    onChange={action('onChange')}
  ></TimePicker>
);

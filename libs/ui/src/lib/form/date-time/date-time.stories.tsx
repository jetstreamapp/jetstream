import { action } from '@storybook/addon-actions';
import { boolean, number, select, text } from '@storybook/addon-knobs';
import React from 'react';
import DateTime from './DateTime';

export default {
  component: DateTime,
  title: 'DateTime',
};

export const base = () => (
  <DateTime
    legendLabel={text('legendLabel', 'Date and Time')}
    dateProps={{
      label: text('dateProps:label', 'Date'),
      hideLabel: boolean('dateProps:hideLabel', false),
      labelHelp: text('dateProps:labelHelp', 'My fancy label help text'),
      helpText: text('dateProps:helpText', 'My fancy help text'),
      isRequired: boolean('dateProps:isRequired', false),
      hasError: boolean('dateProps:hasError', false),
      errorMessageId: 'error-id-used-for-accessibility',
      errorMessage: text('dateProps:errorMessage', 'Error Message'),
      disabled: boolean('dateProps:disabled', false),
    }}
    timeProps={{
      stepInMinutes: number('timeProps:stepInMinutes', 15),
      label: text('timeProps:label', 'Time'),
      placeholder: 'Select a time',
      labelHelp: text('timeProps:labelHelp', 'Time input label help text'),
      helpText: text('timeProps:helpText', 'Time input help'),
      isRequired: boolean('timeProps:isRequired', false),
      hasError: boolean('timeProps:hasError', false),
      errorMessageId: 'error-id-used-for-accessibility-1',
      errorMessage: text('timeProps:errorMessage', 'Error Message'),
      scrollLength: select(
        'timeProps:scrollLength',
        {
          Five: 5,
          Seven: 7,
          Ten: 10,
        },
        5
      ),
    }}
    onChange={action('onChange')}
  />
);

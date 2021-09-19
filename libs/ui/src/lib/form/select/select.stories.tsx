import { text, boolean } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React from 'react';
import Select from './Select';

export default {
  component: Select,
  title: 'forms/Select',
};

export const base = () => {
  const id = uniqueId('select');
  return (
    <Select
      id={id}
      label={text('label', 'My Select')}
      helpText={text('helpText', undefined)}
      isRequired={boolean('isRequired', false)}
      labelHelp={text('labelHelp', undefined)}
      errorMessage={text('errorMessage', 'This is the error messages that shows if hasError')}
      errorMessageId="error-1"
      hasError={boolean('hasError', false)}
    >
      <select className="slds-select" id={id}>
        <option value="">Select…</option>
        <option>Option One</option>
        <option>Option Two</option>
        <option>Option Three</option>
      </select>
    </Select>
  );
};

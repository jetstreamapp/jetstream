import { action } from '@storybook/addon-actions';
import { text, boolean, select } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React from 'react';
import RichText from './RichText';

export default {
  component: RichText,
  title: 'forms/RichText',
};

export const base = () => {
  const id = uniqueId('select');
  return (
    <RichText
      options={{
        debug: select(
          'debug',
          {
            Error: 'error',
            Warn: 'warn',
            Log: 'log',
            Info: 'info',
          },
          undefined
        ),
        placeholder: text('placeholder', 'Write some stuff...'),
        readOnly: boolean('readOnly', false),
      }}
      disabled={boolean('disabled', false)}
      onChange={action('onChange')}
    ></RichText>
  );
};

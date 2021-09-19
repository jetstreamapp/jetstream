import { IconName } from '@jetstream/icon-factory';
import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React from 'react';
import CheckboxButton from './CheckboxButton';

export default {
  component: CheckboxButton,
  title: 'forms/CheckboxButton',
};

export const base = () => (
  <CheckboxButton
    id={uniqueId('checkbox')}
    checked={boolean('checked', false)}
    label={text('label', 'My Label')}
    disabled={boolean('disabled', false)}
    icon={text('icon', 'add') as IconName}
    iconChecked={text('iconChecked', 'check') as IconName}
    onChange={action('on-selected')}
  />
);

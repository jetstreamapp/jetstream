import React from 'react';
import { action } from '@storybook/addon-actions';
import { text, boolean } from '@storybook/addon-knobs';
import Checkbox from './Checkbox';
import { IconObj } from '@jetstream/types';
import uniqueId from 'lodash/uniqueId';

export default {
  component: Checkbox,
  title: 'Checkbox',
};

export const base = () => (
  <Checkbox
    id={uniqueId('checkbox')}
    checked={boolean('checked', true)}
    labelHelp={text('labelHelp', 'This is label help text')}
    label={text('label', 'My Label')}
    hideLabel={boolean('hideLabel', false)}
    helpText={text('helpText', 'This is help text')}
    isRequired={boolean('isRequired', true)}
    hasError={boolean('hasError', false)}
    errorMessageId={text('errorMessageId', undefined)}
    errorMessage={text('errorMessage', undefined)}
    disabled={boolean('disabled', false)}
    onChange={action('on-selected')}
  />
);

export const hiddenLabel = () => (
  <Checkbox
    id={uniqueId('checkbox')}
    checked={boolean('checked', true)}
    label={text('label', 'My Label')}
    hideLabel={boolean('hideLabel', true)}
    disabled={boolean('disabled', false)}
    onChange={action('on-selected')}
  />
);

export const disabledChecked = () => (
  <Checkbox
    id={uniqueId('checkbox')}
    checked={boolean('checked', false)}
    label={text('label', 'My Label')}
    hideLabel={boolean('hideLabel', false)}
    disabled={boolean('disabled', true)}
    onChange={action('on-selected')}
  />
);

export const disabledUnchecked = () => (
  <Checkbox
    id={uniqueId('checkbox')}
    checked={boolean('checked', true)}
    label={text('label', 'My Label')}
    hideLabel={boolean('hideLabel', false)}
    disabled={boolean('disabled', true)}
    onChange={action('on-selected')}
  />
);

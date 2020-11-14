import React from 'react';
import { action } from '@storybook/addon-actions';
import { text, boolean } from '@storybook/addon-knobs';
import CheckboxToggle from './CheckboxToggle';
import { IconObj } from '@jetstream/icon-factory';
import uniqueId from 'lodash/uniqueId';

export default {
  component: CheckboxToggle,
  title: 'CheckboxToggle',
};

export const base = () => (
  <CheckboxToggle
    id={uniqueId('checkbox')}
    checked={boolean('checked', true)}
    label={text('label', 'My Label')}
    hideLabel={boolean('hideLabel', false)}
    labelPosition={text('labelPosition', 'left') as any}
    disabled={boolean('disabled', false)}
    onChange={action('on-selected')}
  />
);

export const labelRight = () => (
  <CheckboxToggle
    id={uniqueId('checkbox')}
    checked={boolean('checked', true)}
    label={text('label', 'My Label')}
    hideLabel={boolean('hideLabel', false)}
    labelPosition={text('labelPosition', 'right') as any}
    disabled={boolean('disabled', false)}
    onChange={action('on-selected')}
  />
);

export const hiddenLabel = () => (
  <CheckboxToggle
    id={uniqueId('checkbox')}
    checked={boolean('checked', true)}
    label={text('label', 'My Label')}
    hideLabel={boolean('hideLabel', true)}
    disabled={boolean('disabled', false)}
    onChange={action('on-selected')}
  />
);

export const disabledChecked = () => (
  <CheckboxToggle
    id={uniqueId('checkbox')}
    checked={boolean('checked', false)}
    label={text('label', 'My Label')}
    hideLabel={boolean('hideLabel', false)}
    disabled={boolean('disabled', true)}
    onChange={action('on-selected')}
  />
);

export const disabledUnchecked = () => (
  <CheckboxToggle
    id={uniqueId('checkbox')}
    checked={boolean('checked', true)}
    label={text('label', 'My Label')}
    hideLabel={boolean('hideLabel', false)}
    disabled={boolean('disabled', true)}
    onChange={action('on-selected')}
  />
);

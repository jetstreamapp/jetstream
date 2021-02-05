import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import React from 'react';
import Radio from './Radio';
import RadioButton from './RadioButton';
import RadioGroup from './RadioGroup';

export default {
  component: RadioGroup,
  title: 'Radio',
};

const name = text('Radio 1/2 name', 'Label');

export const base = () => (
  <RadioGroup
    label={text('Group label', 'Label')}
    required={boolean('Group required', false)}
    hasError={boolean('Group hasError', false)}
    errorMessage={text('Group errorMessage', undefined)}
  >
    <Radio
      name={name}
      label={text('Radio 1 label', 'Radio 1')}
      value={text('Radio 1 value', 'radio1')}
      disabled={boolean('Radio 1 disabled', false)}
      checked={boolean('Radio 1 checked', true)}
      onChange={action('onChange')}
    />
    <Radio
      name={name}
      label={text('Radio 2 label', 'Radio 2')}
      value={text('Radio 2 value', 'radio2')}
      disabled={boolean('Radio 2 disabled', false)}
      checked={boolean('Radio 2 checked', false)}
      onChange={action('onChange')}
    />
  </RadioGroup>
);

export const required = () => (
  <RadioGroup
    label={text('Group label', 'Label')}
    required={boolean('Group required', true)}
    hasError={boolean('Group hasError', false)}
    errorMessage={text('Group errorMessage', undefined)}
  >
    <Radio
      name={name}
      label={text('Radio 1 label', 'Radio 1')}
      value={text('Radio 1 value', 'radio1')}
      disabled={boolean('Radio 1 disabled', false)}
      checked={boolean('Radio 1 checked', true)}
      onChange={action('onChange')}
    />
    <Radio
      name={name}
      label={text('Radio 2 label', 'Radio 2')}
      value={text('Radio 2 value', 'radio2')}
      disabled={boolean('Radio 2 disabled', false)}
      checked={boolean('Radio 2 checked', false)}
      onChange={action('onChange')}
    />
  </RadioGroup>
);

export const withError = () => (
  <RadioGroup
    label={text('Group label', 'Label')}
    required={boolean('Group required', true)}
    hasError={boolean('Group hasError', true)}
    errorMessage={text('Group errorMessage', 'This is an error message')}
  >
    <Radio
      name={name}
      label={text('Radio 1 label', 'Radio 1')}
      value={text('Radio 1 value', 'radio1')}
      disabled={boolean('Radio 1 disabled', false)}
      checked={boolean('Radio 1 checked', true)}
      onChange={action('onChange')}
    />
    <Radio
      name={name}
      label={text('Radio 2 label', 'Radio 2')}
      value={text('Radio 2 value', 'radio2')}
      disabled={boolean('Radio 2 disabled', false)}
      checked={boolean('Radio 2 checked', false)}
      onChange={action('onChange')}
    />
  </RadioGroup>
);

export const disabledChecked = () => (
  <RadioGroup
    label={text('Group label', 'Label')}
    required={boolean('Group required', false)}
    hasError={boolean('Group hasError', false)}
    errorMessage={text('Group errorMessage', undefined)}
  >
    <Radio
      name={name}
      label={text('Radio 1 label', 'Radio 2')}
      value={text('Radio 1 value', 'radio1')}
      disabled={boolean('Radio 1 disabled', true)}
      checked={boolean('Radio 1 checked', true)}
      onChange={action('onChange')}
    />
    <Radio
      name={name}
      label={text('Radio 2 label', 'Radio 2')}
      value={text('Radio 2 value', 'radio2')}
      disabled={boolean('Radio 1 disabled', true)}
      checked={boolean('Radio 2 checked', false)}
      onChange={action('onChange')}
    />
    <Radio
      name={name}
      label={text('Radio 3 label', 'Radio 3')}
      value={text('Radio 3 value', 'radio3')}
      disabled={boolean('Radio 3 disabled', true)}
      checked={boolean('Radio 3 checked', false)}
      onChange={action('onChange')}
    />
  </RadioGroup>
);

export const option3Disabled = () => (
  <RadioGroup
    label={text('Group label', 'Label')}
    required={boolean('Group required', false)}
    hasError={boolean('Group hasError', false)}
    errorMessage={text('Group errorMessage', undefined)}
  >
    <Radio
      name={name}
      label={text('Radio 1 label', 'Radio 1')}
      value={text('Radio 1 value', 'radio1')}
      disabled={boolean('Radio 1 disabled', false)}
      checked={boolean('Radio 1 checked', true)}
      onChange={action('onChange')}
    />
    <Radio
      name={name}
      label={text('Radio 2 label', 'Radio 2')}
      value={text('Radio 2 value', 'radio2')}
      disabled={boolean('Radio 1 disabled', false)}
      checked={boolean('Radio 2 checked', false)}
      onChange={action('onChange')}
    />
    <Radio
      name={name}
      label={text('Radio 3 label', 'Radio 3')}
      value={text('Radio 3 value', 'radio3')}
      disabled={boolean('Radio 3 disabled', true)}
      checked={boolean('Radio 3 checked', false)}
      onChange={action('onChange')}
    />
  </RadioGroup>
);

export const radioButton = () => (
  <RadioGroup
    label={text('Group label', 'Label')}
    required={boolean('Group required', true)}
    hasError={boolean('Group hasError', false)}
    errorMessage={text('Group errorMessage', undefined)}
    isButtonGroup
  >
    <RadioButton
      name={name}
      label={text('Radio 1 label', 'Radio 1')}
      value={text('Radio 1 value', 'radio1')}
      disabled={boolean('Radio 1 disabled', false)}
      checked={boolean('Radio 1 checked', true)}
      onChange={action('onChange')}
    />
    <RadioButton
      name={name}
      label={text('Radio 2 label', 'Radio 2')}
      value={text('Radio 2 value', 'radio2')}
      disabled={boolean('Radio 2 disabled', false)}
      checked={boolean('Radio 2 checked', false)}
      onChange={action('onChange')}
    />
  </RadioGroup>
);

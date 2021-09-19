import React from 'react';
import { action } from '@storybook/addon-actions';
import { text, boolean } from '@storybook/addon-knobs';
import Checkbox from './Checkbox';
import { IconObj } from '@jetstream/icon-factory';
import uniqueId from 'lodash/uniqueId';

export default {
  component: Checkbox,
  title: 'forms/Checkbox',
};

export const Base = (args) => <Checkbox id={uniqueId('checkbox')} {...args} />;
Base.args = {
  label: 'My Checkbox',
};

export const BellsAndWhistles = (args) => <Checkbox id={uniqueId('checkbox')} {...args} />;
BellsAndWhistles.args = {
  checked: true,
  labelHelp: 'This is label help text',
  label: 'My Label',
  hideLabel: false,
  helpText: 'This is help text',
  isRequired: true,
  hasError: false,
  disabled: false,
};

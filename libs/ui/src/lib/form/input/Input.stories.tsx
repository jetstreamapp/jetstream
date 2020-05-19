import React from 'react';
import { action } from '@storybook/addon-actions';
import { text, boolean } from '@storybook/addon-knobs';
import Input from './Input';
import { IconType } from '@silverthorn/types';
import uniqueId from 'lodash/uniqueId';

export default {
  component: Input,
  title: 'Input',
};

export const base = () => (
  <Input
    label={text('label', 'Label')}
    labelHelp={text('labelHelp', undefined)}
    helpText={text('helpText', undefined)}
    isRequired={boolean('isRequired', false)}
    hasError={boolean('hasError', false)}
    errorMessageId={text('errorMessageId', undefined)}
    errorMessage={text('errorMessage', undefined)}
    iconLeft={text('iconLeft', 'search')}
    iconLeftType={text('iconLeftType', 'utility') as IconType}
    iconRight={text('iconRight', undefined)}
    iconRightType={text('iconRightType', undefined) as IconType}
    leftAddon={text('leftAddon', undefined)}
    rightAddon={text('rightAddon', undefined)}
    clearButton={boolean('clearButton', false)}
    onClear={action('clear')}
  >
    <input
      className="slds-input"
      id={uniqueId('story-book-input')}
      placeholder={text('Placeholder', 'Example text input')}
      value={text('Input Value', undefined)}
    />
  </Input>
);

export const requiredWithHelpText = () => (
  <Input
    label={text('label', 'Required Label')}
    labelHelp={text('labelHelp', 'This is label help text')}
    helpText={text('helpText', 'This is help text')}
    isRequired={boolean('isRequired', true)}
    hasError={boolean('hasError', false)}
    errorMessageId={text('errorMessageId', undefined)}
    errorMessage={text('errorMessage', undefined)}
    iconLeft={text('iconLeft', undefined)}
    iconLeftType={text('iconLeftType', undefined) as IconType}
    iconRight={text('iconRight', 'search')}
    iconRightType={text('iconRightType', 'utility') as IconType}
    leftAddon={text('leftAddon', undefined)}
    rightAddon={text('rightAddon', undefined)}
    clearButton={boolean('clearButton', false)}
    onClear={action('clear')}
  >
    <input
      className="slds-input"
      id={uniqueId('story-book-input')}
      placeholder={text('Placeholder', 'Example text input')}
      value={text('Input Value', undefined)}
    />
  </Input>
);

export const withError = () => (
  <Input
    label={text('label', 'Label')}
    labelHelp={text('labelHelp', undefined)}
    helpText={text('helpText', undefined)}
    isRequired={boolean('isRequired', false)}
    hasError={boolean('hasError', true)}
    errorMessageId={text('errorMessageId', 'error-1')}
    errorMessage={text('errorMessage', 'This is a really basic error message')}
    iconLeft={text('iconLeft', undefined)}
    iconLeftType={text('iconLeftType', undefined) as IconType}
    iconRight={text('iconRight', undefined)}
    iconRightType={text('iconRightType', undefined) as IconType}
    leftAddon={text('leftAddon', undefined)}
    rightAddon={text('rightAddon', undefined)}
    clearButton={boolean('clearButton', false)}
    onClear={action('clear')}
  >
    <input
      className="slds-input"
      id={uniqueId('story-book-input')}
      placeholder={text('Placeholder', 'Example text input')}
      value={text('Input Value', undefined)}
    />
  </Input>
);

export const withErrorJsx = () => (
  <Input
    label={text('label', 'Label')}
    labelHelp={text('labelHelp', undefined)}
    helpText={text('helpText', undefined)}
    isRequired={boolean('isRequired', false)}
    hasError={boolean('hasError', true)}
    errorMessageId={text('errorMessageId', 'error-1')}
    errorMessage={
      <span>
        This Error is <strong>custom</strong> JSX!
      </span>
    }
    iconLeft={text('iconLeft', undefined)}
    iconLeftType={text('iconLeftType', undefined) as IconType}
    iconRight={text('iconRight', undefined)}
    iconRightType={text('iconRightType', undefined) as IconType}
    leftAddon={text('leftAddon', undefined)}
    rightAddon={text('rightAddon', undefined)}
    clearButton={boolean('clearButton', false)}
    onClear={action('clear')}
  >
    <input
      className="slds-input"
      id={uniqueId('story-book-input')}
      placeholder={text('Placeholder', 'Example text input')}
      value={text('Input Value', undefined)}
    />
  </Input>
);

export const withAddons = () => (
  <Input
    label={text('label', 'Label')}
    labelHelp={text('labelHelp', undefined)}
    helpText={text('helpText', undefined)}
    isRequired={boolean('isRequired', false)}
    hasError={boolean('hasError', false)}
    errorMessageId={text('errorMessageId', undefined)}
    errorMessage={text('errorMessage', undefined)}
    iconLeft={text('iconLeft', undefined)}
    iconLeftType={text('iconLeftType', undefined) as IconType}
    iconRight={text('iconRight', undefined)}
    iconRightType={text('iconRightType', undefined) as IconType}
    leftAddon={text('leftAddon', 'USD')}
    rightAddon={
      <span>
        <strong>Fancy</strong> add-on
      </span>
    }
    clearButton={boolean('clearButton', false)}
    onClear={action('clear')}
  >
    <input
      className="slds-input"
      id={uniqueId('story-book-input')}
      placeholder={text('Placeholder', 'Example text input')}
      value={text('Input Value', undefined)}
    />
  </Input>
);

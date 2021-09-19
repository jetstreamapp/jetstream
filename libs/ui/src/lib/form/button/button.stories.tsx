import React from 'react';
import ButtonGroupContainer from './ButtonGroupContainer';
import ButtonRowContainer from './ButtonRowContainer';
import ButtonRowItem from './ButtonRowItem';
import { text } from '@storybook/addon-knobs';

export default {
  component: ButtonGroupContainer,
  title: 'forms/Buttons',
};

export const buttonGroupContainer = () => (
  <ButtonGroupContainer>
    <button className={text('Button 2 className', 'slds-button slds-button_first slds-button_neutral')}>Neutral Button</button>
    <button className={text('Button 3 className', 'slds-button slds-button_middle slds-button_brand')}>Brand Button</button>
    <button className={text('Button 4 className', 'slds-button slds-button_middle slds-button_outline-brand')}>Outline Brand Button</button>
    <button className={text('Button 5 className', 'slds-button slds-button_middle slds-button_destructive')}>Destructive Button</button>
    <button className={text('Button 6 className', 'slds-button slds-button_middle slds-button_text-destructive')}>
      Text Destructive Button
    </button>
    <button className={text('Button 7 className', 'slds-button slds-button_last slds-button_success')}>Success Button</button>
  </ButtonGroupContainer>
);

export const ButtonRow = () => (
  <ButtonRowContainer>
    <ButtonRowItem>
      <button className={text('Button 1 className', 'slds-button')}>Button</button>
    </ButtonRowItem>
    <ButtonRowItem>
      <button className={text('Button 2 className', 'slds-button slds-button_neutral')}>Neutral Button</button>
    </ButtonRowItem>
    <ButtonRowItem>
      <button className={text('Button 3 className', 'slds-button slds-button_brand')}>Brand Button</button>
    </ButtonRowItem>
    <ButtonRowItem>
      <button className={text('Button 4 className', 'slds-button slds-button_outline-brand')}>Outline Brand Button</button>
    </ButtonRowItem>
    <ButtonRowItem>
      <button className={text('Button 5 className', 'slds-button slds-button_destructive')}>Destructive Button</button>
    </ButtonRowItem>
    <ButtonRowItem>
      <button className={text('Button 6 className', 'slds-button slds-button_text-destructive')}>Text Destructive Button</button>
    </ButtonRowItem>
    <ButtonRowItem>
      <button className={text('Button 7 className', 'slds-button slds-button_success')}>Success Button</button>
    </ButtonRowItem>
  </ButtonRowContainer>
);

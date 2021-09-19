import { IconObj } from '@jetstream/icon-factory';
import Avatar from '@salesforce-ux/design-system/assets/images/profile_avatar_96.png';
import { action } from '@storybook/addon-actions';
import { array, number, object, text } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React from 'react';
import DropDown from './DropDown';

export default {
  component: DropDown,
  title: 'forms/DropDown',
};

const values = array('items', [
  'item foo',
  'item bar',
  'item 3',
  'item 4',
  'item 5',
  'item 6',
  'item 7',
  'item 8',
  'item 9',
  'item 10',
  'item 11',
  'item 12',
  'item 13',
  'item 14',
  'item 15',
  'item 16',
]);

export const left = () => (
  <DropDown
    buttonClassName={text('buttonClassName', undefined)}
    dropDownClassName={text('dropDownClassName', undefined)}
    position="left"
    leadingIcon={object('Leading Icon', undefined)}
    scrollLength={number('scrollLength', 5) as 5 | 7 | 10}
    description={text('description', undefined)}
    items={values.map((item) => ({ id: uniqueId(item), value: item }))}
    onSelected={action('on-selected')}
  />
);

export const right = () => (
  <DropDown
    buttonClassName={text('buttonClassName', undefined)}
    dropDownClassName={text('dropDownClassName', 'My fancy action')}
    position="right"
    actionText={text('actionText', undefined)}
    leadingIcon={object('Leading Icon', undefined)}
    scrollLength={number('scrollLength', 5) as 5 | 7 | 10}
    description={text('description', undefined)}
    items={values.map((item) => ({ id: uniqueId(item), value: item }))}
    onSelected={action('on-selected')}
  />
);

export const LargeScroll = () => (
  <DropDown
    buttonClassName={text('buttonClassName', undefined)}
    dropDownClassName={text('dropDownClassName', 'My fancy action')}
    position="right"
    actionText={text('actionText', undefined)}
    leadingIcon={object('Leading Icon', undefined)}
    scrollLength={number('scrollLength', 10) as 5 | 7 | 10}
    description={text('description', undefined)}
    items={values.map((item) => ({ id: uniqueId(item), value: item }))}
    onSelected={action('on-selected')}
  />
);

export const customClass = () => (
  <DropDown
    buttonClassName={text('buttonClassName', 'slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small')}
    dropDownClassName={text('dropDownClassName', undefined)}
    position="left"
    actionText={text('actionText', undefined)}
    leadingIcon={object('Leading Icon', undefined)}
    scrollLength={number('scrollLength', 5) as 5 | 7 | 10}
    description={text('description', undefined)}
    items={values.map((item) => ({ id: uniqueId(item), value: item }))}
    onSelected={action('on-selected')}
  />
);

export const withDropdownIcons = () => (
  <DropDown
    buttonClassName={text('buttonClassName', 'slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small')}
    dropDownClassName={text('dropDownClassName', undefined)}
    position="left"
    actionText={text('actionText', undefined)}
    leadingIcon={object('Leading Icon', undefined)}
    scrollLength={number('scrollLength', 5) as 5 | 7 | 10}
    description={text('description', undefined)}
    items={[
      { id: uniqueId('icon'), value: 'item 1', icon: { type: 'utility', icon: 'help' } },
      { id: uniqueId('icon'), value: 'item 2', icon: { type: 'custom', icon: 'custom34' } },
      { id: uniqueId('icon'), value: 'item 3', icon: { type: 'action', icon: 'apex' } },
      { id: uniqueId('icon'), value: 'item 4', icon: { type: 'standard', icon: 'delegated_account' } },
    ]}
    onSelected={action('on-selected')}
  />
);

export const withLeadingIcon = () => (
  <DropDown
    buttonClassName={text('buttonClassName', undefined)}
    dropDownClassName={text('dropDownClassName', undefined)}
    position="left"
    actionText={text('actionText', undefined)}
    leadingIcon={object('Leading Icon', { type: 'utility', icon: 'add' } as IconObj)}
    scrollLength={number('scrollLength', 5) as 5 | 7 | 10}
    description={text('description', undefined)}
    items={[
      { id: uniqueId('icon'), value: 'item 1', icon: { type: 'utility', icon: 'help' } },
      { id: uniqueId('icon'), value: 'item 2', icon: { type: 'custom', icon: 'custom34' } },
      { id: uniqueId('icon'), value: 'item 3', icon: { type: 'action', icon: 'apex' } },
      { id: uniqueId('icon'), value: 'item 4', icon: { type: 'standard', icon: 'delegated_account' } },
    ]}
    onSelected={action('on-selected')}
  />
);

export const withCustomButtonContent = () => (
  <DropDown
    buttonClassName={text('buttonClassName', 'slds-button slds-global-actions__avatar slds-global-actions__item-action')}
    dropDownClassName={text('dropDownClassName', undefined)}
    buttonContent={
      <span className="slds-avatar slds-avatar_circle slds-avatar_medium">
        <img alt="Avatar" src={Avatar} />
      </span>
    }
    position="left"
    actionText={text('actionText', undefined)}
    scrollLength={number('scrollLength', 5) as 5 | 7 | 10}
    description={text('description', undefined)}
    items={[
      { id: uniqueId('icon'), value: 'item 1', icon: { type: 'utility', icon: 'help' } },
      { id: uniqueId('icon'), value: 'item 2', icon: { type: 'custom', icon: 'custom34' } },
      { id: uniqueId('icon'), value: 'item 3', icon: { type: 'action', icon: 'apex' } },
      { id: uniqueId('icon'), value: 'item 4', icon: { type: 'standard', icon: 'delegated_account' } },
    ]}
    onSelected={action('on-selected')}
  />
);

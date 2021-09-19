import { action } from '@storybook/addon-actions';
import { boolean, select, text } from '@storybook/addon-knobs';
import React from 'react';
import Picklist from './Picklist';

export default {
  component: Picklist,
  title: 'forms/Picklist',
};

export const singleSelection = () => (
  <Picklist
    label={text('label', 'My Picklist')}
    placeholder="Select an Option"
    multiSelection={boolean('multiSelection', false)}
    allowDeselection={boolean('allowDeselection', false)}
    labelHelp={text('labelHelp', 'My fancy label help text')}
    helpText={text('helpText', 'My fancy help text')}
    isRequired={boolean('isRequired', false)}
    hasError={boolean('hasError', false)}
    errorMessageId="error-id-used-for-accessibility"
    errorMessage={text('errorMessage', 'Error Message')}
    scrollLength={select(
      'scrollLength',
      {
        Five: 5,
        Seven: 7,
        Ten: 10,
      },
      5
    )}
    items={[
      { id: 'item1', label: 'Apple', value: 'item1' },
      { id: 'item2', label: 'Banana', value: 'item2' },
      { id: 'item3', label: 'Item 3', value: 'item3' },
      { id: 'item4', label: 'Zoo', value: 'item4' },
      { id: 'item5', label: 'Zoo And Stuff', value: 'item5' },
      { id: 'item6', label: 'Foo', value: 'item6' },
      { id: 'item7', label: 'Bar', value: 'item7' },
      { id: 'item8', label: 'Item 8', value: 'item8' },
      { id: 'item9', label: 'Item 9', value: 'item9' },
      { id: 'item10', label: 'Item 10', value: 'item10' },
    ]}
    onChange={action('onChange')}
  ></Picklist>
);

export const singleSelectionWithExistingSelection = () => {
  const item1 = { id: 'item1', label: 'Item 1', value: 'item1' };
  return (
    <Picklist
      label={text('label', 'My Picklist')}
      placeholder="Select an Option"
      multiSelection={boolean('multiSelection', false)}
      allowDeselection={boolean('allowDeselection', false)}
      scrollLength={select(
        'scrollLength',
        {
          Five: 5,
          Seven: 7,
          Ten: 10,
        },
        5
      )}
      items={[
        item1,
        { id: 'item2', label: 'Item 2', value: 'item2' },
        { id: 'item3', label: 'Item 3', value: 'item3' },
        { id: 'item4', label: 'Item 4', value: 'item4' },
        { id: 'item5', label: 'Item 5', value: 'item5' },
        { id: 'item6', label: 'Item 6', value: 'item6' },
        { id: 'item7', label: 'Item 7', value: 'item7' },
        { id: 'item8', label: 'Item 8', value: 'item8' },
        { id: 'item9', label: 'Item 9', value: 'item9' },
        { id: 'item10', label: 'Item 10', value: 'item10' },
      ]}
      selectedItems={[item1]}
      onChange={action('onChange')}
    ></Picklist>
  );
};

export const singleSelectionRequireSelection = () => (
  <Picklist
    label={text('label', 'My Picklist')}
    placeholder="Select an Option"
    multiSelection={boolean('multiSelection', false)}
    allowDeselection={boolean('allowDeselection', false)}
    scrollLength={select(
      'scrollLength',
      {
        Five: 5,
        Seven: 7,
        Ten: 10,
      },
      5
    )}
    items={[
      { id: 'item1', label: 'Item 1', value: 'item1' },
      { id: 'item2', label: 'Item 2', value: 'item2' },
      { id: 'item3', label: 'Item 3', value: 'item3' },
      { id: 'item4', label: 'Item 4', value: 'item4' },
      { id: 'item5', label: 'Item 5', value: 'item5' },
      { id: 'item6', label: 'Item 6', value: 'item6' },
      { id: 'item7', label: 'Item 7', value: 'item7' },
      { id: 'item8', label: 'Item 8', value: 'item8' },
      { id: 'item9', label: 'Item 9', value: 'item9' },
      { id: 'item10', label: 'Item 10', value: 'item10' },
    ]}
    onChange={action('onChange')}
  ></Picklist>
);

export const multiSelection = () => (
  <Picklist
    label={text('label', 'My Picklist')}
    placeholder="Select an Option"
    multiSelection={boolean('multiSelection', true)}
    allowDeselection={boolean('allowDeselection', true)}
    scrollLength={select(
      'scrollLength',
      {
        Five: 5,
        Seven: 7,
        Ten: 10,
      },
      5
    )}
    items={[
      { id: 'item1', label: 'Item 1', value: 'item1' },
      { id: 'item2', label: 'Item 2', value: 'item2' },
      { id: 'item3', label: 'Item 3', value: 'item3' },
      { id: 'item4', label: 'Item 4', value: 'item4' },
      { id: 'item5', label: 'Item 5', value: 'item5' },
      { id: 'item6', label: 'Item 6', value: 'item6' },
      { id: 'item7', label: 'Item 7', value: 'item7' },
      { id: 'item8', label: 'Item 8', value: 'item8' },
      { id: 'item9', label: 'Item 9', value: 'item9' },
      { id: 'item10', label: 'Item 10', value: 'item10' },
    ]}
    onChange={action('onChange')}
  ></Picklist>
);

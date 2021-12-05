import { Meta, Story } from '@storybook/react';
import React from 'react';
import { Icon } from '../../widgets/Icon';
import Form from './Form';
import FormRow from './FormRow';
import FormRowItem from './FormRowItem';
import ReadOnlyFormItemComponent, { ReadOnlyFormItemProps } from './ReadOnlyFormItem';

export default {
  component: ReadOnlyFormItemComponent,
  title: 'forms/ReadOnlyForm',
  args: {
    label: 'Form Label',
    position: 'stacked',
    labelHelp: 'Help Me!',
    isRequired: false,
    fullWidth: false,
    omitEdit: false,
  },
} as Meta;

const Template: Story<ReadOnlyFormItemProps> = ({ ...args }) => (
  <Form>
    <FormRow>
      <FormRowItem>
        <ReadOnlyFormItemComponent {...args}>Some Value</ReadOnlyFormItemComponent>
      </FormRowItem>
      <FormRowItem>
        <ReadOnlyFormItemComponent {...args}>Some Other Value</ReadOnlyFormItemComponent>
      </FormRowItem>
    </FormRow>
    <FormRow>
      <FormRowItem>
        <ReadOnlyFormItemComponent {...args} fullWidth>
          Description
        </ReadOnlyFormItemComponent>
      </FormRowItem>
    </FormRow>
    <FormRow>
      <FormRowItem>
        <ReadOnlyFormItemComponent {...args}>
          <Icon
            type="utility"
            icon="steps"
            containerClassname="slds-icon_container slds-icon-utility-steps slds-current-color"
            className="slds-icon slds-icon_x-small"
          />
        </ReadOnlyFormItemComponent>
      </FormRowItem>
      <FormRowItem></FormRowItem>
    </FormRow>
  </Form>
);

export const TextItem = Template.bind({});

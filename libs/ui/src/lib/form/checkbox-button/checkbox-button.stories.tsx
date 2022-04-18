import { Story, Meta, ComponentMeta, ComponentStory } from '@storybook/react';
import { CheckboxButton } from './CheckboxButton';

export default {
  component: CheckboxButton,
  title: 'CheckboxButton',
  args: {
    id: 'checkbox-button',
    checked: false,
    label: 'My label',
    disabled: false,
    icon: 'add',
    iconChecked: 'edit',
    // onChange : '',
  },
} as ComponentMeta<typeof CheckboxButton>;

const Template: ComponentStory<typeof CheckboxButton> = (args) => <CheckboxButton {...args} />;

export const Primary = Template.bind({});
Primary.args = {};

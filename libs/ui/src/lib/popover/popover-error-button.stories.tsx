import { Meta, Story } from '@storybook/react';
import React from 'react';
import PopoverErrorButtonComponent, { PopoverErrorButtonProps } from './PopoverErrorButton';

export default {
  title: 'overlays/PopoverErrorButton',
  component: PopoverErrorButtonComponent,
  argTypes: {
    errors: { control: false },
  },
  args: {
    initOpenState: false,
    header: 'Uh Oh! We hit a snag!',
    listHeader: 'These are the errors',
    errors: ['Error 1', 'Error 2', 'Error 3'],
  },
} as Meta;

const Template: Story<PopoverErrorButtonProps> = ({ ...args }) => <PopoverErrorButtonComponent {...args} />;

export const PopoverErrorButton = Template.bind({});

export const PopoverErrorButtonInitiallyOpen = Template.bind({});
PopoverErrorButtonInitiallyOpen.args = {
  initOpenState: true,
};

export const PopoverErrorButtonOneError = Template.bind({});
PopoverErrorButtonOneError.args = {
  errors: 'This is my one and only error',
};

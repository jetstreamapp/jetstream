import { Meta, Story } from '@storybook/react';
import React from 'react';
import PillComponent, { PillProps } from './Pill';

export default {
  title: 'widgets/pill',
  component: PillComponent,
  argTypes: {
    onRemove: { action: 'clicked' },
  },
  args: {
    children: 'My Pill',
  },
} as Meta;

const Template: Story<PillProps> = ({ children, ...args }) => <PillComponent {...args}>{children}</PillComponent>;

export const Pill = Template.bind({});

export const PillCantRemove = Template.bind({});
PillCantRemove.argTypes = {
  onRemove: null,
};

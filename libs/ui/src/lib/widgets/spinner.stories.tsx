import { Meta, Story } from '@storybook/react';
import React from 'react';
import Icon from './Icon';
import SpinnerComponent, { SpinnerProps } from './Spinner';

export default {
  title: 'widgets/spinner',
  component: SpinnerComponent,
  args: {
    hasContainer: false,
    inline: false,
  },
} as Meta;

const Template: Story<SpinnerProps> = ({ ...args }) => <SpinnerComponent {...args} />;

export const SpinnerFullPage = Template.bind({});

export const SpinnerInRelativeContainer: Story<SpinnerProps> = ({ ...args }) => (
  <div className="slds-is-relative" style={{ width: 100, height: 100 }}>
    <SpinnerComponent {...args} />
  </div>
);
SpinnerInRelativeContainer.args = {
  hasContainer: true,
};

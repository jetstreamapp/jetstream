import { Meta, Story } from '@storybook/react';
import React, { Fragment } from 'react';
import ToastComponent, { ToastProps } from './Toast';

export default {
  title: 'notifications/Toast',
  component: ToastComponent,
  argTypes: {
    onClose: { action: 'onClose' },
    type: {
      options: ['info', 'success', 'warning', 'error', 'offline'],
      defaultValue: 'info',
    },
  },
  args: {
    showIcon: true,
    children: 'This is a fancy message',
    // onClose: () => {},
  },
} as Meta;

const Template: Story<ToastProps> = ({ children, ...args }) => <ToastComponent {...args}>{children}</ToastComponent>;

export const Toast = Template.bind({});

export const ToastWithDetails = Template.bind({});

ToastWithDetails.args = {
  type: 'warning',
  children: (
    <Fragment>
      <span className="slds-text-heading_small">I am a toast message</span>
      <p>
        Here's some detail of
        {/* eslint-disable-next-line no-script-url */}
        <a href="javascript:void(0);"> what happened</a>, being very descriptive and transparent.
      </p>
    </Fragment>
  ),
};

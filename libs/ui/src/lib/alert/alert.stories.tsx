import React from 'react';
import { Story, Meta } from '@storybook/react';
import Alert, { AlertProps } from './Alert';

export default {
  title: 'Alert',
  component: Alert,
  args: {
    allowClose: false,
  },
} as Meta;

const Template: Story<AlertProps> = (args) => <Alert {...args}>Logged in as John Smith (johnsmith@acme.com).</Alert>;

export const Info = Template.bind({});
Info.args = {
  type: 'info',
  leadingIcon: 'info',
};

export const Warning = Template.bind({});
Warning.args = {
  type: 'warning',
  leadingIcon: 'warning',
};

export const Error = Template.bind({});
Error.args = {
  type: 'error',
  leadingIcon: 'error',
};

export const Offline = Template.bind({});
Offline.args = {
  type: 'offline',
  leadingIcon: 'info',
};

// export const info = () => (
//   <Alert type="info" leadingIcon="add">
//     Logged in as John Smith (johnsmith@acme.com).
//   </Alert>
// );

// export const warning = () => (
//   <Alert type="warning" leadingIcon="warning">
//     Your browser is outdated. Your Salesforce experience may be degraded.
//   </Alert>
// );

// export const error = () => (
//   <Alert type="error" leadingIcon="error">
//     Your browser is currently not supported. Your Salesforce may be degraded.
//   </Alert>
// );

// export const offline = () => (
//   <Alert type="offline" leadingIcon="add">
//     You are in offline mode.
//   </Alert>
// );

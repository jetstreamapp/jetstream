import React from 'react';
import Alert from './Alert';

export default {
  title: 'Alert',
  component: Alert,
};

export const info = () => (
  <Alert type="info" leadingIcon="user">
    Logged in as John Smith (johnsmith@acme.com).
  </Alert>
);

export const warning = () => (
  <Alert type="warning" leadingIcon="warning">
    Your browser is outdated. Your Salesforce experience may be degraded.
  </Alert>
);

export const error = () => (
  <Alert type="error" leadingIcon="error">
    Your browser is currently not supported. Your Salesforce may be degraded.
  </Alert>
);

export const offline = () => (
  <Alert type="offline" leadingIcon="offline">
    You are in offline mode.
  </Alert>
);

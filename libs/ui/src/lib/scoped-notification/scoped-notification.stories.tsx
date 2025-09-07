/* eslint-disable jsx-a11y/anchor-is-valid */
import { select } from '@storybook/addon-knobs';
import React from 'react';
import Icon from '../widgets/Icon';
import ScopedNotification from './ScopedNotification';

export default {
  component: ScopedNotification,
  title: 'ScopedNotification',
};

export const base = () => (
  <ScopedNotification
    theme={select(
      'guttersSize',
      {
        info: 'info',
        success: 'success',
        warning: 'warning',
        error: 'error',
        light: 'light',
        dark: 'dark',
      },
      'info',
    )}
  >
    INFO! <a href="#">Click here</a>
  </ScopedNotification>
);

export const customIcon = () => (
  <ScopedNotification
    icon={<Icon type="doctype" icon="excel" title="Excel file" className="slds-icon slds-icon_small" />}
    theme={select(
      'guttersSize',
      {
        info: 'info',
        success: 'success',
        warning: 'warning',
        error: 'error',
        light: 'light',
        dark: 'dark',
      },
      'info',
    )}
  >
    INFO! <a href="#">Click here</a>
  </ScopedNotification>
);

export const lotsOfContent = () => (
  <ScopedNotification
    theme={select(
      'guttersSize',
      {
        info: 'info',
        success: 'success',
        warning: 'warning',
        error: 'error',
        light: 'light',
        dark: 'dark',
      },
      'error',
    )}
  >
    <div>
      <strong>
        <p>There is a lot of content to show here:</p>
      </strong>
      <ul className="slds-list_dotted">
        <li>item blew up</li>
        <li>item blew up</li>
        <li>item blew up</li>
        <li>item blew up</li>
        <li>item blew up</li>
        <li>item blew up</li>
      </ul>
    </div>
  </ScopedNotification>
);

/* eslint-disable jsx-a11y/anchor-is-valid */
import { IconObj } from '@jetstream/types';
import { action } from '@storybook/addon-actions';
import { array, number, object, text, boolean } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React, { Fragment } from 'react';
import Toast from './Toast';

export default {
  component: Toast,
  title: 'Toast',
};

export const base = () => (
  <Fragment>
    <Toast type="info" showIcon={boolean('showIcon', undefined)} onClose={action('onClose')}>
      I am a toast message
    </Toast>
  </Fragment>
);

export const all = () => (
  <Fragment>
    <Toast type="info" showIcon={boolean('showIcon', undefined)} onClose={action('onClose')}>
      I am a toast message
    </Toast>
    <Toast type="success" showIcon={boolean('showIcon', undefined)} onClose={action('onClose')}>
      I am a toast message
    </Toast>
    <Toast type="warning" showIcon={boolean('showIcon', undefined)} onClose={action('onClose')}>
      I am a toast message
    </Toast>
    <Toast type="error" showIcon={boolean('showIcon', undefined)} onClose={action('onClose')}>
      I am a toast message
    </Toast>
  </Fragment>
);

export const withDetails = () => (
  <Fragment>
    <Toast type="info" showIcon={boolean('showIcon', undefined)} headingClassName="" onClose={action('onClose')}>
      <span className="slds-text-heading_small">I am a toast message</span>
      <p>
        Here's some detail of
        {/* eslint-disable-next-line no-script-url */}
        <a href="javascript:void(0);"> what happened</a>, being very descriptive and transparent.
      </p>
    </Toast>
  </Fragment>
);

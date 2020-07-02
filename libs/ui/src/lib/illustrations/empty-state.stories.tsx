import { boolean, text, number } from '@storybook/addon-knobs';
import React from 'react';
import EmptyState from './EmptyState';

export default {
  title: 'EmptyState',
  component: EmptyState,
};

export const base = () => (
  <EmptyState
    showIllustration={boolean('showIllustration', true)}
    headline={text('headline', 'Uh Oh, your state is empty!')}
    imageWidth={number('imageWidth', 300)}
  >
    <p>{text('body line 1', 'this is some information about the empty state')}</p>
    <p>{text('body line 2', 'make sure not to get too long with it as it')}</p>
    <p>{text('body line 3', 'should not extend beyond your image')}</p>
  </EmptyState>
);

export const withCallToAction = () => (
  <EmptyState
    showIllustration={boolean('showIllustration', true)}
    headline={text('headline', 'Uh Oh, your state is empty!')}
    imageWidth={number('imageWidth', 300)}
    callToAction={
      <button className="slds-button slds-button_brand" title="Call to action">
        Call to Action
      </button>
    }
  >
    <p>{text('body line 1', 'this is some information about the empty state')}</p>
    <p>{text('body line 2', 'make sure not to get too long with it as it')}</p>
    <p>{text('body line 3', 'should not extend beyond your image')}</p>
  </EmptyState>
);

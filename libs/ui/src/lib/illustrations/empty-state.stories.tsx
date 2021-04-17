import { boolean, text, number } from '@storybook/addon-knobs';
import React from 'react';
import EmptyState from './EmptyState';

export default {
  title: 'EmptyState',
  component: EmptyState,
};

export const base = () => (
  <EmptyState
    omitIllustration={boolean('omitIllustration', false)}
    headline={text('headline', 'Uh Oh, your state is empty!')}
    subHeading={text('subHeading', 'this is some information about the empty state')}
  ></EmptyState>
);

export const withCallToAction = () => (
  <EmptyState
    omitIllustration={boolean('omitIllustration', false)}
    headline={text('headline', 'Uh Oh, your state is empty!')}
    subHeading={text('subHeading', 'this is some information about the empty state')}
  >
    <button className="slds-button slds-button_brand" title="Call to action">
      Call to Action
    </button>
  </EmptyState>
);

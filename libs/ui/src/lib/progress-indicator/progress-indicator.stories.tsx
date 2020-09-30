import { action } from '@storybook/addon-actions';
import { boolean, number } from '@storybook/addon-knobs';
import React from 'react';
import ProgressIndicator from './ProgressIndicator';

export default {
  component: ProgressIndicator,
  title: 'ProgressIndicator',
};

export const base = () => (
  <ProgressIndicator
    totalSteps={number('totalSteps', 6)}
    currentStep={number('currentStep', 3)}
    readOnly={boolean('readOnly', false)}
    onChangeStep={action('onChangeStep')}
  ></ProgressIndicator>
);

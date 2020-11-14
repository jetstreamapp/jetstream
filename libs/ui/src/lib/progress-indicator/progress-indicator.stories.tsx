import { action } from '@storybook/addon-actions';
import { boolean, number } from '@storybook/addon-knobs';
import React from 'react';
import ProgressIndicator from './ProgressIndicator';
import ProgressIndicatorListItem from './ProgressIndicatorListItem';

export default {
  component: ProgressIndicator,
  title: 'ProgressIndicator',
};

const currentStep: number = 2;

export const base = () => (
  <ProgressIndicator currentStep={currentStep} isVertical>
    <ProgressIndicatorListItem
      step={0}
      stepText="Choose Object and Load File"
      isVertical
      isActive={currentStep === 0}
      isComplete={currentStep > 0}
    />
    <ProgressIndicatorListItem step={1} stepText="Map Fields" isVertical isActive={currentStep === 1} isComplete={currentStep > 1} />
    <ProgressIndicatorListItem
      step={2}
      stepText="Disable Automation (optional)"
      isVertical
      isActive={currentStep === 2}
      isComplete={currentStep > 2}
    />
    <ProgressIndicatorListItem step={3} stepText="Load Data" isVertical isActive={currentStep === 3} isComplete={currentStep > 3} />
    <ProgressIndicatorListItem
      step={4}
      stepText="Rollback Automation (optional)"
      isVertical
      isActive={currentStep === 4}
      isComplete={currentStep > 4}
    />
  </ProgressIndicator>
);

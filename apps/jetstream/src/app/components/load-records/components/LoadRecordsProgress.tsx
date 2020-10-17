/** @jsx jsx */
import { jsx } from '@emotion/core';
import { ProgressIndicator, ProgressIndicatorListItem } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { Step } from '../load-records-types';

export interface LoadRecordsProgressProps {
  currentStepIdx: number;
  enabledSteps: Step[];
}

export const LoadRecordsProgress: FunctionComponent<LoadRecordsProgressProps> = ({ currentStepIdx, enabledSteps }) => {
  return (
    <ProgressIndicator currentStep={currentStepIdx} isVertical>
      {enabledSteps.map((step, i) => (
        <ProgressIndicatorListItem
          key={step.name}
          step={i}
          stepText={step.label}
          isVertical
          isActive={currentStepIdx === i}
          isComplete={currentStepIdx > i}
        />
      ))}
      {/*
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
      /> */}
    </ProgressIndicator>
  );
};

export default LoadRecordsProgress;

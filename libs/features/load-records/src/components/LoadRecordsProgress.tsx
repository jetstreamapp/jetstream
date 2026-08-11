import { Step } from '@jetstream/types';
import { ProgressStepIndicator, ProgressStepIndicatorListItem } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface LoadRecordsProgressProps {
  currentStepIdx: number;
  steps: Step[];
}

export const LoadRecordsProgress: FunctionComponent<LoadRecordsProgressProps> = ({ currentStepIdx, steps }) => {
  return (
    <ProgressStepIndicator currentStep={currentStepIdx} isVertical>
      {steps.map((step, i) => (
        <ProgressStepIndicatorListItem
          key={step.name}
          step={i}
          stepText={step.label}
          isVertical
          isActive={currentStepIdx === i}
          isComplete={currentStepIdx > i}
        />
      ))}
    </ProgressStepIndicator>
  );
};

export default LoadRecordsProgress;

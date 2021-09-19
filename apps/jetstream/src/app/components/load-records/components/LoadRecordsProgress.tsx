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
    </ProgressIndicator>
  );
};

export default LoadRecordsProgress;

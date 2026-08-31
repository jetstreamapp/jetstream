import { css } from '@emotion/react';
import { Step } from '@jetstream/types';
import { Grid, ProgressStepIndicator, ProgressStepIndicatorListItem } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface LoadRecordsProgressProps {
  currentStepIdx: number;
  steps: Step[];
  // Prevents navigating back to completed steps (e.g. while a load is in progress)
  disabled?: boolean;
  onStepChange: (stepIdx: number) => void;
}

/**
 * Compact step progress designed to sit in the page header - shows the current step label
 * with a horizontal dot indicator. Completed steps can be clicked to navigate back.
 */
export const LoadRecordsProgress: FunctionComponent<LoadRecordsProgressProps> = ({ currentStepIdx, steps, disabled, onStepChange }) => {
  return (
    <Grid testId="load-records-progress" verticalAlign="center">
      <span className="slds-text-title slds-m-right_small">
        Step {currentStepIdx + 1} of {steps.length}: {steps[currentStepIdx].label}
      </span>
      <ProgressStepIndicator
        currentStep={currentStepIdx}
        className="slds-progress_shade"
        css={css`
          width: 7rem;
          max-width: 7rem;
          flex: 0 0 auto;
          /* Blend the completed marker's ring into the grey page header (slds-progress_shade misses this case) */
          .slds-progress__item.slds-is-completed .slds-progress__marker_icon {
            border-color: var(--slds-g-color-neutral-base-95, #f3f3f3);
          }
        `}
      >
        {steps.map((step, i) => (
          <ProgressStepIndicatorListItem
            key={step.name}
            step={i}
            stepText={step.label}
            isActive={currentStepIdx === i}
            isComplete={currentStepIdx > i}
            onChangeStep={i < currentStepIdx && !disabled ? onStepChange : undefined}
          />
        ))}
      </ProgressStepIndicator>
    </Grid>
  );
};

export default LoadRecordsProgress;

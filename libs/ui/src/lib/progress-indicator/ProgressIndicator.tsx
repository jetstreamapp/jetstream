/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FunctionComponent } from 'react';
import ProgressIndicatorListItem from './ProgressIndicatorListItem';
import classNames from 'classnames';

export interface ProgressIndicatorProps {
  className?: string;
  totalSteps: number;
  currentStep: number;
  readOnly?: boolean;
  onChangeStep?: (step: number) => void;
}

export const ProgressIndicator: FunctionComponent<ProgressIndicatorProps> = ({
  className,
  totalSteps,
  currentStep,
  readOnly,
  onChangeStep,
}) => {
  const steps = Array(totalSteps).fill(0);
  const progressValue = (currentStep / (totalSteps - 1)) * 100;
  return (
    <div className={classNames('slds-progress', className)}>
      <ol className="slds-progress__list">
        {steps.map((step, i) => (
          <ProgressIndicatorListItem
            key={i}
            step={i}
            isActive={i === currentStep}
            isComplete={i < currentStep}
            disabled={readOnly}
            onChangeStep={(newStep) => onChangeStep && onChangeStep(newStep)}
          />
        ))}
      </ol>
      <div
        className="slds-progress-bar slds-progress-bar_x-small"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressValue}
        role="progressbar"
      >
        <span
          className="slds-progress-bar__value"
          css={css`
            width: ${progressValue}%;
          `}
        >
          <span className="slds-assistive-text">Progress: {progressValue}%</span>
        </span>
      </div>
    </div>
  );
};

export default ProgressIndicator;

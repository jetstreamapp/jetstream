import { css } from '@emotion/react';
import classNames from 'classnames';
import { Children } from 'react';

export interface ProgressStepIndicatorProps {
  className?: string;
  isVertical?: boolean;
  currentStep: number;
  children?: React.ReactNode;
}

export const ProgressStepIndicator = ({ className, isVertical, currentStep, children }: ProgressStepIndicatorProps) => {
  const divisor = Math.max(Children.count(children) - 1, 1);
  const progressValue = (currentStep / divisor) * 100;
  return (
    <div className={classNames('slds-progress', { 'slds-progress_vertical': isVertical }, className)}>
      <ol className="slds-progress__list">{children}</ol>
      <div
        className={classNames({ 'slds-progress-bar slds-progress-bar_x-small': !isVertical })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressValue}
        role="progressbar"
      >
        {isVertical && <span className="slds-assistive-text">Progress: {progressValue}%</span>}
        {!isVertical && (
          <span
            className="slds-progress-bar__value"
            css={css`
              width: ${progressValue}%;
            `}
          >
            <span className="slds-assistive-text">Progress: {progressValue}%</span>
          </span>
        )}
      </div>
    </div>
  );
};

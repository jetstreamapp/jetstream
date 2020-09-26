/** @jsx jsx */
import { jsx } from '@emotion/core';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import Icon from '../widgets/Icon';

export interface ProgressIndicatorListItemProps {
  step: number;
  isActive: boolean;
  isComplete: boolean;
  disabled: boolean;
  onChangeStep: (step: number) => void;
}

export const ProgressIndicatorListItem: FunctionComponent<ProgressIndicatorListItemProps> = ({
  step,
  isActive,
  isComplete,
  disabled,
  onChangeStep,
}) => {
  let stepTitle = `Step ${step + 1}`;
  if (isActive) {
    stepTitle += ' - Active';
  } else if (isComplete) {
    stepTitle += ' - Completed';
  }
  return (
    <li className={classNames('slds-progress__item', { 'slds-is-active': isActive, 'slds-is-completed': isComplete })}>
      <button
        className={classNames('slds-button slds-progress__marker', {
          'slds-button_icon slds-progress__marker_icon': isComplete,
        })}
        title={stepTitle}
        disabled={disabled}
        onClick={() => onChangeStep && onChangeStep(step)}
      >
        {isComplete && <Icon type="utility" icon="success" className="slds-button__icon" omitContainer />}
        <span className="slds-assistive-text">{stepTitle}</span>
      </button>
    </li>
  );
};

export default ProgressIndicatorListItem;

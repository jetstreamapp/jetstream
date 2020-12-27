/** @jsx jsx */
import { jsx } from '@emotion/react';
import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';
import Icon from '../widgets/Icon';

export interface ProgressIndicatorListItemProps {
  step: number;
  stepText?: string;
  isVertical?: boolean;
  isActive?: boolean;
  isComplete?: boolean;
  disabled?: boolean; // does not apply to vertical
  onChangeStep?: (step: number) => void; // does not apply to vertical
}

export const ProgressIndicatorListItem: FunctionComponent<ProgressIndicatorListItemProps> = ({
  step,
  stepText,
  isVertical,
  isActive,
  isComplete,
  disabled,
  onChangeStep,
}) => {
  const stepTitleVertical = `Step ${step + 1}`;
  let stepTitle = stepTitleVertical;
  if (isActive) {
    stepTitle += ' - Active';
  } else if (isComplete) {
    stepTitle += ' - Completed';
  }
  return (
    <li className={classNames('slds-progress__item', { 'slds-is-active slds-text-title_bold': isActive, 'slds-is-completed': isComplete })}>
      {isVertical && isComplete && (
        <Fragment>
          <span
            className="slds-icon_container slds-icon-utility-success slds-progress__marker slds-progress__marker_icon slds-progress__marker_icon-success"
            title="Complete"
          >
            <Icon type="utility" icon="success" className="slds-icon slds-icon_xx-small" omitContainer />
            <span className="slds-assistive-text">Complete</span>
          </span>
          <div className="slds-progress__item_content slds-grid slds-grid_align-spread">{stepText || stepTitleVertical}</div>
        </Fragment>
      )}
      {isVertical && !isComplete && (
        <Fragment>
          <div className="slds-progress__marker">
            <span className="slds-assistive-text">Active</span>
          </div>
          <div className="slds-progress__item_content slds-grid slds-grid_align-spread">{stepText || stepTitleVertical}</div>
        </Fragment>
      )}
      {!isVertical && (
        <button
          className={classNames('slds-button slds-progress__marker', {
            'slds-button_icon slds-progress__marker_icon': isComplete,
          })}
          title={stepText || stepTitle}
          disabled={disabled}
          onClick={() => onChangeStep && onChangeStep(step)}
        >
          {isComplete && <Icon type="utility" icon="success" className="slds-button__icon" omitContainer />}
          <span className="slds-assistive-text">{stepText || stepTitle}</span>
        </button>
      )}
    </li>
  );
};

export default ProgressIndicatorListItem;

import { GroupingOperator } from '@jetstream/types';
import React, { FunctionComponent } from 'react';
import ExpressionActionDropDown from './ExpressionActionDropDown';
import Icon from '../widgets/Icon';

export interface ExpressionGroupProps {
  group: number;
  groupingOperator: GroupingOperator;
}

export const ExpressionGroup: FunctionComponent<ExpressionGroupProps> = ({ groupingOperator, group, children }) => {
  return (
    <li className="slds-expression__group">
      <fieldset>
        <legend className="slds-expression__legend slds-expression__legend_group">
          <span>{groupingOperator}</span>
          <span className="slds-assistive-text">Condition Group {group}</span>
        </legend>
        <ExpressionActionDropDown label="" value="AND" onChange={() => {}} />
        {children}
        <div className="slds-expression__buttons">
          <button className="slds-button slds-button_neutral">
            <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer={true} />
            Add Condition
          </button>
        </div>
      </fieldset>
    </li>
  );
};

export default ExpressionGroup;

import React, { FunctionComponent } from 'react';
import Icon from '../widgets/Icon';
import ExpressionActionDropDown from './ExpressionActionDropDown';

export interface ExpressionProps {
  title: string;
  actionLabel: string;
  // TODO: manage state and emit changes
}

export const Expression: FunctionComponent<ExpressionProps> = ({ title, actionLabel, children }) => {
  return (
    <div className="slds-expression">
      <h2 className="slds-expression__title">{title}</h2>
      <ExpressionActionDropDown label="" value="AND" onChange={() => {}} />
      <ul>{children}</ul>
      <div className="slds-expression__buttons">
        <button className="slds-button slds-button_neutral">
          <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer={true} />
          Add Condition
        </button>
        <button className="slds-button slds-button_neutral">
          <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer={true} />
          Add Group
        </button>
      </div>
    </div>
  );
};

export default Expression;

import { AndOr } from '@jetstream/types';
import React, { FunctionComponent } from 'react';
import Icon from '../widgets/Icon';
import ExpressionActionDropDown from './ExpressionActionDropDown';

export interface ExpressionProps {
  value: AndOr;
  title?: string;
  actionHelpText?: string;
  actionLabel: string;
  onActionChange: (value: AndOr) => void;
  onAddCondition: () => void;
  onAddGroup: () => void;
}

export const Expression: FunctionComponent<ExpressionProps> = ({
  value,
  title,
  actionLabel,
  actionHelpText,
  children,
  onActionChange,
  onAddCondition,
  onAddGroup,
}) => {
  return (
    <div className="slds-expression">
      {title && <h2 className="slds-expression__title">{title}</h2>}
      <ExpressionActionDropDown label={actionLabel} helpText={actionHelpText} value={value || 'AND'} onChange={onActionChange} />
      <ul>{children}</ul>
      <div className="slds-expression__buttons">
        <button className="slds-button slds-button_neutral" onClick={() => onAddCondition()}>
          <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
          Add Condition
        </button>
        <button className="slds-button slds-button_neutral" onClick={() => onAddGroup()}>
          <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
          Add Group
        </button>
      </div>
    </div>
  );
};

export default Expression;

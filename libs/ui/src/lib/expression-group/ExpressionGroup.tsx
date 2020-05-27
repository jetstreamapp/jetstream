import { AndOr } from '@jetstream/types';
import React, { FunctionComponent } from 'react';
import ExpressionActionDropDown from './ExpressionActionDropDown';
import Icon from '../widgets/Icon';

export interface ExpressionGroupProps {
  group: number;
  parentAction: AndOr;
  onActionChange: (value: AndOr) => void;
  onAddCondition: () => void;
}

export const ExpressionGroup: FunctionComponent<ExpressionGroupProps> = ({
  parentAction,
  group,
  children,
  onActionChange,
  onAddCondition,
}) => {
  return (
    <li className="slds-expression__group">
      <fieldset>
        <legend className="slds-expression__legend slds-expression__legend_group">
          <span>{parentAction}</span>
          <span className="slds-assistive-text">{`Condition Group ${group}`}</span>
        </legend>
        <ExpressionActionDropDown label="" value="AND" onChange={onActionChange} />
        {children}
        <div className="slds-expression__buttons">
          <button className="slds-button slds-button_neutral" onClick={() => onAddCondition()}>
            <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer={true} />
            Add Condition
          </button>
        </div>
      </fieldset>
    </li>
  );
};

export default ExpressionGroup;

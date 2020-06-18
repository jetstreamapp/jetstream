import React, { FunctionComponent } from 'react';
import Icon from '../../widgets/Icon';
import { IconObj } from '@jetstream/types';

export interface FormRowButtonProps {
  title: string;
  icon: IconObj;
  onClick: () => void;
}

/**
 * This is used when a button is inline on a form where there needs to be top-margin to align with the inputs
 * (e.x. ExpressionConditionRow)
 */
export const FormRowButton: FunctionComponent<FormRowButtonProps> = ({ title, icon, onClick, children }) => {
  return (
    <div className="slds-form-element">
      <span className="slds-form-element__label" style={{ marginTop: `15px` }} />
      <div className="slds-form-element__control">
        <button className="slds-button slds-button_icon slds-button_icon-border-filled" title={title} onClick={() => onClick()}>
          <Icon
            type={icon.type}
            icon={icon.icon}
            description={icon.description || title}
            className="slds-button__icon"
            omitContainer={true}
          />
        </button>
      </div>
    </div>
  );
};

export default FormRowButton;

import { IconObj } from '@jetstream/icon-factory';
import React, { FunctionComponent } from 'react';
import Icon from '../../widgets/Icon';
import { ariaDisabledButtonProps } from './aria-disabled-button.utils';

export interface FormRowButtonProps {
  title: string;
  icon: IconObj;
  /**
   * Applied as aria-disabled so the button stays focusable: a row action (e.g. Move Up into the first row) can
   * disable the very button that was just pressed, and native disabled would drop focus to <body>
   */
  disabled?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

/**
 * This is used when a button is inline on a form where there needs to be top-margin to align with the inputs
 * (e.x. ExpressionConditionRow)
 */
export const FormRowButton: FunctionComponent<FormRowButtonProps> = ({ title, icon, disabled, onClick }) => {
  return (
    <div className="slds-form-element">
      {/* Invisible label mirrors the real labels' exact height so the button aligns with sibling
          inputs — the old fixed 15px margin sat a couple px short of a real label row */}
      <span className="slds-form-element__label" aria-hidden="true" style={{ visibility: 'hidden' }}>
        &nbsp;
      </span>
      <div className="slds-form-element__control">
        <button
          type="button"
          className="slds-button slds-button_icon slds-button_icon-border-filled"
          title={title}
          {...ariaDisabledButtonProps(disabled, () => onClick())}
        >
          <Icon type={icon.type} icon={icon.icon} description={icon.description || title} className="slds-button__icon" omitContainer />
        </button>
      </div>
    </div>
  );
};

export default FormRowButton;

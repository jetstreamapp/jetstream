import React, { FunctionComponent } from 'react';
import classNames from 'classnames';

export interface CheckboxProps {
  id: string;
  checked: boolean;
  label: string;
  hideLabel?: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

export const Checkbox: FunctionComponent<CheckboxProps> = ({ id, checked, label, disabled = false, hideLabel = false, onChange }) => {
  return (
    <div className="slds-form-element">
      <div className="slds-form-element__control">
        <div className="slds-checkbox">
          <input
            type="checkbox"
            name="options"
            id={id}
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <label className="slds-checkbox__label" htmlFor={id}>
            <span className="slds-checkbox_faux"></span>
            <span className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })}>{label}</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default Checkbox;

import React, { FunctionComponent } from 'react';
import classNames from 'classnames';

export interface CheckboxCheckboxToggleProps {
  id: string;
  checked: boolean;
  label: string;
  hideLabel?: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

export const CheckboxToggle: FunctionComponent<CheckboxCheckboxToggleProps> = ({
  id,
  checked,
  label,
  disabled = false,
  hideLabel = false,
  onChange,
}) => {
  return (
    <div className="slds-form-element">
      <label className="slds-checkbox_toggle slds-grid">
        {!hideLabel && <span className="slds-form-element__label slds-m-bottom_none">{label}</span>}
        <input type="checkbox" name="checkbox-toggle-16" value="checkbox-toggle-16" />
        <input
          type="checkbox"
          name="options"
          aria-describedby={id}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span id={id} className="slds-checkbox_faux_container" aria-live="assertive">
          <span className="slds-checkbox_faux"></span>
          <span className="slds-checkbox_on">Enabled</span>
          <span className="slds-checkbox_off">Disabled</span>
        </span>
      </label>
    </div>
  );
};

export default CheckboxToggle;

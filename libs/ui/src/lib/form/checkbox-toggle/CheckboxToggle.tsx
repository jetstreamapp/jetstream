import React, { FunctionComponent } from 'react';
import { RightLeft } from '@jetstream/types';

export interface CheckboxCheckboxToggleProps {
  id: string;
  checked: boolean;
  label: string;
  hideLabel?: boolean;
  disabled?: boolean;
  labelPosition?: RightLeft;
  onChange?: (value: boolean) => void;
}

export const CheckboxToggle: FunctionComponent<CheckboxCheckboxToggleProps> = ({
  id,
  checked,
  label,
  disabled = false,
  hideLabel = false,
  labelPosition = 'left',
  onChange,
}) => {
  return (
    <div className="slds-form-element">
      <label className="slds-checkbox_toggle slds-grid">
        {!hideLabel && labelPosition === 'left' && <span className="slds-form-element__label slds-m-bottom_none">{label}</span>}
        <input
          type="checkbox"
          name={id}
          aria-describedby={id}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange && onChange(event.target.checked)}
        />
        <span id={id} className="slds-checkbox_faux_container" aria-live="assertive">
          <span className="slds-checkbox_faux"></span>
          <span className="slds-checkbox_on">Enabled</span>
          <span className="slds-checkbox_off">Disabled</span>
        </span>
        {!hideLabel && labelPosition === 'right' && (
          <span className="slds-form-element__label slds-m-left_xx-small slds-m-bottom_none">{label}</span>
        )}
      </label>
    </div>
  );
};

export default CheckboxToggle;

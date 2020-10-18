import React, { FunctionComponent } from 'react';
import { RightLeft } from '@jetstream/types';
import classNames from 'classnames';

export interface CheckboxCheckboxToggleProps {
  id: string;
  checked: boolean;
  label: string;
  hideLabel?: boolean;
  disabled?: boolean;
  labelPosition?: RightLeft;
  onText?: string;
  offText?: string;
  containerClassname?: string;
  labelClassname?: string;
  onChange?: (value: boolean) => void;
}

export const CheckboxToggle: FunctionComponent<CheckboxCheckboxToggleProps> = ({
  id,
  checked,
  label,
  disabled = false,
  hideLabel = false,
  labelPosition = 'left',
  onText = 'Enabled',
  offText = 'Disabled',
  containerClassname,
  labelClassname,
  onChange,
}) => {
  return (
    <div className={classNames('slds-form-element', containerClassname)}>
      <label className={classNames('slds-checkbox_toggle slds-grid', labelClassname)}>
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
          <span className="slds-checkbox_on">{onText}</span>
          <span className="slds-checkbox_off">{offText}</span>
        </span>
        {!hideLabel && labelPosition === 'right' && (
          <span className="slds-form-element__label slds-m-left_xx-small slds-m-bottom_none">{label}</span>
        )}
      </label>
    </div>
  );
};

export default CheckboxToggle;

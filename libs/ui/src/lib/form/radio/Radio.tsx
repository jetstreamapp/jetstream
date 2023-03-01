import React, { FunctionComponent } from 'react';
import uniqueId from 'lodash/uniqueId';
/* eslint-disable-next-line */
export interface RadioProps {
  idPrefix?: string;
  id?: string;
  name: string;
  label: string | JSX.Element;
  checked: boolean;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export const Radio: FunctionComponent<RadioProps> = ({
  id = uniqueId('radio'),
  idPrefix = uniqueId('pref'),
  name,
  label,
  value,
  checked,
  disabled,
  onChange,
}) => {
  return (
    <span className="slds-radio">
      <input
        type="radio"
        id={id}
        value={value}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        aria-describedby={`${idPrefix}-label-help-text ${idPrefix}-error-message`}
      />
      <label className="slds-radio__label" htmlFor={id}>
        <span className="slds-radio_faux" style={{ marginRight: '0.5rem' }}></span>
        <span className="slds-form-element__label">{label}</span>
      </label>
    </span>
  );
};

export default Radio;

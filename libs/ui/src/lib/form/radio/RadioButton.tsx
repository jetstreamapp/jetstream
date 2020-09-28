import React, { FunctionComponent } from 'react';
import uniqueId from 'lodash/uniqueId';
import classNames from 'classnames';

/* eslint-disable-next-line */
export interface RadioButtonProps {
  id?: string;
  className?: string;
  name: string;
  label: string;
  checked: boolean;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export const RadioButton: FunctionComponent<RadioButtonProps> = ({
  id = uniqueId('radio'),
  className,
  name,
  label,
  value,
  checked,
  disabled,
  onChange,
}) => {
  return (
    <span className={classNames('slds-button slds-radio_button', className)}>
      <input type="radio" id={id} value={value} name={name} checked={checked} disabled={disabled} onChange={() => onChange(value)} />
      <label className="slds-radio_button__label" htmlFor={id}>
        <span className="slds-radio_faux">{label}</span>
      </label>
    </span>
  );
};

export default RadioButton;

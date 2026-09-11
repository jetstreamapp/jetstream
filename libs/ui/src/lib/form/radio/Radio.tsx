import uniqueId from 'lodash/uniqueId';
import { FunctionComponent } from 'react';

export interface RadioProps {
  idPrefix?: string;
  id?: string;
  name: string;
  label: string | React.ReactNode;
  checked: boolean;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export const Radio: FunctionComponent<RadioProps> = ({
  id = uniqueId('radio'),
  idPrefix,
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
        // Only when the caller shares its RadioGroup's idPrefix: a defaulted prefix referenced ids that
        // never exist (the group's fieldset already carries the help/error association)
        aria-describedby={idPrefix ? `${idPrefix}-label-help-text ${idPrefix}-error-message` : undefined}
      />
      <label className="slds-radio__label" htmlFor={id}>
        <span className="slds-radio_faux" style={{ marginRight: '0.5rem' }}></span>
        <span className="slds-form-element__label">{label}</span>
      </label>
    </span>
  );
};

export default Radio;

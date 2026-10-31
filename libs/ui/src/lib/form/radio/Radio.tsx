import uniqueId from 'lodash/uniqueId';
import { FunctionComponent } from 'react';

export interface RadioProps {
  id?: string;
  name: string;
  label: string | React.ReactNode;
  checked: boolean;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export const Radio: FunctionComponent<RadioProps> = ({ id = uniqueId('radio'), name, label, value, checked, disabled, onChange }) => {
  return (
    <span className="slds-radio">
      <input type="radio" id={id} value={value} name={name} checked={checked} disabled={disabled} onChange={() => onChange(value)} />
      <label className="slds-radio__label" htmlFor={id}>
        <span className="slds-radio_faux" style={{ marginRight: '0.5rem' }}></span>
        <span className="slds-form-element__label">{label}</span>
      </label>
    </span>
  );
};

export default Radio;

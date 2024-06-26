import { RadioButton, RadioGroup } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface RadioButtonItem<T = string> {
  name: T;
  label: string;
  value: T;
}

export interface RadioButtonSelectionProps {
  label: string;
  items: RadioButtonItem[];
  checkedValue: string;
  disabled?: boolean;
  labelHelp?: string | null;
  onChange: (value: string) => void;
}

export const RadioButtonSelection: FunctionComponent<RadioButtonSelectionProps> = ({
  label,
  items,
  checkedValue,
  disabled,
  labelHelp,
  onChange,
}) => {
  return (
    <RadioGroup label={label} labelHelp={labelHelp} isButtonGroup formControlClassName="slds-align_absolute-center">
      {items.map((item) => (
        <RadioButton
          key={item.value}
          name={label}
          label={item.label}
          value={item.value}
          disabled={disabled}
          checked={item.value === checkedValue}
          onChange={onChange}
        />
      ))}
    </RadioGroup>
  );
};

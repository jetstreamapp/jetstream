import { RightLeft } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, HTMLAttributes } from 'react';
import HelpText from '../../widgets/HelpText';

export interface CheckboxCheckboxToggleProps {
  id: string;
  checked: boolean;
  label: string;
  labelHelp?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  labelPosition?: RightLeft;
  onText?: string;
  offText?: string;
  containerClassname?: string;
  labelClassname?: string;
  /** Id of an element that describes the toggle, announced after its label */
  ariaDescribedBy?: string;
  extraProps?: HTMLAttributes<HTMLDivElement>;
  onChange?: (value: boolean) => void;
}

export const CheckboxToggle: FunctionComponent<CheckboxCheckboxToggleProps> = ({
  id,
  checked,
  label,
  labelHelp,
  disabled = false,
  hideLabel = false,
  labelPosition = 'left',
  onText = 'Enabled',
  offText = 'Disabled',
  containerClassname,
  labelClassname,
  ariaDescribedBy,
  extraProps,
  onChange,
}) => {
  const handleChange = () => {
    if (disabled || !onChange) {
      return;
    }
    onChange(!checked);
  };

  return (
    <div className={classNames('slds-form-element', containerClassname)} {...extraProps}>
      <label className={classNames('slds-checkbox_toggle slds-grid', labelClassname)} onClick={(ev) => ev.preventDefault()}>
        {/* A hidden label still names the toggle for screen readers, matching the other form controls */}
        {hideLabel && <span className="slds-assistive-text">{label}</span>}
        {!hideLabel && labelPosition === 'left' && (
          <span className="slds-form-element__label slds-m-bottom_none" onClick={handleChange}>
            {label}
          </span>
        )}
        {labelHelp && <HelpText id={`${id}-label-help-text`} className="slds-m-right_xx-small" content={labelHelp} />}
        <input
          type="checkbox"
          name={id}
          aria-describedby={ariaDescribedBy ? `${id} ${ariaDescribedBy}` : id}
          checked={checked}
          disabled={disabled}
          onChange={(_ex) => handleChange()}
        />
        <span id={id} className="slds-checkbox_faux_container" aria-live="assertive" onClick={handleChange}>
          <span className="slds-checkbox_faux"></span>
          <span className="slds-checkbox_on">{onText}</span>
          <span className="slds-checkbox_off">{offText}</span>
        </span>
        {!hideLabel && labelPosition === 'right' && (
          <span className="slds-form-element__label slds-m-left_xx-small slds-m-bottom_none" onClick={handleChange}>
            {label}
          </span>
        )}
      </label>
    </div>
  );
};

export default CheckboxToggle;

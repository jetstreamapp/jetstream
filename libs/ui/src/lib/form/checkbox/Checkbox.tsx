import React, { FunctionComponent, RefObject } from 'react';
import classNames from 'classnames';
import HelpText from '../../widgets/HelpText';

export interface CheckboxProps {
  inputRef?: RefObject<HTMLInputElement>;
  id: string;
  checked: boolean;
  label: string;
  hideLabel?: boolean;
  labelHelp?: string;
  helpText?: React.ReactNode | string;
  disabled?: boolean;
  readOnly?: boolean;
  hasError?: boolean;
  isRequired?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  onChange?: (value: boolean) => void;
}

export const Checkbox: FunctionComponent<CheckboxProps> = ({
  inputRef,
  id,
  checked,
  label,
  labelHelp,
  helpText,
  hasError = false,
  isRequired = false,
  errorMessageId,
  errorMessage,
  disabled = false,
  readOnly = false,
  hideLabel = false,
  onChange,
}) => {
  return (
    <div className={classNames('slds-form-element', { 'slds-has-error': hasError })}>
      <div className="slds-form-element__control">
        <div className="slds-checkbox">
          {isRequired && (
            <abbr className="slds-required" title="required">
              *{' '}
            </abbr>
          )}
          <input
            ref={inputRef}
            type="checkbox"
            name="options"
            id={id}
            checked={checked}
            disabled={disabled}
            readOnly={readOnly}
            aria-describedby={errorMessageId}
            onChange={(event) => onChange && onChange(event.target.checked)}
          />
          <label className="slds-checkbox__label" htmlFor={id}>
            <span className="slds-checkbox_faux"></span>
            <span className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })}>{label}</span>
            {labelHelp && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
          </label>
        </div>
      </div>
      {helpText && <div className="slds-form-element__help">{helpText}</div>}
      {hasError && errorMessage && (
        <div className="slds-form-element__help" id={errorMessageId}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default Checkbox;

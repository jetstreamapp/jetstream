import React, { FunctionComponent } from 'react';
import classNames from 'classnames';

export interface RadioGroupProps {
  className?: string;
  label: string;
  required?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

export const RadioGroup: FunctionComponent<RadioGroupProps> = ({ className, label, required, hasError, errorMessage, children }) => {
  return (
    <fieldset className={classNames('slds-form-element', { 'slds-has-error': hasError }, className)}>
      <legend className="slds-form-element__legend slds-form-element__label">
        {required && (
          <abbr className="slds-required" title="required">
            *
          </abbr>
        )}
        {label}
      </legend>
      <div className="slds-form-element__control">{children}</div>
      {hasError && errorMessage && (
        <div id={`${label}-error-message`} className="slds-form-element__help">
          {errorMessage}
        </div>
      )}
    </fieldset>
  );
};

export default RadioGroup;

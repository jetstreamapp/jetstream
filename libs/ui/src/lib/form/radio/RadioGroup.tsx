import React, { FunctionComponent } from 'react';
import classNames from 'classnames';
import HelpText from '../../widgets/HelpText';

export interface RadioGroupProps {
  idPrefix?: string;
  className?: string;
  formControlClassName?: string;
  label: string;
  labelHelp?: string;
  required?: boolean;
  hasError?: boolean;
  isButtonGroup?: boolean;
  errorMessage?: string;
}

export const RadioGroup: FunctionComponent<RadioGroupProps> = ({
  idPrefix,
  className,
  formControlClassName,
  label,
  labelHelp,
  required,
  hasError,
  errorMessage,
  isButtonGroup,
  children,
}) => {
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
      {labelHelp && <HelpText id={`${idPrefix}-label-help-text`} content={labelHelp} />}
      <div className={classNames('slds-form-element__control', formControlClassName)}>
        {isButtonGroup && <div className="slds-radio_button-group">{children}</div>}
        {!isButtonGroup && children}
      </div>
      {hasError && errorMessage && (
        <div id={`${idPrefix}-error-message`} className="slds-form-element__help">
          {errorMessage}
        </div>
      )}
    </fieldset>
  );
};

export default RadioGroup;

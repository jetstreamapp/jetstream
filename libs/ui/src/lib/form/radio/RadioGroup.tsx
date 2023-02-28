import classNames from 'classnames';
import React, { Fragment, FunctionComponent } from 'react';
import { useFormIds } from '../../hooks/useFormIds';
import HelpText from '../../widgets/HelpText';

export interface RadioGroupProps {
  idPrefix?: string;
  className?: string;
  formControlClassName?: string;
  helpTextClassName?: string;
  label?: string;
  labelHelp?: string | JSX.Element | null;
  helpText?: string | JSX.Element;
  required?: boolean;
  hasError?: boolean;
  isButtonGroup?: boolean;
  errorMessage?: string | null;
  children?: React.ReactNode;
}

export const RadioGroup: FunctionComponent<RadioGroupProps> = ({
  idPrefix,
  className,
  formControlClassName,
  helpTextClassName,
  label,
  labelHelp,
  helpText,
  required,
  hasError,
  errorMessage,
  isButtonGroup,
  children,
}) => {
  const { formId, ariaDescribedbyText, labelHelpId, helpTextId, errorMessageId } = useFormIds(idPrefix);

  return (
    <fieldset className={classNames('slds-form-element', { 'slds-has-error': hasError }, className)} aria-describedby={ariaDescribedbyText}>
      {label && (
        <Fragment>
          <legend className="slds-form-element__legend slds-form-element__label">
            {required && (
              <abbr className="slds-required" title="required">
                *
              </abbr>
            )}
            {label}
          </legend>
          {labelHelp && <HelpText id={labelHelpId} content={labelHelp} />}
        </Fragment>
      )}
      <div className={classNames('slds-form-element__control', formControlClassName)}>
        {isButtonGroup && <div className="slds-radio_button-group">{children}</div>}
        {!isButtonGroup && children}
      </div>
      {helpText && (
        <div id={helpTextId} className={classNames('slds-form-element__help', helpTextClassName)}>
          {helpText}
        </div>
      )}
      {hasError && errorMessage && (
        <div id={errorMessageId} className="slds-form-element__help">
          {errorMessage}
        </div>
      )}
    </fieldset>
  );
};

export default RadioGroup;

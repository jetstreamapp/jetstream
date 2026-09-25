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
  /** Keeps the label for screen readers only */
  hideLabel?: boolean;
  /** Id of an element outside the group that describes it */
  ariaDescribedBy?: string;
  labelHelp?: string | React.ReactNode | null;
  helpText?: string | React.ReactNode;
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
  hideLabel = false,
  ariaDescribedBy,
  labelHelp,
  helpText,
  required,
  hasError,
  errorMessage,
  isButtonGroup,
  children,
}) => {
  const { ariaDescribedbyText, labelHelpId, helpTextId, errorMessageId } = useFormIds(idPrefix);

  return (
    <fieldset
      className={classNames('slds-form-element', { 'slds-has-error': hasError, 'slds-is-required': required }, className)}
      aria-describedby={ariaDescribedBy ? `${ariaDescribedbyText} ${ariaDescribedBy}` : ariaDescribedbyText}
    >
      {label && (
        <Fragment>
          <legend className={classNames('slds-form-element__legend slds-form-element__label', { 'slds-assistive-text': hideLabel })}>
            {required && (
              <abbr className="slds-required" title="required">
                *
              </abbr>
            )}
            {label}
          </legend>
          {labelHelp && !hideLabel && <HelpText id={labelHelpId} content={labelHelp} />}
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

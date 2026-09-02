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
  labelHelp,
  helpText,
  required,
  hasError,
  errorMessage,
  isButtonGroup,
  children,
}) => {
  const { labelHelpId, helpTextId, errorMessageId, legendId } = useFormIds(idPrefix);
  // Only reference the description elements that are actually rendered
  const ariaDescribedbyText =
    [labelHelp && labelHelpId, helpText && helpTextId, hasError && errorMessage && errorMessageId].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset
      className={classNames('slds-form-element', { 'slds-has-error': hasError, 'slds-is-required': required }, className)}
      // Explicit role + labelledby: screen readers announce the group label when focus enters,
      // which plain fieldset/legend does unreliably in VoiceOver — vital when adjacent groups
      // share value labels (e.g. two filter groups both starting with "All")
      role="radiogroup"
      aria-labelledby={label ? legendId : undefined}
      aria-describedby={ariaDescribedbyText}
      aria-invalid={hasError || undefined}
    >
      {label && (
        <Fragment>
          <legend id={legendId} className="slds-form-element__legend slds-form-element__label">
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

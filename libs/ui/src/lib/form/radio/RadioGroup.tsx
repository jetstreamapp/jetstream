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
  /** Keep the label for assistive technology only, for a group whose purpose is already clear on screen */
  hideLabel?: boolean;
  labelHelp?: string | React.ReactNode | null;
  helpText?: string | React.ReactNode;
  required?: boolean;
  hasError?: boolean;
  isButtonGroup?: boolean;
  errorMessage?: string | null;
  /**
   * Set when the group also holds controls that are not radios (a checkbox, an upgrade button, a file
   * picker). The fieldset then keeps its native group role: a radiogroup role would present those controls
   * as part of a set of radio buttons.
   */
  hasNonRadioControls?: boolean;
  children?: React.ReactNode;
}

export const RadioGroup: FunctionComponent<RadioGroupProps> = ({
  idPrefix,
  className,
  formControlClassName,
  helpTextClassName,
  label,
  hideLabel,
  labelHelp,
  helpText,
  required,
  hasError,
  errorMessage,
  isButtonGroup,
  hasNonRadioControls,
  children,
}) => {
  const { labelHelpId, helpTextId, errorMessageId, legendId } = useFormIds(idPrefix);
  // Only reference the description elements that are actually rendered
  const ariaDescribedbyText =
    [labelHelp && !hideLabel && labelHelpId, helpText && helpTextId, hasError && errorMessage && errorMessageId]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <fieldset
      className={classNames('slds-form-element', { 'slds-has-error': hasError, 'slds-is-required': required }, className)}
      // Explicit role + labelledby: screen readers announce the group label when focus enters,
      // which plain fieldset/legend does unreliably in VoiceOver — vital when adjacent groups
      // share value labels (e.g. two filter groups both starting with "All")
      role={hasNonRadioControls ? undefined : 'radiogroup'}
      aria-labelledby={label ? legendId : undefined}
      aria-describedby={ariaDescribedbyText}
      aria-invalid={hasError || undefined}
    >
      {label && (
        <Fragment>
          <legend
            id={legendId}
            className={classNames('slds-form-element__legend slds-form-element__label', { 'slds-assistive-text': hideLabel })}
          >
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

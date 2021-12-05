import classNames from 'classnames';
import React, { Fragment, FunctionComponent, RefObject } from 'react';
import HelpText from '../../widgets/HelpText';

export interface CheckboxProps {
  inputRef?: RefObject<HTMLInputElement>;
  id: string;
  className?: string;
  checkboxClassName?: string;
  checked: boolean;
  label: string;
  hideLabel?: boolean;
  labelHelp?: string | JSX.Element;
  helpText?: React.ReactNode | string;
  disabled?: boolean;
  readOnly?: boolean;
  hasError?: boolean;
  isRequired?: boolean;
  isStandAlone?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  onChange?: (value: boolean) => void;
  onBlur?: () => void;
}

export const Checkbox: FunctionComponent<CheckboxProps> = ({
  inputRef,
  id,
  className,
  checkboxClassName,
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
  isStandAlone = false,
  onChange,
  onBlur,
}) => {
  return (
    <div className={classNames('slds-form-element', className, { 'slds-has-error': hasError })}>
      {isStandAlone && (
        <Fragment>
          <label className="slds-form-element__label" htmlFor={id}>
            {isRequired && (
              <abbr className="slds-required" title="required">
                *{' '}
              </abbr>
            )}
            {label}
          </label>
          {labelHelp && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
        </Fragment>
      )}
      <div className="slds-form-element__control">
        <div className={classNames('slds-checkbox', { 'slds-checkbox_standalone': isStandAlone }, checkboxClassName)}>
          {isRequired && !isStandAlone && (
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
            disabled={readOnly || disabled}
            readOnly={readOnly}
            aria-describedby={errorMessageId}
            onChange={(event) => onChange && onChange(event.target.checked)}
            onBlur={onBlur}
          />
          {isStandAlone && <span className="slds-checkbox_faux"></span>}
          {!isStandAlone && (
            <Fragment>
              <label className="slds-checkbox__label" htmlFor={id}>
                <span className="slds-checkbox_faux"></span>
                <span className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })}>{label}</span>
              </label>
              {labelHelp && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
            </Fragment>
          )}
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

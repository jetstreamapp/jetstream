import classNames from 'classnames';
import React, { Fragment, FunctionComponent, RefObject, SyntheticEvent, useEffect, useRef } from 'react';
import HelpText from '../../widgets/HelpText';

export interface CheckboxProps {
  inputRef?: RefObject<HTMLInputElement>;
  id: string;
  className?: string;
  checkboxClassName?: string;
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  hideLabel?: boolean;
  labelHelp?: string | JSX.Element | null;
  helpText?: React.ReactNode | string;
  disabled?: boolean;
  readOnly?: boolean;
  hasError?: boolean;
  isRequired?: boolean;
  isStandAlone?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  onChange?: (value: boolean) => void;
  onChangeNative?: (event: SyntheticEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
}

export const Checkbox: FunctionComponent<CheckboxProps> = ({
  inputRef,
  id,
  className,
  checkboxClassName,
  checked,
  indeterminate,
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
  onChangeNative,
  onBlur,
}) => {
  // alternative in case parent does not include this property
  const localInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof indeterminate === 'boolean') {
      if (inputRef?.current) {
        inputRef.current.indeterminate = !checked && indeterminate;
      }

      if (localInputRef?.current) {
        localInputRef.current.indeterminate = !checked && indeterminate;
      }
    }
  }, [inputRef, localInputRef, indeterminate, checked]);

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
            ref={inputRef || localInputRef}
            type="checkbox"
            name="options"
            id={id}
            checked={checked || false}
            disabled={readOnly || disabled}
            readOnly={readOnly}
            aria-describedby={errorMessageId}
            onChange={(event) => {
              onChange && onChange(event.target?.checked || false);
              onChangeNative && onChangeNative(event);
            }}
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

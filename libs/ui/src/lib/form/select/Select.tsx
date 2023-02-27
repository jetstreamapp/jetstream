import React, { FunctionComponent, Fragment, ReactNode } from 'react';
import HelpText from '../../widgets/HelpText';
import classNames from 'classnames';

export interface SelectProps {
  id: string;
  className?: string;
  label?: string | ReactNode;
  labelHelp?: string | null;
  helpText?: React.ReactNode | string;
  hasError?: boolean;
  isRequired?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  children?: React.ReactNode;
}

export const Select: FunctionComponent<SelectProps> = ({
  id,
  className,
  label,
  labelHelp,
  helpText,
  hasError,
  isRequired,
  errorMessageId,
  errorMessage,
  children,
}) => {
  return (
    <div className={classNames('slds-form-element', { 'slds-has-error': hasError }, className)}>
      {label && (
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
        <div className="slds-select_container">{children}</div>
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

export default Select;

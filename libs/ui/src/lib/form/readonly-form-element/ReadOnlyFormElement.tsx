import classNames from 'classnames';
import React, { Fragment, FunctionComponent, ReactNode } from 'react';
import HelpText from '../../widgets/HelpText';

export interface ReadOnlyFormElementProps {
  id: string;
  className?: string;
  label?: string | ReactNode;
  labelHelp?: string | null;
  helpText?: React.ReactNode | string;
  hasError?: boolean;
  isRequired?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  value: string;
  bottomBorder?: boolean;
}

/**
 * Should not be used for normal <input> elements, as they have a different read-only style
 */
export const ReadOnlyFormElement: FunctionComponent<ReadOnlyFormElementProps> = ({
  id,
  className,
  label,
  labelHelp,
  helpText,
  hasError,
  isRequired,
  errorMessageId,
  errorMessage,
  value,
  bottomBorder,
}) => {
  return (
    <div className={classNames('slds-form-element', className, { 'slds-has-error': hasError })}>
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
      <div id={id} className={classNames('slds-form-element__control', { 'slds-border_bottom': bottomBorder })}>
        <div className="slds-form-element__static">
          <p>{value}</p>
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

export default ReadOnlyFormElement;

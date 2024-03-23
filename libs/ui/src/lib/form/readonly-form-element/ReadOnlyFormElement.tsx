import { Field, Maybe, RecordAttributes } from '@jetstream/types';
import classNames from 'classnames';
import React, { Fragment, FunctionComponent, ReactNode } from 'react';
import HelpText from '../../widgets/HelpText';

export interface ReadOnlyFormElementProps {
  id: string;
  className?: string;
  metadata?: Field;
  label?: string | ReactNode;
  labelHelp?: string | null;
  helpText?: React.ReactNode | string;
  hasError?: boolean;
  isRequired?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  value: Maybe<string>;
  bottomBorder?: boolean;
  relatedRecord?: Maybe<{ attributes: RecordAttributes; Name: string }>;
  viewRelatedRecord?: (recordId: string, metadata: Field) => void;
}

/**
 * Should not be used for normal <input> elements, as they have a different read-only style
 */
export const ReadOnlyFormElement: FunctionComponent<ReadOnlyFormElementProps> = ({
  id,
  className,
  metadata,
  label,
  labelHelp,
  helpText,
  hasError,
  isRequired,
  errorMessageId,
  errorMessage,
  value,
  bottomBorder,
  relatedRecord,
  viewRelatedRecord,
}) => {
  const showViewLookup =
    viewRelatedRecord && relatedRecord?.Name && metadata?.type === 'reference' && metadata.referenceTo && metadata.referenceTo?.length > 0;

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
          {value && showViewLookup ? (
            <>
              <button className="slds-button" onClick={() => viewRelatedRecord(value, metadata)} title="View related record">
                {relatedRecord.Name}
              </button>
              <span className="slds-m-left_xx-small">({value})</span>
            </>
          ) : (
            <p>{relatedRecord?.Name ? `${relatedRecord.Name} (${value})` : value}</p>
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

export default ReadOnlyFormElement;

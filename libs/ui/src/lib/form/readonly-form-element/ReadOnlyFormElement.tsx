import { Field, Maybe, RecordAttributes } from '@jetstream/types';
import classNames from 'classnames';
import isString from 'lodash/isString';
import React, { Fragment, FunctionComponent, ReactNode } from 'react';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';

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
  value: Maybe<string | number | boolean>;
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

  const displayValue =
    typeof value === 'boolean' ? (
      <Icon
        type="utility"
        icon={value ? 'check' : 'steps'}
        title={value ? 'True' : 'False'}
        className="slds-icon slds-icon_x-small"
        containerClassname={classNames('slds-icon_container slds-current-color', {
          'slds-icon-utility-steps': !value,
          'slds-icon-utility-check': value,
        })}
      />
    ) : (
      value
    );

  return (
    <div className={classNames('slds-form-element', className, { 'slds-has-error': hasError })}>
      {label && (
        <Fragment>
          <span className="slds-form-element__label">
            {isRequired && (
              <abbr className="slds-required" title="required">
                *{' '}
              </abbr>
            )}
            {label}
          </span>
          {labelHelp && <HelpText content={labelHelp} />}
        </Fragment>
      )}
      <div id={id} className={classNames('slds-form-element__control', { 'slds-border_bottom': bottomBorder })}>
        <div className="slds-form-element__static">
          {isString(value) && showViewLookup ? (
            <>
              <button className="slds-button" onClick={() => viewRelatedRecord(value, metadata)} title="View related record">
                {relatedRecord.Name}
              </button>
              <span className="slds-m-left_xx-small">({value})</span>
            </>
          ) : (
            <p>{relatedRecord?.Name ? `${relatedRecord.Name} (${value})` : displayValue}</p>
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

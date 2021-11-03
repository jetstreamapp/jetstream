import classNames from 'classnames';
import React, { FunctionComponent } from 'react';

export interface FormRowProps {
  className?: string;
}

export const FormRow: FunctionComponent<FormRowProps> = ({ className, children }) => {
  return <div className={classNames('slds-form__row', className)}>{children}</div>;
};

export default FormRow;

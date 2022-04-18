import classNames from 'classnames';
import React, { FunctionComponent } from 'react';

export interface FormProps {
  className?: string;
  children?: React.ReactNode;
}

export const Form: FunctionComponent<FormProps> = ({ className, children }) => {
  return (
    <div className={classNames('slds-form', className)} role="list">
      {children}
    </div>
  );
};

export default Form;

import classNames from 'classnames';
import React, { FunctionComponent } from 'react';

export interface FormRowItemProps {
  className?: string;
}

export const FormRowItem: FunctionComponent<FormRowItemProps> = ({ className, children }) => {
  return (
    <div className={classNames('slds-form__item', className)} role="listitem">
      {children}
    </div>
  );
};

export default FormRowItem;

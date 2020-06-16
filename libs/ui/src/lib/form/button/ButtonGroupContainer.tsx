import React, { FunctionComponent } from 'react';
import classNames from 'classnames';

export interface ButtonGroupContainerProps {
  className?: string;
}

export const ButtonGroupContainer: FunctionComponent<ButtonGroupContainerProps> = ({ className, children }) => {
  return (
    <div className={classNames('slds-button-group', className)} role="group">
      {children}
    </div>
  );
};

export default ButtonGroupContainer;

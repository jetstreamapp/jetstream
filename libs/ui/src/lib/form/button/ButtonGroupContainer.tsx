import React, { FunctionComponent } from 'react';

export const ButtonGroupContainer: FunctionComponent = ({ children }) => {
  return (
    <div className="slds-button-group" role="group">
      {children}
    </div>
  );
};

export default ButtonGroupContainer;

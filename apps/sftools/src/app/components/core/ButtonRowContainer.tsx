import React, { FunctionComponent } from 'react';

export const ButtonRowContainer: FunctionComponent = ({ children }) => {
  return <ul className="slds-button-group-row">{children}</ul>;
};

export default ButtonRowContainer;

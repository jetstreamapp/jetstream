import React, { FunctionComponent } from 'react';

export const ButtonRowItem: FunctionComponent = ({ children }) => {
  return <li className="slds-button-group-item">{children}</li>;
};

export default ButtonRowItem;

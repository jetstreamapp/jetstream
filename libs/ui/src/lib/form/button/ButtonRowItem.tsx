import React, { FunctionComponent } from 'react';

export interface ButtonRowItemProps {
  children?: React.ReactNode;
}

export const ButtonRowItem: FunctionComponent<ButtonRowItemProps> = ({ children }) => {
  return <li className="slds-button-group-item">{children}</li>;
};

export default ButtonRowItem;

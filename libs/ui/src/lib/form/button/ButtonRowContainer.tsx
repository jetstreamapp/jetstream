import React, { FunctionComponent } from 'react';

export interface ButtonRowContainerProps {
  children?: React.ReactNode;
}

export const ButtonRowContainer: FunctionComponent<ButtonRowContainerProps> = ({ children }) => {
  return <ul className="slds-button-group-row">{children}</ul>;
};

export default ButtonRowContainer;

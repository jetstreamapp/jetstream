import React, { FunctionComponent } from 'react';

export interface ToolbarItemGroupProps {
  children?: React.ReactNode;
}

export const ToolbarItemGroup: FunctionComponent<ToolbarItemGroupProps> = ({ children }) => {
  return (
    <div className="slds-builder-toolbar__item-group" aria-label="Canvas Actions">
      {children}
    </div>
  );
};

export default ToolbarItemGroup;

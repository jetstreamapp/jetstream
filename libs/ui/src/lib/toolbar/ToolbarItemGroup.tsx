import React, { FunctionComponent } from 'react';

export interface ToolbarItemGroupProps extends React.ClassAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const ToolbarItemGroup: FunctionComponent<ToolbarItemGroupProps> = ({ children, ...props }) => {
  return (
    <div className="slds-builder-toolbar__item-group" {...props}>
      {children}
    </div>
  );
};

export default ToolbarItemGroup;

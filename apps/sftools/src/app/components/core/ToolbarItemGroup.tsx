import React, { FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ToolbarItemGroupProps {}

export const ToolbarItemGroup: FunctionComponent<ToolbarItemGroupProps> = ({ children }) => {
  return (
    <div className="slds-builder-toolbar__item-group" aria-label="Canvas Actions">
      {children}
    </div>
  );
};

export default ToolbarItemGroup;

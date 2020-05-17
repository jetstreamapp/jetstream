import React, { FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ToolbarProps {}

export const Toolbar: FunctionComponent<ToolbarProps> = ({ children }) => {
  return (
    <div className="slds-builder-toolbar" role="toolbar">
      {children}
    </div>
  );
};

export default Toolbar;

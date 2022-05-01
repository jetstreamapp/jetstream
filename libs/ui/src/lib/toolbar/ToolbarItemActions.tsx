import React, { FunctionComponent } from 'react';

export interface ToolbarItemActionsProps {
  children?: React.ReactNode;
}

export const ToolbarItemActions: FunctionComponent<ToolbarItemActionsProps> = ({ children }) => {
  return (
    <div className="slds-builder-toolbar__actions" aria-label="Actions">
      {children}
    </div>
  );
};

export default ToolbarItemActions;

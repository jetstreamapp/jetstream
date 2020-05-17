import React, { FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ToolbarItemActionsProps {}

export const ToolbarItemActions: FunctionComponent<ToolbarItemActionsProps> = ({ children }) => {
  return (
    <div className="slds-builder-toolbar__actions" aria-label="Actions">
      {children}
    </div>
  );
};

export default ToolbarItemActions;

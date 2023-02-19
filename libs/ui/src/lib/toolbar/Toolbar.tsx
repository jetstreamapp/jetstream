import { css } from '@emotion/react';
import React, { FunctionComponent } from 'react';

export interface ToolbarProps {
  children?: React.ReactNode;
}

export const Toolbar: FunctionComponent<ToolbarProps> = ({ children }) => {
  return (
    <div
      className="slds-builder-toolbar"
      role="toolbar"
      css={css`
        flex-wrap: wrap;
      `}
    >
      {children}
    </div>
  );
};

export default Toolbar;

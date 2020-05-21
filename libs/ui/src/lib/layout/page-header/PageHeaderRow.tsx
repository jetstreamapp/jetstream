/** @jsx jsx */
import { jsx } from '@emotion/core';
import { FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PageHeaderRowProps {}

export const PageHeaderRow: FunctionComponent<PageHeaderRowProps> = ({ children }) => {
  return <div className="slds-page-header__row">{children}</div>;
};

export default PageHeaderRow;

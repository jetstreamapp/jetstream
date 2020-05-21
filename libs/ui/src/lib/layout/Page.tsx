/** @jsx jsx */
import { jsx, css } from '@emotion/core';
import { FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PageProps {}

export const Page: FunctionComponent<PageProps> = ({ children }) => {
  return (
    <div
      className="slds-card slds-card_boundary slds-grid slds-grid--vertical"
      css={css`
        height: 100%;
      `}
    >
      {/* Callee should include a PageHeader and then the page content as children */}
      {children}
    </div>
  );
};

export default Page;

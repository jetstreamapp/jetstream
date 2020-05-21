/** @jsx jsx */
import { jsx, css } from '@emotion/core';
import { FunctionComponent } from 'react';

export interface PageProps {
  className?: string;
}

export const Page: FunctionComponent<PageProps> = ({ className, children }) => {
  return (
    <div
      className={`slds-card slds-card_boundary slds-grid slds-grid--vertical ${className || ''}`}
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

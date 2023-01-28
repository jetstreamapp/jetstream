import { css } from '@emotion/react';
import { FunctionComponent } from 'react';

export interface PageProps {
  className?: string;
  testId?: string;
  children?: React.ReactNode;
}

export const Page: FunctionComponent<PageProps> = ({ className, testId, children }) => {
  return (
    <div
      className={`slds-card slds-card_boundary slds-grid slds-grid--vertical ${className || ''}`}
      css={css`
        height: 100%;
      `}
      data-testid={testId || 'page'}
    >
      {/* Callee should include a PageHeader and then the page content as children */}
      {children}
    </div>
  );
};

export default Page;

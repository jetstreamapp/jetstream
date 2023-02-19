import { css } from '@emotion/react';
import { FunctionComponent } from 'react';

export interface PageHeaderRowProps {
  children?: React.ReactNode;
}

export const PageHeaderRow: FunctionComponent<PageHeaderRowProps> = ({ children }) => {
  return (
    <div
      className="slds-page-header__row"
      css={css`
        flex-wrap: wrap;
      `}
    >
      {children}
    </div>
  );
};

export default PageHeaderRow;

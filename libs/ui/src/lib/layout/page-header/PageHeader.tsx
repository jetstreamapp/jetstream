import { FunctionComponent } from 'react';

export interface PageHeaderProps {
  children?: React.ReactNode;
}

export const PageHeader: FunctionComponent<PageHeaderProps> = ({ children }) => {
  return (
    <div className="slds-border_bottom">
      <div className="slds-page-header">{children}</div>
    </div>
  );
};

export default PageHeader;

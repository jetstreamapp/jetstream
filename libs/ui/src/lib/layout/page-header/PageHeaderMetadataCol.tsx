import { FunctionComponent } from 'react';

export interface PageHeaderMetadataColProps {
  children?: React.ReactNode;
}

export const PageHeaderMetadataCol: FunctionComponent<PageHeaderMetadataColProps> = ({ children }) => {
  return <div className="slds-page-header__col-meta">{children}</div>;
};

export default PageHeaderMetadataCol;

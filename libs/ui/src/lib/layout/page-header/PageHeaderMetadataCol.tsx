import { FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PageHeaderMetadataColProps {}

export const PageHeaderMetadataCol: FunctionComponent<PageHeaderMetadataColProps> = ({ children }) => {
  return <div className="slds-page-header__col-meta">{children}</div>;
};

export default PageHeaderMetadataCol;

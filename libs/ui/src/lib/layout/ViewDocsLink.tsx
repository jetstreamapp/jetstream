import { Icon, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';

const DOCS_BASE_PATH = 'https://docs.getjetstream.app';

export interface ViewDocsLinkProps {
  className?: string;
  path: string;
  textReset?: boolean;
}

export const ViewDocsLink: FunctionComponent<ViewDocsLinkProps> = ({ className, path, textReset }) => {
  if (!path) {
    return null;
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return (
    <a
      href={`${DOCS_BASE_PATH}${path}`}
      target="_blank"
      rel="noreferrer"
      className={classNames('slds-grid', { 'slds-text-body_regular': textReset }, className)}
    >
      Documentation
      <Icon type="utility" icon="new_window" className="slds-icon slds-text-link slds-icon_xx-small slds-m-left_xx-small" />
    </a>
  );
};

export default ViewDocsLink;

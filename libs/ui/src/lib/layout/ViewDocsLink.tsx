import { logger } from '@jetstream/shared/client-logger';
import classNames from 'classnames';
import { FunctionComponent, useMemo } from 'react';
import Icon from '../widgets/Icon';

const allowedHosts = ['docs.getjetstream.app'];
const DOCS_BASE_PATH = 'https://docs.getjetstream.app';

function getSanitizedDocsUrl(path: string): string | null {
  try {
    if (!path) {
      return path;
    }
    const url = new URL(path, DOCS_BASE_PATH);
    if (!allowedHosts.includes(url.host)) {
      return null;
    }
    url.protocol = 'https:';
    return url.href;
  } catch (ex) {
    logger.warn('ViewDocsLink', 'Invalid URL provided for documentation link', ex);
    return null;
  }
}

export interface ViewDocsLinkProps {
  className?: string;
  path: string;
  textReset?: boolean;
}

export const ViewDocsLink: FunctionComponent<ViewDocsLinkProps> = ({ className, path, textReset }) => {
  const href = useMemo(() => getSanitizedDocsUrl(path), [path]);
  if (!href) {
    return null;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={classNames('slds-grid', { 'slds-text-body_regular': textReset }, className)}>
      Documentation
      <Icon type="utility" icon="new_window" className="slds-icon slds-text-link slds-icon_xx-small slds-m-left_xx-small" />
    </a>
  );
};

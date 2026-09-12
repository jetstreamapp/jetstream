import { logger } from '@jetstream/shared/client-logger';
import classNames from 'classnames';
import { FunctionComponent, useMemo } from 'react';
import Icon from '../widgets/Icon';

const allowedHosts = ['docs.getjetstream.app'];
const DOCS_BASE_PATH = 'https://docs.getjetstream.app';

function getSanitizedDocsUrl(path: string | undefined): string | null {
  try {
    if (!path) {
      return null;
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
  /** Absolute docs URL or a path relative to the docs site. Renders nothing when omitted, so optional `APP_ROUTES.*.DOCS` values can be passed straight through. */
  path: string | undefined;
  textReset?: boolean;
  /** Link text — override when "Documentation" is too vague for the context, e.g. deep links to a specific section. */
  label?: string;
}

export const ViewDocsLink: FunctionComponent<ViewDocsLinkProps> = ({ className, path, textReset, label = 'Documentation' }) => {
  const href = useMemo(() => getSanitizedDocsUrl(path), [path]);
  if (!href) {
    return null;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={classNames('slds-grid', { 'slds-text-body_regular': textReset }, className)}>
      {label}
      <Icon type="utility" icon="new_window" className="slds-icon slds-text-link slds-icon_xx-small slds-m-left_xx-small" />
    </a>
  );
};

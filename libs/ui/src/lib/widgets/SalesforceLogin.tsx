import { getOrgUrlParams } from '@jetstream/shared/ui-utils';
import { PositionLeftRight, SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent, MouseEvent, useEffect, useState } from 'react';
import Icon from './Icon';

export interface SalesforceLoginProps {
  // If true, the request will go directly to SFDC without logging in
  skipFrontDoorAuth?: boolean;
  serverUrl?: string;
  className?: string;
  org: SalesforceOrgUi;
  title?: string;
  returnUrl?: string | null;
  iconPosition?: PositionLeftRight;
  omitIcon?: boolean;
  onClick?: (event: MouseEvent<HTMLAnchorElement>, loginUrl: string) => void;
  children?: React.ReactNode;
}

function getLoginUrl({
  skipFrontDoorAuth,
  org,
  serverUrl,
  returnUrl,
}: Pick<SalesforceLoginProps, 'skipFrontDoorAuth' | 'org' | 'serverUrl' | 'returnUrl'>) {
  if (skipFrontDoorAuth) {
    return `${org.instanceUrl}${returnUrl}`;
  } else {
    if (serverUrl) {
      let url = `${serverUrl}/static/sfdc/login?${getOrgUrlParams(org)}`;
      if (returnUrl) {
        url += `&returnUrl=${encodeURIComponent(returnUrl)}`;
      }
      return url;
    }
  }
}

/**
 * Perform same action as <SalesforceLogin /> but programmatically
 */
export function salesforceLoginAndRedirect(options: Pick<SalesforceLoginProps, 'skipFrontDoorAuth' | 'org' | 'serverUrl' | 'returnUrl'>) {
  const url = getLoginUrl(options);
  if (url) {
    window.open(url, '_blank', 'noopener noreferrer');
  }
}

export const SalesforceLogin: FunctionComponent<SalesforceLoginProps> = ({
  skipFrontDoorAuth = false,
  serverUrl,
  className,
  org,
  title,
  returnUrl,
  iconPosition = 'left',
  omitIcon,
  children,
  onClick,
}) => {
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = getLoginUrl({
      skipFrontDoorAuth,
      org,
      serverUrl,
      returnUrl,
    });
    if (url) {
      setLoginUrl(url);
    }
  }, [serverUrl, org, returnUrl, loginUrl, skipFrontDoorAuth]);

  function handleOnClick(event: MouseEvent<HTMLAnchorElement>) {
    if (onClick && loginUrl) {
      onClick(event, loginUrl);
    }
  }

  if (!loginUrl) {
    return null;
  }

  return (
    <a className={className} href={loginUrl} target="_blank" rel="noopener noreferrer" title={title} onClick={handleOnClick}>
      {!omitIcon && iconPosition === 'left' && (
        <Icon
          type="utility"
          icon="new_window"
          className="slds-icon slds-text-link slds-icon_xx-small slds-m-right_xx-small"
          omitContainer
        />
      )}
      {children}
      {!omitIcon && iconPosition === 'right' && (
        <Icon type="utility" icon="new_window" className="slds-icon slds-text-link slds-icon_xx-small slds-m-left_xx-small" omitContainer />
      )}
    </a>
  );
};

export default SalesforceLogin;

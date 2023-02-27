import { getOrgUrlParams } from '@jetstream/shared/ui-utils';
import { PositionLeftRight, SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent, MouseEvent, useEffect, useState } from 'react';
import Icon from './Icon';

export interface SalesforceLoginProps {
  // If true, the request will go directly to SFDC without logging in
  skipFrontDoorAuth?: boolean;
  serverUrl: string;
  className?: string;
  org: SalesforceOrgUi;
  title?: string;
  returnUrl?: string;
  iconPosition?: PositionLeftRight;
  omitIcon?: boolean;
  onClick?: (event: MouseEvent<HTMLAnchorElement>, loginUrl: string) => void;
  children?: React.ReactNode;
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
  const [loginUrl, setLoginUrl] = useState<string>();
  useEffect(() => {
    if (skipFrontDoorAuth) {
      setLoginUrl(`${org.instanceUrl}/${returnUrl}`);
    } else {
      if (serverUrl) {
        let url = `${serverUrl}/static/sfdc/login?${getOrgUrlParams(org)}`;
        if (returnUrl) {
          url += `&returnUrl=${encodeURIComponent(returnUrl)}`;
        }
        setLoginUrl(url);
      }
    }
  }, [serverUrl, org, returnUrl, loginUrl, skipFrontDoorAuth]);

  function handleOnClick(event: MouseEvent<HTMLAnchorElement>) {
    if (onClick && loginUrl) {
      onClick(event, loginUrl);
    }
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

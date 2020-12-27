/** @jsx jsx */
import { jsx } from '@emotion/react';
import { PositionLeftRight, SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent, useEffect, useState } from 'react';
import { getOrgUrlParams } from '@jetstream/shared/ui-utils';
import Icon from './Icon';

export interface SalesforceLoginProps {
  serverUrl: string;
  className?: string;
  org: SalesforceOrgUi;
  title?: string;
  returnUrl?: string;
  iconPosition?: PositionLeftRight;
  omitIcon?: boolean;
}

export const SalesforceLogin: FunctionComponent<SalesforceLoginProps> = ({
  serverUrl,
  className,
  org,
  title,
  returnUrl,
  iconPosition = 'left',
  omitIcon,
  children,
}) => {
  const [loginUrl, setLoginUrl] = useState<string>();
  useEffect(() => {
    if (serverUrl) {
      let url = `${serverUrl}/static/sfdc/login?${getOrgUrlParams(org)}`;
      if (returnUrl) {
        url += `&returnUrl=${encodeURIComponent(returnUrl)}`;
      }
      setLoginUrl(url);
    }
  }, [serverUrl, org, returnUrl, loginUrl]);

  return (
    <a className={className} href={loginUrl} target="_blank" rel="noopener noreferrer" title={title}>
      {!omitIcon && iconPosition === 'left' && (
        <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_left" omitContainer />
      )}
      {children}
      {!omitIcon && iconPosition === 'right' && (
        <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_right" omitContainer />
      )}
    </a>
  );
};

export default SalesforceLogin;

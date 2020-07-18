/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent, useEffect, useState } from 'react';
import { getOrgUrlParams } from '@jetstream/shared/ui-utils';
import Icon from './Icon';

export interface SalesforceLoginProps {
  serverUrl: string;
  className?: string;
  org: SalesforceOrgUi;
  title?: string;
  returnUrl?: string;
  omitIcon?: boolean;
}

export const SalesforceLogin: FunctionComponent<SalesforceLoginProps> = ({
  serverUrl,
  className,
  org,
  title,
  returnUrl,
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
      {!omitIcon && <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_left" omitContainer />}
      {children}
    </a>
  );
};

export default SalesforceLogin;

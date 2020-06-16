/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrg } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { getOrgUrlParams } from '@jetstream/shared/ui-utils';

export interface SalesforceLoginProps {
  serverUrl: string;
  className?: string;
  org: SalesforceOrg;
  title?: string;
  returnUrl?: string;
}

export const SalesforceLogin: FunctionComponent<SalesforceLoginProps> = ({ serverUrl, className, org, title, returnUrl, children }) => {
  const [loginUrl, setLoginUrl] = useState<string>();
  useEffect(() => {
    if (loginUrl) {
      let url = `${serverUrl}/static/sfdc/login?${getOrgUrlParams(org)}`;
      if (returnUrl) {
        url += `&returnUrl=${encodeURIComponent(returnUrl)}`;
      }
      setLoginUrl(url);
    }
  }, [serverUrl, org, returnUrl, loginUrl]);

  return (
    <a className={className} href={loginUrl} target="_blank" rel="noopener noreferrer" title={title}>
      <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_left" omitContainer={true} />
      {children}
    </a>
  );
};

export default SalesforceLogin;

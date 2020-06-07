import { SalesforceOrg } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { salesforceOrgsState, selectedOrgIdState, STORAGE_KEYS } from '../../app-state';

export const OrgPersistence: FunctionComponent = () => {
  const [orgs] = useRecoilState<SalesforceOrg[]>(salesforceOrgsState);
  const [selectedOrgId] = useRecoilState<string>(selectedOrgIdState);

  useEffect(() => {
    if (Array.isArray(orgs)) {
      localStorage.setItem(STORAGE_KEYS.ORG_STORAGE_KEY, btoa(JSON.stringify(orgs)));
    }
  }, [orgs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_ORG_STORAGE_KEY, btoa(selectedOrgId));
  }, [selectedOrgId]);

  return <Fragment />;
};

export default OrgPersistence;

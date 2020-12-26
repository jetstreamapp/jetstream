import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { registerMiddleware } from '@jetstream/shared/data';
import { useObservable, useRollbar } from '@jetstream/shared/ui-utils';
import { ApplicationCookie, SalesforceOrgUi, UserProfileUi } from '@jetstream/types';
import { AxiosResponse } from 'axios';
import localforage from 'localforage';
import React, { Fragment, FunctionComponent, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import * as fromAppState from '../../app-state';

const orgConnectionError = new Subject<{ uniqueId: string; connectionError: string }>();
const orgConnectionError$ = orgConnectionError.asObservable();

registerMiddleware('Error', (response: AxiosResponse, org?: SalesforceOrgUi) => {
  if (org && response.headers[HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR]) {
    orgConnectionError.next({ uniqueId: org.uniqueId, connectionError: response.headers[HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR] });
  }
});

// Configure IndexedDB database
localforage.config({
  name: environment.name,
});

export interface AppInitializerProps {
  onUserProfile: (userProfile: UserProfileUi) => void;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ onUserProfile, children }) => {
  const userProfile = useRecoilValue<UserProfileUi>(fromAppState.userProfileState);
  const appCookie = useRecoilValue<ApplicationCookie>(fromAppState.applicationCookieState);
  const [orgs, setOrgs] = useRecoilState(fromAppState.salesforceOrgsState);
  const invalidOrg = useObservable(orgConnectionError$);
  // this ensures rollbar is configured and has user profile information
  useRollbar(environment.rollbarClientAccessToken, appCookie.environment, userProfile);

  useEffect(() => {
    if (invalidOrg) {
      const { uniqueId, connectionError } = invalidOrg;
      const clonedOrgs = orgs.map((org) => {
        if (org.uniqueId === uniqueId) {
          return { ...org, connectionError };
        } else {
          return org;
        }
      });
      logger.log('[invalidOrg]', invalidOrg, { orgs: clonedOrgs });
      setOrgs(clonedOrgs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidOrg]);

  useEffect(() => {
    if (userProfile) {
      onUserProfile(userProfile);
    }
  }, [onUserProfile, userProfile]);

  return <Fragment>{children}</Fragment>;
};

export default AppInitializer;

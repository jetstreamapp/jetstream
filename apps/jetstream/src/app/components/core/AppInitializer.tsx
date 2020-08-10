import { UserProfile } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import * as fromAppState from '../../app-state';
import { Subject } from 'rxjs';
import { Response } from 'superagent';
import { registerMiddleware } from '@jetstream/shared/data';
import { useObservable } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { HTTP } from '@jetstream/shared/constants';
import { logger } from '@jetstream/shared/client-logger';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { environment } from '../../../environments/environment';
import localforage from 'localforage';

const orgConnectionError = new Subject<{ uniqueId: string; connectionError: string }>();
const orgConnectionError$ = orgConnectionError.asObservable();

registerMiddleware('Error', (response: Response, org?: SalesforceOrgUi) => {
  if (org && response.get(HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR)) {
    orgConnectionError.next({ uniqueId: org.uniqueId, connectionError: response.get(HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR) });
  }
});

// Configure IndexedDB database
localforage.config({
  name: environment.name,
});

export interface AppInitializerProps {
  onUserProfile: (userProfile: UserProfile) => void;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ onUserProfile, children }) => {
  // FIXME: Cannot update a component (`Batcher`) while rendering a different component (`AppInitializer`)
  // Recoil needs to fix this
  const userProfile = useRecoilValue<UserProfile>(fromAppState.userProfileState);
  const [orgs, setOrgs] = useRecoilState(fromAppState.salesforceOrgsState);
  const invalidOrg = useObservable(orgConnectionError$);
  // this ensures rollbar is configured and has user profile information
  useRollbar(environment.rollbarClientAccessToken, environment.production ? 'production' : 'development', userProfile);

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

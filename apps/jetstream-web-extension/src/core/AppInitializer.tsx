/* eslint-disable no-restricted-globals */
import { HTTP } from '@jetstream/shared/constants';
import { registerMiddleware } from '@jetstream/shared/data';
import { SalesforceOrgUi, UserProfileUi } from '@jetstream/types';
import { AppLoading, fromAppState, selectSkipFrontdoorAuth } from '@jetstream/ui-core';
import { sendMessage } from '@jetstream/web-extension-utils';
import { AxiosResponse } from 'axios';
import localforage from 'localforage';
import React, { FunctionComponent, useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { Subject } from 'rxjs';

const args = new URLSearchParams(location.search.slice(1));
const salesforceHost = args.get('host');

const orgConnectionError = new Subject<{ uniqueId: string; connectionError: string }>();
const orgConnectionError$ = orgConnectionError.asObservable();

registerMiddleware('Error', (response: AxiosResponse, org?: SalesforceOrgUi) => {
  const connectionError =
    response?.headers?.[HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR.toLowerCase()] ||
    response?.headers?.[HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR];
  if (org && connectionError) {
    orgConnectionError.next({ uniqueId: org.uniqueId, connectionError });
  }
});

// Configure IndexedDB database
localforage.config({
  name: 'jetstream-web-extension',
});

export interface AppInitializerProps {
  onUserProfile: (userProfile: UserProfileUi) => void;
  children?: React.ReactNode;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ onUserProfile, children }) => {
  const userProfile = useRecoilValue<UserProfileUi>(fromAppState.userProfileState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);

  // const { version } = useRecoilValue(fromAppState.appVersionState);
  // const appCookie = useRecoilValue<ApplicationCookie>(fromAppState.applicationCookieState);
  // const [orgs, setOrgs] = useRecoilState(fromAppState.salesforceOrgsState);
  // const invalidOrg = useObservable(orgConnectionError$);

  const setSelectedOrgId = useSetRecoilState(fromAppState.selectedOrgIdState);
  const setSalesforceOrgs = useSetRecoilState(fromAppState.salesforceOrgsState);
  const selectedOrg = useRecoilValue(fromAppState.selectedOrgState);

  useEffect(() => {
    (async () => {
      try {
        if (salesforceHost) {
          const sessionInfo = await sendMessage({
            message: 'GET_SESSION',
            data: { salesforceHost },
          });
          console.log('sessionInfo', sessionInfo);
          if (sessionInfo) {
            const { org } = await sendMessage({
              message: 'INIT_ORG',
              data: { sessionInfo },
            });
            setSalesforceOrgs([org]);
            setSelectedOrgId(org.uniqueId);
          }
        }
      } catch (ex) {
        console.error(ex);
        // FIXME: we need to tell the user there was a problem - most likely they are not logged in
      }
    })();
  }, [setSalesforceOrgs, setSelectedOrgId]);

  // useEffect(() => {
  //   console.log('APP VERSION', version);
  // }, [version]);

  // useRollbar({
  //   accessToken: environment.rollbarClientAccessToken,
  //   environment: appCookie.environment,
  //   userProfile: userProfile,
  //   version,
  // });
  // useAmplitude();
  // usePageViews();

  // useEffect(() => {
  //   if (invalidOrg) {
  //     const { uniqueId, connectionError } = invalidOrg;
  //     const clonedOrgs = orgs.map((org) => {
  //       if (org.uniqueId === uniqueId) {
  //         return { ...org, connectionError };
  //       } else {
  //         return org;
  //       }
  //     });
  //     logger.log('[invalidOrg]', invalidOrg, { orgs: clonedOrgs });
  //     setOrgs(clonedOrgs);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [invalidOrg]);

  useEffect(() => {
    if (userProfile) {
      onUserProfile(userProfile);
    }
  }, [onUserProfile, userProfile]);

  /**
   * TODO:
   * When a tab/browser window becomes visible check with the server
   * 1. ensure user is still authenticated
   * 2. make sure the app version has not changed, if it has then refresh the page
   */
  // const handleWindowFocus = useCallback(async (event: FocusEvent) => {
  //   try {
  //     if (document.visibilityState === 'visible') {
  //       const { version: serverVersion } = await checkHeartbeat();
  //       // TODO: inform user that there is a new version and that they should refresh their browser.
  //       // We could force refresh, but don't want to get into some weird infinite refresh state
  //       if (version !== serverVersion) {
  //         console.log('VERSION MISMATCH', { serverVersion, version });
  //       }
  //     }
  //   } catch (ex) {
  //     // ignore error, but user should have been logged out if this failed
  //   }
  // }, []);

  // useEffect(() => {
  //   document.addEventListener('visibilitychange', handleWindowFocus);
  //   return () => document.removeEventListener('visibilitychange', handleWindowFocus);
  // }, [handleWindowFocus]);

  if (!salesforceHost || !selectedOrg?.uniqueId) {
    return <AppLoading />;
  }

  return children;
};

export default AppInitializer;

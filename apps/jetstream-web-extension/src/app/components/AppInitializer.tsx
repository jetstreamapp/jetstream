/* eslint-disable no-restricted-globals */
import { HTTP } from '@jetstream/shared/constants';
import { registerMiddleware } from '@jetstream/shared/data';
import { ElectronPreferences, SalesforceOrgUi } from '@jetstream/types';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import { AxiosResponse } from 'axios';
import localforage from 'localforage';
import React, { FunctionComponent } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Subject } from 'rxjs';
import '../../main.scss';

const orgConnectionError = new Subject<{ uniqueId: string; connectionError: string }>();
const orgConnectionError$ = orgConnectionError.asObservable();

export const preferencesChanged = new Subject<ElectronPreferences>();
const preferencesChanged$ = preferencesChanged.asObservable();

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
  name: 'jetstream-chrome-extension',
});

export interface AppInitializerProps {
  // onUserProfile: (userProfile: UserProfileUi) => void;
  children?: React.ReactNode;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ children }) => {
  // const [loading, setLoading] = useState(true);
  // const [userProfile, setUserProfile] = useRecoilState(userProfileState);
  // const [appVersion, setAppVersion] = useRecoilState(appVersionState);
  // const appCookie = useRecoilValue<ApplicationCookie>(applicationCookieState);
  // const [orgs, setOrgs] = useRecoilState(salesforceOrgsState);
  // // const [electronPreferencesState, setElectronPreferencesState] = useRecoilState(electronPreferences);
  // const invalidOrg = useObservable(orgConnectionError$);
  // const electronPreferences = useObservable(preferencesChanged$);

  // useEffect(() => {
  //   getUserProfile()
  //     .then((profile) => {
  //       setUserProfile(profile);
  //     })
  //     .finally(() => {
  //       setLoading(false);
  //     });
  // }, [setUserProfile]);

  // useEffect(() => {
  //   checkHeartbeat()
  //     .then((version) => {
  //       setAppVersion(version);
  //       console.log('APP VERSION', version);
  //     })
  //     .catch(() => {
  //       setAppVersion({ version: 'unknown' });
  //     });
  // }, [setAppVersion]);

  // useRollbar(
  //   {
  //     accessToken: environment.rollbarClientAccessToken,
  //     environment: appCookie.environment,
  //     userProfile: userProfile,
  //     version: appVersion.version,
  //   },
  //   electronPreferencesState && !electronPreferencesState.crashReportingOptIn
  // );
  // useAmplitude(environment, electronPreferencesState && !electronPreferencesState.analyticsOptIn);
  // usePageViews();

  // useEffect(() => {
  //   if (electronPreferences) {
  //     setElectronPreferencesState(electronPreferences);
  //     if (!electronPreferences.analyticsOptIn) {
  //       window['ga-disable-MEASUREMENT_ID'] = true;
  //     } else {
  //       window['ga-disable-MEASUREMENT_ID'] = false;
  //     }
  //   }
  // }, [electronPreferences, setElectronPreferencesState]);

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

  // useEffect(() => {
  //   if (userProfile) {
  //     onUserProfile(userProfile);
  //   }
  // }, [onUserProfile, userProfile]);

  /**
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
  //       if (appVersion.version !== serverVersion) {
  //         console.log('VERSION MISMATCH', { serverVersion, version: appVersion.version });
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

  // if (loading) {
  //   return null;
  // }

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <MemoryRouter>{children}</MemoryRouter>;
};

export default AppInitializer;

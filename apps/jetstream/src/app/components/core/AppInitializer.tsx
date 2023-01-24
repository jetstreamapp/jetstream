/* eslint-disable no-restricted-globals */
import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { checkHeartbeat, registerMiddleware } from '@jetstream/shared/data';
import { useObservable, useRollbar } from '@jetstream/shared/ui-utils';
import { ApplicationCookie, ElectronPreferences, SalesforceOrgUi, UserProfileUi } from '@jetstream/types';
import { AxiosResponse } from 'axios';
import localforage from 'localforage';
import React, { Fragment, FunctionComponent, useCallback, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import * as fromAppState from '../../app-state';
import { useAmplitude, usePageViews } from './analytics';

const orgConnectionError = new Subject<{ uniqueId: string; connectionError: string }>();
const orgConnectionError$ = orgConnectionError.asObservable();

export const preferencesChanged = new Subject<ElectronPreferences>();
const preferencesChanged$ = preferencesChanged.asObservable();

registerMiddleware('Error', (response: AxiosResponse, org?: SalesforceOrgUi) => {
  const connectionError =
    response?.headers[HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR.toLowerCase()] ||
    response?.headers[HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR];
  if (org && connectionError) {
    orgConnectionError.next({ uniqueId: org.uniqueId, connectionError });
  }
});

if (window.electron?.onPreferencesChanged) {
  window.electron?.onPreferencesChanged((_event, preferences) => {
    logger.info('[ELEcTRON PREFERENCES][CHANGED]', preferences);
    preferencesChanged.next(preferences);
  });
}

// Configure IndexedDB database
localforage.config({
  name: environment.name,
});

export interface AppInitializerProps {
  onUserProfile: (userProfile: UserProfileUi) => void;
  children?: React.ReactNode;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ onUserProfile, children }) => {
  const userProfile = useRecoilValue<UserProfileUi>(fromAppState.userProfileState);
  const { version } = useRecoilValue(fromAppState.appVersionState);
  const appCookie = useRecoilValue<ApplicationCookie>(fromAppState.applicationCookieState);
  const [orgs, setOrgs] = useRecoilState(fromAppState.salesforceOrgsState);
  const [electronPreferencesState, setElectronPreferencesState] = useRecoilState(fromAppState.electronPreferences);
  const invalidOrg = useObservable(orgConnectionError$);
  const electronPreferences = useObservable(preferencesChanged$);

  useEffect(() => {
    console.log('APP VERSION', version);
  }, [version]);

  useRollbar(
    {
      accessToken: environment.rollbarClientAccessToken,
      environment: appCookie.environment,
      userProfile: userProfile,
      version,
    },
    electronPreferencesState && !electronPreferencesState.crashReportingOptIn
  );
  useAmplitude(electronPreferencesState && !electronPreferencesState.analyticsOptIn);
  usePageViews();

  useEffect(() => {
    if (electronPreferences) {
      setElectronPreferencesState(electronPreferences);
      if (!electronPreferences.analyticsOptIn) {
        window['ga-disable-MEASUREMENT_ID'] = true;
      } else {
        window['ga-disable-MEASUREMENT_ID'] = false;
      }
    }
  }, [electronPreferences, setElectronPreferencesState]);

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

  /**
   * When a tab/browser window becomes visible check with the server
   * 1. ensure user is still authenticated
   * 2. make sure the app version has not changed, if it has then refresh the page
   */
  const handleWindowFocus = useCallback(async (event: FocusEvent) => {
    try {
      if (document.visibilityState === 'visible') {
        const { version: serverVersion } = await checkHeartbeat();
        // TODO: inform user that there is a new version and that they should refresh their browser.
        // We could force refresh, but don't want to get into some weird infinite refresh state
        if (version !== serverVersion) {
          console.log('VERSION MISMATCH', { serverVersion, version });
        }
      }
    } catch (ex) {
      // ignore error, but user should have been logged out if this failed
    }
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleWindowFocus);
    return () => document.removeEventListener('visibilitychange', handleWindowFocus);
  }, [handleWindowFocus]);

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <Fragment>{children}</Fragment>;
};

export default AppInitializer;

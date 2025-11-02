/* eslint-disable no-restricted-globals */
import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { checkHeartbeat, disconnectSocket, initSocket, registerMiddleware } from '@jetstream/shared/data';
import { useObservable, useRollbar } from '@jetstream/shared/ui-utils';
import { Announcement, SalesforceOrgUi } from '@jetstream/types';
import { useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { CookieConsentBanner, useConditionalGoogleAnalytics } from '@jetstream/ui/cookie-consent-banner';
import { initDexieDb } from '@jetstream/ui/db';
import { AxiosResponse } from 'axios';
import { useAtom, useAtomValue } from 'jotai';
import localforage from 'localforage';
import React, { Fragment, FunctionComponent, useCallback, useEffect } from 'react';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  name: environment.name,
});

export interface AppInitializerProps {
  onAnnouncements?: (announcements: Announcement[]) => void;
  children?: React.ReactNode;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ onAnnouncements, children }) => {
  const userProfile = useAtomValue(fromAppState.userProfileState);
  const ability = useAtomValue(fromAppState.abilityState);
  const { version, announcements, appInfo } = useAtomValue(fromAppState.appInfoState);
  const [orgs, setOrgs] = useAtom(fromAppState.salesforceOrgsState);
  const invalidOrg = useObservable(orgConnectionError$);
  const [analytics, setAnalytics] = useAtom(fromAppState.analyticsState);

  useConditionalGoogleAnalytics(environment.googleAnalyticsSiteId, analytics === 'accepted');

  const recordSyncEntitlementEnabled = ability.can('access', 'RecordSync');
  const recordSyncEnabled = recordSyncEntitlementEnabled && userProfile.preferences.recordSyncEnabled;

  useEffect(() => {
    console.log(
      `
%c     ██╗███████╗████████╗███████╗████████╗██████╗ ███████╗ █████╗ ███╗   ███╗
%c     ██║██╔════╝╚══██╔══╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║
%c     ██║█████╗     ██║   ███████╗   ██║   ██████╔╝█████╗  ███████║██╔████╔██║
%c██   ██║██╔══╝     ██║   ╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║
%c╚█████╔╝███████╗   ██║   ███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║
%c ╚════╝ ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝

APP VERSION ${version}
`,
      'background: #222; color: #555555',
      'background: #222; color: #777777',
      'background: #222; color: #999999',
      'background: #222; color: #BBBBBB',
      'background: #222; color: #DDDDDD',
      'background: #222; color: #FFFFFF',
    );
  }, [version]);

  useEffect(() => {
    if (recordSyncEnabled) {
      initSocket(appInfo.serverUrl);
    } else {
      disconnectSocket();
    }
    initDexieDb({ recordSyncEnabled }).catch((ex) => {
      logger.error('[DB] Error initializing db', ex);
    });
  }, [appInfo.serverUrl, recordSyncEnabled]);

  useEffect(() => {
    announcements && onAnnouncements && onAnnouncements(announcements);
  }, [announcements, onAnnouncements]);

  useRollbar({
    accessToken: environment.rollbarClientAccessToken,
    environment: appInfo.environment,
    userProfile: userProfile,
    version,
  });
  useAmplitude(analytics !== 'accepted');

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

  /**
   * When a tab/browser window becomes visible check with the server
   * 1. ensure user is still authenticated
   * 2. make sure the app version has not changed, if it has then refresh the page
   */
  const handleWindowFocus = useCallback(
    async (event: FocusEvent) => {
      try {
        if (document.visibilityState === 'visible') {
          const { version: serverVersion, announcements } = await checkHeartbeat();
          // TODO: inform user that there is a new version and that they should refresh their browser.
          // We could force refresh, but don't want to get into some weird infinite refresh state
          if (version !== serverVersion) {
            console.log('VERSION MISMATCH', { serverVersion, version });
          }
          if (announcements && onAnnouncements) {
            onAnnouncements(announcements);
          }
        }
      } catch (ex) {
        // ignore error, but user should have been logged out if this failed
      }
    },
    [onAnnouncements, version],
  );

  useEffect(() => {
    document.addEventListener('visibilitychange', handleWindowFocus);
    return () => document.removeEventListener('visibilitychange', handleWindowFocus);
  }, [handleWindowFocus]);

  return (
    <Fragment>
      <CookieConsentBanner onConsentChange={setAnalytics} />
      {children}
    </Fragment>
  );
};

export default AppInitializer;

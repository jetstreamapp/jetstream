import { logger } from '@jetstream/shared/client-logger';
import { AUTH_ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { checkHeartbeat, disconnectSocket, initSocket, registerMiddleware, updateUserProfile } from '@jetstream/shared/data';
import { initErrorTracker, setErrorTrackerUser, tracker, useObservable } from '@jetstream/shared/ui-utils';
import { Announcement, JetstreamEventSaveSoqlQueryFormatOptionsPayload, SalesforceOrgUi } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { fromAppState, useFeatureFlag } from '@jetstream/ui/app-state';
import { CookieConsentBanner, useConditionalGoogleAnalytics } from '@jetstream/ui/cookie-consent-banner';
import { initDexieDb, pruneAnalysisJobHistory } from '@jetstream/ui/db';
import { AxiosResponse } from 'axios';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import localforage from 'localforage';
import React, { Fragment, FunctionComponent, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { checkForServiceWorkerUpdate, registerServiceWorker, unregisterServiceWorker } from './service-worker-registration';

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
  const onSaveSoqlQueryFormatOptions = useObservable(
    fromJetstreamEvents.getObservable('saveSoqlQueryFormatOptions') as Observable<JetstreamEventSaveSoqlQueryFormatOptionsPayload>,
  );
  const [analytics, setAnalytics] = useAtom(fromAppState.analyticsState);
  const [searchParams, setSearchParams] = useSearchParams();
  const errorParam = searchParams.get('error');

  useConditionalGoogleAnalytics(environment.googleAnalyticsSiteId, analytics === 'accepted');

  const recordSyncEntitlementEnabled = ability.can('access', 'RecordSync');
  const recordSyncEnabled = recordSyncEntitlementEnabled && userProfile.preferences.recordSyncEnabled;

  useEffect(() => {
    if (errorParam && AUTH_ERROR_MESSAGES[errorParam]) {
      fireToast({ type: 'error', message: AUTH_ERROR_MESSAGES[errorParam] });
      setSearchParams({});
    }
  }, [errorParam, setSearchParams]);

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
    initDexieDb({ recordSyncEnabled })
      .then(() => pruneAnalysisJobHistory())
      .catch((ex) => {
        logger.error('[DB] Error initializing db', ex);
      });
  }, [appInfo.serverUrl, recordSyncEnabled]);

  useEffect(() => {
    announcements && onAnnouncements && onAnnouncements(announcements);
  }, [announcements, onAnnouncements]);

  useEffect(() => {
    initErrorTracker({ dsn: environment.sentryDsn, environment: appInfo.environment, version });
  }, [appInfo.environment, version]);

  useEffect(() => {
    setErrorTrackerUser(userProfile);
  }, [userProfile]);

  useAmplitude(analytics !== 'accepted');

  useEffect(() => {
    if (onSaveSoqlQueryFormatOptions?.value) {
      (async () => {
        try {
          const soqlQueryFormatOptions = onSaveSoqlQueryFormatOptions.value;
          await updateUserProfile({ preferences: { soqlQueryFormatOptions } });
        } catch (ex) {
          tracker.error('Error saving query format options', ex);
        }
      })();
    }
  }, [onSaveSoqlQueryFormatOptions]);

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

  const lastPromptedVersionRef = useRef<string | null>(null);
  const setUpdateAvailableVersion = useSetAtom(fromAppState.updateAvailableVersionState);

  /**
   * Surface the persistent header update indicator (WebUpdateNotification) once per detected
   * server version. The user stays in control of when to reload - never force a refresh, which
   * could interrupt in-flight work (data loads, deployments) or cause a refresh loop.
   */
  const notifyNewVersionAvailable = useCallback(
    (serverVersion: string) => {
      if (lastPromptedVersionRef.current === serverVersion) {
        return;
      }
      lastPromptedVersionRef.current = serverVersion;
      logger.log('[VERSION] New version available', { serverVersion });
      // Let the service worker (if active) start fetching the new precache in the background
      checkForServiceWorkerUpdate();
      setUpdateAvailableVersion(serverVersion);
    },
    [setUpdateAvailableVersion],
  );

  /**
   * When a tab/browser window becomes visible check with the server
   * 1. ensure user is still authenticated
   * 2. make sure the app version has not changed, if it has then let the user know they can refresh
   */
  const handleWindowFocus = useCallback(
    async (_: FocusEvent) => {
      try {
        if (document.visibilityState === 'visible') {
          const { version: serverVersion, announcements } = await checkHeartbeat();
          if (version !== serverVersion && version !== 'unknown' && serverVersion !== 'unknown') {
            notifyNewVersionAvailable(serverVersion);
          }
          if (announcements && onAnnouncements) {
            onAnnouncements(announcements);
          }
        }
      } catch {
        // ignore error, but user should have been logged out if this failed
      }
    },
    [notifyNewVersionAvailable, onAnnouncements, version],
  );

  useEffect(() => {
    document.addEventListener('visibilitychange', handleWindowFocus);
    return () => document.removeEventListener('visibilitychange', handleWindowFocus);
  }, [handleWindowFocus]);

  /**
   * Register/remove the precache service worker based on the feature flag. Unregistering when the
   * flag is off doubles as a client-side kill switch (the server-side one is SW_KILL_SWITCH).
   */
  const serviceWorkerEnabled = useFeatureFlag('pwa-service-worker');
  useEffect(() => {
    if (serviceWorkerEnabled) {
      registerServiceWorker();
    } else {
      unregisterServiceWorker();
    }
  }, [serviceWorkerEnabled]);

  return (
    <Fragment>
      <CookieConsentBanner onConsentChange={setAnalytics} />
      {children}
    </Fragment>
  );
};

export default AppInitializer;

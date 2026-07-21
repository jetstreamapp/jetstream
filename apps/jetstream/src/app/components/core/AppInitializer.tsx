import { logger } from '@jetstream/shared/client-logger';
import { AUTH_ERROR_MESSAGES, HTTP, UNKNOWN_APP_VERSION } from '@jetstream/shared/constants';
import { checkHeartbeat, disconnectSocket, initSocket, registerMiddleware, updateUserProfile } from '@jetstream/shared/data';
import { initErrorTracker, setErrorTrackerUser, tracker, useObservable } from '@jetstream/shared/ui-utils';
import { Announcement, JetstreamEventSaveSoqlQueryFormatOptionsPayload, SalesforceOrgUi } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import {
  checkForServiceWorkerUpdate,
  fromJetstreamEvents,
  registerServiceWorker,
  unregisterServiceWorker,
  useAmplitude,
} from '@jetstream/ui-core';
import { fromAppState, useFeatureFlag } from '@jetstream/ui/app-state';
import { CookieConsentBanner, useConditionalGoogleAnalytics } from '@jetstream/ui/cookie-consent-banner';
import { initDexieDb, pruneAnalysisJobHistory } from '@jetstream/ui/db';
import { AxiosResponse } from 'axios';
import { useAtom, useAtomValue } from 'jotai';
import localforage from 'localforage';
import React, { Fragment, FunctionComponent, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { staleBuildDetected$ } from './stale-build-recovery';

const orgConnectionError = new Subject<{ uniqueId: string; connectionError: string }>();
const orgConnectionError$ = orgConnectionError.asObservable();

/** Collapses bursts of focus/visibility events (alt-tabbing) into at most one heartbeat */
const MIN_VERSION_CHECK_INTERVAL_MS = 1000 * 60;
/** Backstop for a tab that is never hidden or blurred, so it still learns about a deploy */
const VERSION_POLL_INTERVAL_MS = 1000 * 60 * 30;

/**
 * A version mismatch only means an update is available when both sides reported a real version -
 * either can be UNKNOWN_APP_VERSION (server started without VERSION set, or the initial heartbeat
 * failed), which would otherwise prompt every user to refresh.
 */
function isNewVersionAvailable(clientVersion: string, serverVersion: string): boolean {
  return clientVersion !== serverVersion && clientVersion !== UNKNOWN_APP_VERSION && serverVersion !== UNKNOWN_APP_VERSION;
}

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

  const [updateAvailableVersion, setUpdateAvailableVersion] = useAtom(fromAppState.updateAvailableVersionState);
  const lastVersionCheckAt = useRef(0);

  /**
   * Ask the server what version it is on and, if it is newer than us, surface the persistent header
   * indicator (WebUpdateNotification) once per detected version. The user stays in control of when
   * to reload - never force a refresh, which could interrupt in-flight work (data loads,
   * deployments) or cause a refresh loop.
   */
  const checkForNewVersion = useCallback(async () => {
    try {
      const { version: serverVersion, announcements } = await checkHeartbeat();
      if (isNewVersionAvailable(version, serverVersion) && updateAvailableVersion !== serverVersion) {
        logger.log('[VERSION] New version available', { serverVersion });
        // Let the service worker (if active) start fetching the new precache in the background
        checkForServiceWorkerUpdate();
        setUpdateAvailableVersion(serverVersion);
      }
      if (announcements && onAnnouncements) {
        onAnnouncements(announcements);
      }
    } catch {
      // ignore error, but user should have been logged out if this failed
    }
  }, [onAnnouncements, setUpdateAvailableVersion, updateAvailableVersion, version]);

  /**
   * Check in with the server while the app is in use to
   * 1. ensure user is still authenticated
   * 2. make sure the app version has not changed, if it has then let the user know they can refresh
   *
   * `visibilitychange` alone is not enough: it only fires when a page is hidden or restored, so
   * switching between two visible windows (installed app, second monitor) never triggers it, and a
   * tab left in the foreground all day is never checked at all. `focus` covers window switching and
   * the interval covers the tab nobody ever leaves. All three share one minimum interval, so this
   * makes fewer requests than the previous every-single-tab-switch behavior.
   */
  useEffect(() => {
    const checkIfDue = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastVersionCheckAt.current < MIN_VERSION_CHECK_INTERVAL_MS) {
        return;
      }
      lastVersionCheckAt.current = Date.now();
      checkForNewVersion();
    };
    document.addEventListener('visibilitychange', checkIfDue);
    window.addEventListener('focus', checkIfDue);
    const intervalId = window.setInterval(checkIfDue, VERSION_POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', checkIfDue);
      window.removeEventListener('focus', checkIfDue);
      window.clearInterval(intervalId);
    };
  }, [checkForNewVersion]);

  /**
   * A dynamic import that failed may mean a deploy replaced the chunks this build references, or may
   * just be a dropped connection - the heartbeat is what tells them apart. Confirming here is why
   * `stale-build-recovery` never has to guess (and never reloads on its own).
   */
  const staleBuildDetected = useObservable(staleBuildDetected$);
  useEffect(() => {
    if (staleBuildDetected) {
      checkForNewVersion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleBuildDetected]);

  /**
   * Register/remove the precache service worker based on the feature flag. Unregistering when the
   * flag is off doubles as a client-side kill switch (the server-side one is SW_KILL_SWITCH).
   */
  const featureFlagsResolved = useAtomValue(fromAppState.featureFlagsResolvedState);
  const serviceWorkerEnabled = useFeatureFlag('pwa-service-worker');
  useEffect(() => {
    // A failed profile fetch falls back to code-default flags, which is indistinguishable from an
    // explicit opt-out - do not tear down a working registration and its caches over a network blip.
    if (!featureFlagsResolved) {
      return;
    }
    if (serviceWorkerEnabled) {
      registerServiceWorker();
    } else {
      unregisterServiceWorker();
    }
  }, [featureFlagsResolved, serviceWorkerEnabled]);

  return (
    <Fragment>
      <CookieConsentBanner onConsentChange={setAnalytics} />
      {children}
    </Fragment>
  );
};

export default AppInitializer;

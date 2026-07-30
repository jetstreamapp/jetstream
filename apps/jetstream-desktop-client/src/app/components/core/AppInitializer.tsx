import { DesktopAuthInfo, DesktopUserPreferences } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { disconnectSocket, initSocket, registerMiddleware } from '@jetstream/shared/data';
import { initErrorTracker, setErrorTrackerOptOut, setErrorTrackerUser, tracker, useObservable } from '@jetstream/shared/ui-utils';
import { Announcement, JetstreamEventSaveSoqlQueryFormatOptionsPayload, SalesforceOrgUi } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { initDexieDb, pruneAnalysisJobHistory } from '@jetstream/ui/db';
import { AxiosResponse } from 'axios';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import localforage from 'localforage';
import React, { Fragment, FunctionComponent, useCallback, useEffect } from 'react';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { desktopUserPreferences } from './AppDesktopState';
import { useElectronActionLoader } from './useElectronActionLoader';

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
  authInfo: DesktopAuthInfo;
  children: React.ReactNode;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ authInfo, onAnnouncements, children }) => {
  const [userProfile, setUserProfile] = useAtom(fromAppState.userProfileState);
  const ability = useAtomValue(fromAppState.abilityState);
  const { version, announcements, appInfo } = useAtomValue(fromAppState.appInfoState);
  const [orgs, setOrgs] = useAtom(fromAppState.salesforceOrgsState);
  const setDesktopUserPreferences = useSetAtom(desktopUserPreferences);
  const invalidOrg = useObservable(orgConnectionError$);

  const onSaveSoqlQueryFormatOptions = useObservable(
    fromJetstreamEvents.getObservable('saveSoqlQueryFormatOptions') as Observable<JetstreamEventSaveSoqlQueryFormatOptionsPayload>,
  );

  useElectronActionLoader();

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
    if (recordSyncEnabled && authInfo.accessToken && authInfo.deviceId) {
      initSocket(appInfo.serverUrl, {
        [HTTP.HEADERS.AUTHORIZATION]: `Bearer ${authInfo.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: authInfo.deviceId,
      });
    } else {
      disconnectSocket();
    }
    initDexieDb({ recordSyncEnabled })
      .then(() => pruneAnalysisJobHistory())
      .catch((ex) => {
        logger.error('[DB] Error initializing db', ex);
      });
  }, [appInfo.serverUrl, authInfo.accessToken, authInfo.deviceId, recordSyncEnabled]);

  useEffect(() => {
    announcements && onAnnouncements && onAnnouncements(announcements);
  }, [announcements, onAnnouncements]);

  useEffect(() => {
    if (window.electronAPI?.onToastMessage) {
      const unsubscribe = window.electronAPI.onToastMessage((payload) => fireToast(payload));
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, []);

  useEffect(() => {
    setErrorTrackerUser(userProfile);
  }, [userProfile]);

  // No-op while opted out or already initialized, so calling this again re-enables reporting
  // without an app restart when the user turns crash reporting back on.
  const initTracker = useCallback(() => {
    initErrorTracker({ dsn: environment.sentryDsn, environment: environment.production ? 'production' : 'development', version });
  }, [version]);

  /**
   * Applies the persisted "Send crash reports to Jetstream" preference to the renderer.
   *
   * The opt-out is applied before `initErrorTracker` so nothing is reported while the preference is
   * still being read, and the preferences atom is refreshed from the main process so the settings
   * page cannot later write a stale value back over a change made from the menu.
   */
  const applyCrashReportingPreference = useCallback(
    (preferences: DesktopUserPreferences) => {
      setDesktopUserPreferences(preferences);
      setErrorTrackerOptOut(!preferences.crashReportingEnabled);
      initTracker();
    },
    [initTracker, setDesktopUserPreferences],
  );

  // Hand the (build-time-baked) DSN to the main process, which has no build-time environment of its
  // own, then start the renderer tracker once the user's preference is known.
  useEffect(() => {
    // Running outside the electron shell (browser dev): there is no preference to honor
    if (!window.electronAPI) {
      initTracker();
      return;
    }
    window.electronAPI.configureCrashReporter(environment.sentryDsn).catch((ex) => {
      logger.error('[CRASH REPORTER] Error configuring main process crash reporter', ex);
    });
    window.electronAPI
      .getPreferences()
      .then(applyCrashReportingPreference)
      .catch((ex) => {
        logger.error('[CRASH REPORTER] Error reading crash reporting preference', ex);
      });
  }, [applyCrashReportingPreference, initTracker]);

  // React to live changes broadcast from the main-process menu checkbox.
  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }
    return window.electronAPI.onCrashReportingChanged(() => {
      window.electronAPI
        ?.getPreferences()
        .then(applyCrashReportingPreference)
        .catch((ex) => {
          logger.error('[CRASH REPORTER] Error reading crash reporting preference', ex);
        });
    });
  }, [applyCrashReportingPreference]);

  useAmplitude();

  useEffect(() => {
    if (onSaveSoqlQueryFormatOptions?.value) {
      (async () => {
        try {
          if (!window.electronAPI) {
            return;
          }
          const soqlQueryFormatOptions = onSaveSoqlQueryFormatOptions.value;
          const preferences = await window.electronAPI.getPreferences();
          const updatedPreferences = await window.electronAPI.setPreferences({
            ...preferences,
            soqlQueryFormatOptions,
          });
          setUserProfile((prev) => ({ ...prev, preferences: updatedPreferences }));
        } catch (ex) {
          tracker.error('Error saving query format options', ex);
        }
      })();
    }
  }, [onSaveSoqlQueryFormatOptions, setUserProfile]);

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

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <Fragment>{children}</Fragment>;
};

export default AppInitializer;

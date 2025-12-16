import { DesktopAuthInfo } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { disconnectSocket, initSocket, registerMiddleware } from '@jetstream/shared/data';
import { useObservable, useRollbar } from '@jetstream/shared/ui-utils';
import { Announcement, JetstreamEventSaveSoqlQueryFormatOptionsPayload, SalesforceOrgUi } from '@jetstream/types';
import { fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { initDexieDb } from '@jetstream/ui/db';
import { AxiosResponse } from 'axios';
import { useAtom, useAtomValue } from 'jotai';
import localforage from 'localforage';
import React, { Fragment, FunctionComponent, useEffect } from 'react';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
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
    initDexieDb({ recordSyncEnabled }).catch((ex) => {
      logger.error('[DB] Error initializing db', ex);
    });
  }, [appInfo.serverUrl, authInfo.accessToken, authInfo.deviceId, recordSyncEnabled]);

  useEffect(() => {
    announcements && onAnnouncements && onAnnouncements(announcements);
  }, [announcements, onAnnouncements]);

  const rollbar = useRollbar({
    accessToken: environment.rollbarClientAccessToken,
    environment: appInfo.environment,
    userProfile,
    version,
  });
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
          rollbar.error('Error saving query format options', { stack: ex.stack, message: ex.message });
        }
      })();
    }
  }, [onSaveSoqlQueryFormatOptions, rollbar, setUserProfile]);

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

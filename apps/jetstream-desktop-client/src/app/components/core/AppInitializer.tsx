/* eslint-disable no-restricted-globals */
import { DesktopAuthInfo } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { disconnectSocket, initSocket, registerMiddleware } from '@jetstream/shared/data';
import { useObservable, useRollbar } from '@jetstream/shared/ui-utils';
import { Announcement, SalesforceOrgUi } from '@jetstream/types';
import { useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { initDexieDb } from '@jetstream/ui/db';
import { AxiosResponse } from 'axios';
import { useAtom, useAtomValue } from 'jotai';
import localforage from 'localforage';
import React, { Fragment, FunctionComponent, useEffect } from 'react';
import { Subject } from 'rxjs';
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
  const userProfile = useAtomValue(fromAppState.userProfileState);
  const { version, announcements } = useAtomValue(fromAppState.appVersionState);
  const [appCookie, setAppCookie] = useAtom(fromAppState.applicationCookieState);
  const [orgs, setOrgs] = useAtom(fromAppState.salesforceOrgsState);
  const invalidOrg = useObservable(orgConnectionError$);

  useElectronActionLoader();

  const recordSyncEntitlementEnabled = useAtomValue(fromAppState.userProfileEntitlementState('recordSync'));
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
    window.electronAPI
      ?.getAppCookie()
      .then((appCookie) => {
        if (appCookie) {
          setAppCookie(appCookie);
        }
      })
      .catch((err) => {
        logger.error('Error getting app cookie', err);
        // TODO: this is fatal, we need to block the app from working
      });
  }, [setAppCookie]);

  useEffect(() => {
    if (recordSyncEnabled) {
      initSocket(appCookie.serverUrl, {
        [HTTP.HEADERS.AUTHORIZATION]: `Bearer ${authInfo.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: authInfo.deviceId,
      });
    } else {
      disconnectSocket();
    }
    initDexieDb({ recordSyncEnabled }).catch((ex) => {
      logger.error('[DB] Error initializing db', ex);
    });
  }, [appCookie.serverUrl, recordSyncEnabled]);

  useEffect(() => {
    announcements && onAnnouncements && onAnnouncements(announcements);
  }, [announcements, onAnnouncements]);

  useRollbar({
    accessToken: environment.rollbarClientAccessToken,
    environment: appCookie.environment,
    userProfile: userProfile,
    version,
  });
  useAmplitude();

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

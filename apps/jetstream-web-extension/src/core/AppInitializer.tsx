/* eslint-disable no-restricted-globals */
import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { disconnectSocket, initSocket } from '@jetstream/shared/data';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { JetstreamEventSaveSoqlQueryFormatOptionsPayload, UserProfileUi } from '@jetstream/types';
import { ScopedNotification } from '@jetstream/ui';
import { AppLoading, fromJetstreamEvents } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { initDexieDb } from '@jetstream/ui/db';
import { useObservable } from 'dexie-react-hooks';
import { useAtomValue, useSetAtom } from 'jotai';
import localforage from 'localforage';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Observable } from 'rxjs';
import browser from 'webextension-polyfill';
import { chromeLocalStorage, chromeSyncStorage, UserProfileState } from '../utils/extension.store';
import { sendMessage } from '../utils/web-extension.utils';
import { GlobalExtensionError } from './GlobalExtensionError';
import { GlobalExtensionLoggedOut } from './GlobalExtensionLoggedOut';

const args = new URLSearchParams(location.search.slice(1));
const salesforceHost = args.get('host');

// Configure IndexedDB database
localforage.config({
  name: 'jetstream-web-ext-no-sync',
});

export interface AppInitializerProps {
  allowWithoutSalesforceOrg?: boolean;
  children?: React.ReactNode;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ allowWithoutSalesforceOrg, children }) => {
  const location = useLocation();

  const { authTokens, extIdentifier, soqlQueryFormatOptions } = useAtomValue(chromeSyncStorage);
  const { options } = useAtomValue(chromeLocalStorage);
  const chromeUserProfile = useAtomValue(UserProfileState);
  const { serverUrl } = useAtomValue(fromAppState.applicationCookieState);
  const setUserProfile = useSetAtom(fromAppState.userProfileState);

  const setSelectedOrgId = useSetAtom(fromAppState.selectedOrgIdState);
  const setSalesforceOrgs = useSetAtom(fromAppState.salesforceOrgsState);
  const selectedOrg = useAtomValue(fromAppState.selectedOrgState);

  const onSaveSoqlQueryFormatOptions = useObservable(
    fromJetstreamEvents.getObservable('saveSoqlQueryFormatOptions') as Observable<JetstreamEventSaveSoqlQueryFormatOptionsPayload>,
  );

  const [fatalError, setFatalError] = useState<string>();

  useEffect(() => {
    // wait until this data has initialized before proceeding
    if (!authTokens?.accessToken || !extIdentifier?.id) {
      return;
    }
    const recordSyncEnabled = options.recordSyncEnabled && !!authTokens?.accessToken && !!extIdentifier?.id;
    if (recordSyncEnabled) {
      initSocket(serverUrl, {
        [HTTP.HEADERS.AUTHORIZATION]: `Bearer ${authTokens.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: extIdentifier.id,
      });
    } else {
      disconnectSocket();
    }
    initDexieDb({ recordSyncEnabled }).catch((ex) => {
      logger.error('[DB] Error initializing db', ex);
    });
  }, [authTokens?.accessToken, extIdentifier?.id, options.recordSyncEnabled, serverUrl]);

  // Ensure user access token is valid
  useEffect(() => {
    try {
      sendMessage({ message: 'VERIFY_AUTH' }).catch((err) => {
        logger.error('Error logging in', err);
      });
    } catch (err) {
      logger.error(err);
    }
  }, []);

  useEffect(() => {
    if (onSaveSoqlQueryFormatOptions && onSaveSoqlQueryFormatOptions.value) {
      (async () => {
        try {
          const soqlQueryFormatOptions = onSaveSoqlQueryFormatOptions.value;
          await browser.storage.sync.set({ soqlQueryFormatOptions });
          setUserProfile((prev: UserProfileUi) => ({ ...prev, preferences: { ...prev.preferences, soqlQueryFormatOptions } }));
        } catch (ex) {
          logger.error('Error saving query format options', ex);
        }
      })();
    }
  }, [onSaveSoqlQueryFormatOptions, setUserProfile]);

  // set userProfile from chromeUserProfile
  useEffect(() => {
    if (chromeUserProfile) {
      setUserProfile({ ...chromeUserProfile, preferences: { ...chromeUserProfile.preferences, soqlQueryFormatOptions } });
    }
  }, [chromeUserProfile, setUserProfile, soqlQueryFormatOptions]);

  useNonInitialEffect(() => {
    const pageUrl = new URL(window.location.href);
    const searchParams = pageUrl.searchParams;
    searchParams.set('url', location.pathname);
    history.pushState(null, '', pageUrl);
  }, [location.pathname]);

  useEffect(() => {
    (async () => {
      try {
        if (salesforceHost) {
          const sessionInfo = await sendMessage({
            message: 'GET_SESSION',
            data: { salesforceHost },
          });
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
        logger.error('Error initializing org', ex);
        setFatalError(getErrorMessage(ex));
      }
    })();
  }, [setSalesforceOrgs, setSelectedOrgId]);

  if (fatalError) {
    return <GlobalExtensionError message={fatalError} />;
  }

  if (!authTokens?.loggedIn || !chromeUserProfile) {
    return <GlobalExtensionLoggedOut />;
  }

  if (allowWithoutSalesforceOrg) {
    return children;
  }

  if (!salesforceHost) {
    return (
      <ScopedNotification theme="error">
        You have attempted to access this page without coming from a Salesforce page. Make sure that the URL includes the "host" parameter
        to allow connecting to Salesforce.
      </ScopedNotification>
    );
  }

  if (!selectedOrg?.uniqueId) {
    return <AppLoading />;
  }

  return children;
};

export default AppInitializer;

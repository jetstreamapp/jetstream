/* eslint-disable no-restricted-globals */
import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { disconnectSocket, initSocket } from '@jetstream/shared/data';
import {
  applyVerifiedFeatureFlags,
  getBrowserExtensionVersion,
  setErrorTrackerUser,
  useNonInitialEffect,
} from '@jetstream/shared/ui-utils';
import { getDefaultAppState, getErrorMessage } from '@jetstream/shared/utils';
import { JetstreamEventSaveSoqlQueryFormatOptionsPayload, UserProfileUi } from '@jetstream/types';
import { ScopedNotification } from '@jetstream/ui';
import { AppLoading, fromJetstreamEvents } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { initDataHistory } from '@jetstream/ui/data-history';
import { clearLocalStorageScope, ensureLocalStorageReady, initDexieDb, isDifferentUserThanPageSession } from '@jetstream/ui/db';
import { useObservable } from 'dexie-react-hooks';
import { useAtomValue, useSetAtom } from 'jotai';
import localforage from 'localforage';
import React, { FunctionComponent, use, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Observable } from 'rxjs';
import browser from 'webextension-polyfill';
import { environment } from '../environments/environment';
import { useExtensionErrorTracker } from '../hooks/useExtensionErrorTracker';
import { chromeLocalStorage, chromeSyncStorage, UserProfileState } from '../utils/extension.store';
import { sendMessage } from '../utils/web-extension.utils';
import { GlobalExtensionError } from './GlobalExtensionError';
import { GlobalExtensionLoggedOut } from './GlobalExtensionLoggedOut';

const args = new URLSearchParams(location.search.slice(1));
const salesforceHost = args.get('host');

// IndexedDB database holding the localforage stores. The default instance is configured here for
// the surfaces that read it directly (see `getUnscopedLocalStore`); everything behind a signed-in
// user goes through the per-user store scoped by `ensureLocalStorageReady` below.
const LOCAL_STORE_DB_NAME = 'jetstream-web-ext-no-sync';
localforage.config({
  name: LOCAL_STORE_DB_NAME,
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
  const setAppInfo = useSetAtom(fromAppState.appInfoState);
  const setUserProfile = useSetAtom(fromAppState.userProfileState);
  const setDataHistoryCaptureEnabled = useSetAtom(fromAppState.dataHistoryCaptureEnabledState);
  const setDataHistoryInitialized = useSetAtom(fromAppState.dataHistoryInitializedState);

  const setSelectedOrgId = useSetAtom(fromAppState.selectedOrgIdState);
  const setSalesforceOrgs = useSetAtom(fromAppState.salesforceOrgsState);
  const selectedOrg = useAtomValue(fromAppState.selectedOrgState);

  const onSaveSoqlQueryFormatOptions = useObservable(
    fromJetstreamEvents.getObservable('saveSoqlQueryFormatOptions') as Observable<JetstreamEventSaveSoqlQueryFormatOptionsPayload>,
  );

  const [fatalError, setFatalError] = useState<string>();

  const activeUserId = chromeUserProfile?.id ?? null;
  // Sign in and sign out reach this page through `browser.storage` events rather than a page load,
  // so a second account can take over a page still holding the first account's in-memory state
  // (jotai atoms, module level caches). Local storage re-scopes itself, the rest does not, so a
  // different user gets a fresh page instead.
  const isDifferentUser = isDifferentUserThanPageSession(activeUserId);

  // Suspend until both local stores are scoped to this user, so no descendant reads local storage
  // before it points at the right account. When a different account takes over, never scope to it
  // in this page instance: the reload below owns the transition, and binding the new user's stores
  // here would let in-flight async work from the departing account write into them. Leaving the
  // departing account's stores bound until the reload effect clears them keeps its late writes
  // attributed to its own database.
  use(ensureLocalStorageReady({ userId: isDifferentUser ? null : activeUserId, dbName: LOCAL_STORE_DB_NAME }));

  useEffect(() => {
    if (isDifferentUser) {
      clearLocalStorageScope();
      window.location.reload();
    }
  }, [isDifferentUser]);

  // Unlike every other surface, signing out here re-renders in place instead of reloading or
  // navigating away, so unbind the stores explicitly - otherwise the departing account's data stays
  // readable for as long as the page is open.
  useEffect(() => {
    if (!activeUserId) {
      clearLocalStorageScope();
    }
  }, [activeUserId]);

  // Ensure the appInfoState has the correct serverUrl from the extension environment
  // The default is 'https://getjetstream.app' which is incorrect in dev
  useEffect(() => {
    setAppInfo({
      appInfo: getDefaultAppState({
        serverUrl: environment.serverUrl,
        environment: environment.production ? 'production' : 'development',
      }),
      version: getBrowserExtensionVersion(),
      announcements: [],
    });
  }, [setAppInfo]);

  useExtensionErrorTracker(options.crashReportingEnabled);

  useEffect(() => {
    setErrorTrackerUser(chromeUserProfile);
  }, [chromeUserProfile]);

  useEffect(() => {
    // wait until this data has initialized before proceeding; never initialize for a different
    // account taking over this page — the reload effect above replaces the page for it instead
    if (!authTokens?.accessToken || !extIdentifier?.id || !chromeUserProfile?.id || isDifferentUser) {
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
    initDexieDb({ userId: chromeUserProfile.id, dbName: LOCAL_STORE_DB_NAME, recordSyncEnabled })
      // No paid signal passed — the extension always gets the top history tier via platform detection
      .then(() => initDataHistory({ userId: chromeUserProfile.id }))
      .then(({ captureEnabled }) => {
        setDataHistoryCaptureEnabled(captureEnabled);
        setDataHistoryInitialized(true);
      })
      .catch((ex) => {
        logger.error('[DB] Error initializing db', ex);
      });
  }, [
    authTokens?.accessToken,
    extIdentifier?.id,
    chromeUserProfile?.id,
    isDifferentUser,
    options.recordSyncEnabled,
    serverUrl,
    setDataHistoryCaptureEnabled,
    setDataHistoryInitialized,
  ]);

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
    if (!chromeUserProfile) {
      return;
    }
    let cancelled = false;
    (async () => {
      // Verify the feature flag signature before trusting flags from extension storage (fail-closed to code defaults)
      const verifiedProfile = await applyVerifiedFeatureFlags(chromeUserProfile);
      if (!cancelled) {
        setUserProfile({ ...verifiedProfile, preferences: { ...verifiedProfile.preferences, soqlQueryFormatOptions } });
      }
    })();
    return () => {
      cancelled = true;
    };
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

  // Hold everything back until the reload above replaces the page - the app state still in memory
  // belongs to the account that was signed in a moment ago, not to this one.
  if (isDifferentUser) {
    return <AppLoading />;
  }

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

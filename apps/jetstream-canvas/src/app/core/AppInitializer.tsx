/* eslint-disable no-restricted-globals */
import { logger } from '@jetstream/shared/client-logger';
import { getCanvasPreferences, updateCanvasPreferences } from '@jetstream/shared/data';
import { initErrorTracker, setErrorTrackerUser, useObservable } from '@jetstream/shared/ui-utils';
import { JetstreamEventSaveSoqlQueryFormatOptionsPayload, SalesforceOrgUi } from '@jetstream/types';
import { AppLoading, fromJetstreamEvents } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { initDataHistory, isDataHistoryCaptureEnabled } from '@jetstream/ui/data-history';
import { ensureLocalStorageReady, initDexieDb } from '@jetstream/ui/db';
import { useAtomValue, useSetAtom } from 'jotai';
import localforage from 'localforage';
import React, { FunctionComponent, use, useEffect, useState } from 'react';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { getCanvasOrg, getCanvasStorageScopeId } from '../../utils/canvas.utils';
import { canvasColorSchemeState } from './useCanvasColorScheme';

// IndexedDB database holding the localforage stores. The default instance is configured here for
// the surfaces that read it directly (see `getUnscopedLocalStore`); everything scoped to a user
// goes through the per-user store set up by `ensureLocalStorageReady` below.
const LOCAL_STORE_DB_NAME = 'jetstream-canvas';
localforage.config({
  name: LOCAL_STORE_DB_NAME,
});

export interface AppInitializerProps {
  allowWithoutSalesforceOrg?: boolean;
  children?: React.ReactNode;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ allowWithoutSalesforceOrg, children }) => {
  const setSelectedOrgId = useSetAtom(fromAppState.selectedOrgIdState);
  const setSalesforceOrgs = useSetAtom(fromAppState.salesforceOrgsState);
  const setUserProfile = useSetAtom(fromAppState.userProfileState);
  const setDataHistoryCaptureEnabled = useSetAtom(fromAppState.dataHistoryCaptureEnabledState);
  const setCanvasColorScheme = useSetAtom(canvasColorSchemeState);
  const selectedOrg = useAtomValue(fromAppState.selectedOrgState);

  const onSaveSoqlQueryFormatOptions = useObservable(
    fromJetstreamEvents.getObservable('saveSoqlQueryFormatOptions') as Observable<JetstreamEventSaveSoqlQueryFormatOptionsPayload>,
  );

  // The signed request is only available in a canvas context, so this is where we find out if we
  // have an org at all - everything downstream keys off the result instead of re-deriving it.
  const [{ org, initError }] = useState<{ org: SalesforceOrgUi | null; initError: string | null }>(() => {
    try {
      const org = getCanvasOrg();
      setSalesforceOrgs([org]);
      setSelectedOrgId(org.uniqueId);
      return { org, initError: null };
    } catch (ex) {
      logger.error('[CANVAS] Error initializing canvas org', ex);
      return { org: null, initError: 'Failed to initialize Salesforce connection. The canvas context may not be available.' };
    }
  });

  // Canvas has no Jetstream login, so local storage is scoped by the user's production username, which
  // is stable across a production org and its sandboxes (see getCanvasStorageScopeId) — the same user's
  // history follows them between prod and sandbox, while different users stay isolated. Children are
  // gated on `selectedOrg` below, so this runs before any descendant reads local storage.
  const storageScopeId = selectedOrg?.uniqueId ? getCanvasStorageScopeId() : null;
  // Suspend until both local stores are scoped to this user, so no descendant reads local storage
  // before it points at the right account.
  use(ensureLocalStorageReady({ userId: storageScopeId, dbName: LOCAL_STORE_DB_NAME }));

  useEffect(() => {
    initErrorTracker({
      dsn: environment.sentryDsn,
      environment: environment.production ? 'production' : 'development',
    });
    if (org) {
      setErrorTrackerUser({ id: org.userId, email: org.email });
    }
  }, [org]);

  useEffect(() => {
    // wait until this data has initialized before proceeding
    const recordSyncEnabled = false;
    if (storageScopeId) {
      initDexieDb({ userId: storageScopeId, dbName: LOCAL_STORE_DB_NAME, recordSyncEnabled })
        // Canvas always gets the top history tier via platform detection (storage is partitioned per
        // Salesforce top-level origin and best-effort — see tmp/data-history-plan/01-feasibility.md)
        .then(() => initDataHistory({ hasPaidPlan: false }))
        .then(() => isDataHistoryCaptureEnabled())
        .then(setDataHistoryCaptureEnabled)
        .catch((ex) => {
          logger.error('[DB] Error initializing db', ex);
        });
    }
  }, [storageScopeId, setDataHistoryCaptureEnabled]);

  // Load preferences from Salesforce custom setting on mount
  useEffect(() => {
    (async () => {
      try {
        const org = getCanvasOrg();
        const preferences = await getCanvasPreferences(org);
        if (preferences && Object.keys(preferences).length > 0) {
          if (preferences.colorScheme) {
            setCanvasColorScheme(preferences.colorScheme);
          }
          setUserProfile((prev) => {
            if (prev instanceof Promise) {
              return prev.then((resolved) => ({
                ...resolved,
                preferences: { ...resolved.preferences, ...preferences },
              }));
            }
            return {
              ...prev,
              preferences: { ...prev.preferences, ...preferences },
            };
          });
        }
      } catch (ex) {
        logger.error('Error loading canvas preferences', ex);
      }
    })();
  }, [setUserProfile, setCanvasColorScheme]);

  // Save SOQL query format options to Salesforce custom setting when changed
  useEffect(() => {
    if (onSaveSoqlQueryFormatOptions?.value) {
      (async () => {
        try {
          const org = getCanvasOrg();
          const soqlQueryFormatOptions = onSaveSoqlQueryFormatOptions.value;
          await updateCanvasPreferences(org, { soqlQueryFormatOptions });
          setUserProfile((prev) => {
            if (prev instanceof Promise) {
              return prev.then((resolved) => ({
                ...resolved,
                preferences: { ...resolved.preferences, soqlQueryFormatOptions },
              }));
            }
            return {
              ...prev,
              preferences: { ...prev.preferences, soqlQueryFormatOptions },
            };
          });
        } catch (ex) {
          logger.error('Error saving query format options', ex);
        }
      })();
    }
  }, [onSaveSoqlQueryFormatOptions, setUserProfile]);

  if (initError) {
    return (
      <div className="slds-illustration slds-illustration_small slds-p-around_large">
        <div className="slds-text-longform">
          <h3 className="slds-text-heading_medium">Initialization Error</h3>
          <p className="slds-text-body_regular slds-m-top_small">{initError}</p>
        </div>
      </div>
    );
  }

  if (allowWithoutSalesforceOrg) {
    return children;
  }

  if (!selectedOrg?.uniqueId) {
    return <AppLoading />;
  }

  return children;
};

export default AppInitializer;

/* eslint-disable no-restricted-globals */
import { logger } from '@jetstream/shared/client-logger';
import { getCanvasPreferences, updateCanvasPreferences } from '@jetstream/shared/data';
import { useObservable } from '@jetstream/shared/ui-utils';
import { JetstreamEventSaveSoqlQueryFormatOptionsPayload } from '@jetstream/types';
import { AppLoading, fromJetstreamEvents } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { initDexieDb } from '@jetstream/ui/db';
import { useAtomValue, useSetAtom } from 'jotai';
import localforage from 'localforage';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { Observable } from 'rxjs';
import { getCanvasOrg } from '../../utils/canvas.utils';

// Configure IndexedDB database
localforage.config({
  name: 'jetstream-canvas',
});

export interface AppInitializerProps {
  allowWithoutSalesforceOrg?: boolean;
  children?: React.ReactNode;
}

export const AppInitializer: FunctionComponent<AppInitializerProps> = ({ allowWithoutSalesforceOrg, children }) => {
  const setSelectedOrgId = useSetAtom(fromAppState.selectedOrgIdState);
  const setSalesforceOrgs = useSetAtom(fromAppState.salesforceOrgsState);
  const setUserProfile = useSetAtom(fromAppState.userProfileState);
  const selectedOrg = useAtomValue(fromAppState.selectedOrgState);

  const onSaveSoqlQueryFormatOptions = useObservable(
    fromJetstreamEvents.getObservable('saveSoqlQueryFormatOptions') as Observable<JetstreamEventSaveSoqlQueryFormatOptionsPayload>,
  );

  const [initError] = useState<string | null>(() => {
    try {
      const org = getCanvasOrg();
      setSalesforceOrgs([org]);
      setSelectedOrgId(org.uniqueId);
      return null;
    } catch (ex) {
      logger.error('[CANVAS] Error initializing canvas org', ex);
      return 'Failed to initialize Salesforce connection. The canvas context may not be available.';
    }
  });

  useEffect(() => {
    // wait until this data has initialized before proceeding
    const recordSyncEnabled = false;
    initDexieDb({ recordSyncEnabled }).catch((ex) => {
      logger.error('[DB] Error initializing db', ex);
    });
  }, []);

  // Load preferences from Salesforce custom setting on mount
  useEffect(() => {
    (async () => {
      try {
        const org = getCanvasOrg();
        const preferences = await getCanvasPreferences(org);
        if (preferences && Object.keys(preferences).length > 0) {
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
  }, [setUserProfile]);

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

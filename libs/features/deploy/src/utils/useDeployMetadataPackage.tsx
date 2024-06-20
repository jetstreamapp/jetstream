import { logger } from '@jetstream/shared/client-logger';
import { deployMetadataZip } from '@jetstream/shared/data';
import { pollMetadataResultsUntilDone, useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { DeployMetadataStatus, DeployOptions, DeployResult, SalesforceDeployHistoryType, SalesforceOrgUi } from '@jetstream/types';
import { applicationCookieState } from '@jetstream/ui-core';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { getNotificationMessageBody, saveHistory } from './deploy-metadata.utils';

/**
 *
 * NOTICE
 * THIS SAME FILE WAS COPIED AND PLACED IN THE LOAD SECTION with some modifications
 * THESE COULD BE MOVED SOMEWHERE SHARED if the abstractions are the same
 *
 */

export function getStatusValue(value: DeployMetadataStatus) {
  switch (value) {
    case 'preparing':
      return 'Uploading your metadata package';
    case 'adding':
      return 'Deploying metadata to destination org';
    default:
      return '';
  }
}

type Action =
  | { type: 'UPLOAD' }
  | { type: 'DEPLOY_IN_PROG'; payload: { deployId: string; results?: DeployResult } }
  | { type: 'SUCCESS'; payload?: { results: DeployResult } }
  | { type: 'ERROR'; payload?: { errorMessage: string } };

interface State {
  hasLoaded: boolean;
  loading: boolean;
  hasError: boolean;
  errorMessage?: string | null;
  status: DeployMetadataStatus;
  deployId: string | null;
  results: DeployResult | null;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'UPLOAD':
      return {
        ...state,
        hasLoaded: true,
        loading: true,
        hasError: false,
        errorMessage: null,
        status: 'preparing',
        deployId: null,
        results: null,
      };
    case 'DEPLOY_IN_PROG':
      return { ...state, status: 'adding', deployId: action.payload.deployId, results: action.payload.results || null };
    case 'SUCCESS':
      return { ...state, loading: false, status: 'idle', results: action.payload?.results || null };
    case 'ERROR':
      return { ...state, loading: false, hasError: true, errorMessage: action.payload?.errorMessage, status: 'idle', results: null };
    default:
      throw new Error('Invalid action');
  }
}

/**
 * Give an org and a changeset name
 * Retrieve and re-deploy the metadata to the org while adding to a changeset
 *
 * @param selectedOrg
 * @param changesetName
 */
export function useDeployMetadataPackage(destinationOrg: SalesforceOrgUi, deployOptions: DeployOptions, file: ArrayBuffer) {
  const isMounted = useRef(true);

  const [{ hasLoaded, loading, hasError, errorMessage, status, deployId, results }, dispatch] = useReducer(reducer, {
    hasLoaded: false,
    loading: false,
    hasError: false,
    status: 'idle',
    deployId: null,
    results: null,
  });

  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const { notifyUser } = useBrowserNotifications(serverUrl);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const deployMetadata = useCallback(
    async (deployType: SalesforceDeployHistoryType = 'package') => {
      try {
        const start = new Date();
        dispatch({ type: 'UPLOAD' });
        const { id } = await deployMetadataZip(destinationOrg, file, deployOptions);

        if (isMounted.current) {
          dispatch({ type: 'DEPLOY_IN_PROG', payload: { deployId: id } });
          const results = await pollMetadataResultsUntilDone(destinationOrg, id, {
            includeDetails: true,
            onChecked: (results) => {
              dispatch({ type: 'DEPLOY_IN_PROG', payload: { deployId: id, results } });
              setLastChecked(new Date());
            },
          });
          dispatch({ type: 'SUCCESS', payload: { results } });
          saveHistory({ destinationOrg, type: deployType, start, deployOptions, results, file });
          if (results.success) {
            notifyUser(`Deployment finished successfully`, {
              body: getNotificationMessageBody(results),
              tag: 'deploy-package',
            });
          } else {
            notifyUser(`Deployment failed`, {
              body: getNotificationMessageBody(results),
              tag: 'deploy-package',
            });
          }
        }
      } catch (ex) {
        logger.warn('[useDeployMetadataPackage][ERROR]', getErrorMessage(ex));
        if (isMounted.current) {
          dispatch({ type: 'ERROR', payload: { errorMessage: getErrorMessage(ex) } });
        }
      }
    },
    [deployOptions, destinationOrg, file]
  );

  return { deployMetadata, results, deployId, hasLoaded, loading, status, lastChecked, hasError, errorMessage };
}

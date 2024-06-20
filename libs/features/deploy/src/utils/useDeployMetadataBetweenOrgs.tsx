import { logger } from '@jetstream/shared/client-logger';
import { retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollAndDeployMetadataResultsWhenReady, pollMetadataResultsUntilDone, useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { DeployMetadataStatus, DeployOptions, DeployResult, ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { applicationCookieState } from '@jetstream/ui-core';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { getNotificationMessageBody, saveHistory } from './deploy-metadata.utils';

export function getStatusValue(value: DeployMetadataStatus) {
  switch (value) {
    case 'submitting':
      return 'Requesting metadata from source org';
    case 'preparing':
      return 'Waiting for metadata to be ready';
    case 'adding':
      return 'Deploying metadata to destination org';
    default:
      return '';
  }
}

type Action =
  | { type: 'REQUEST' }
  | { type: 'RETRIEVE_SUCCESS' }
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
    case 'REQUEST':
      return {
        ...state,
        hasLoaded: true,
        loading: true,
        hasError: false,
        errorMessage: null,
        status: 'submitting',
        deployId: null,
        results: null,
      };
    case 'RETRIEVE_SUCCESS':
      return { ...state, status: 'preparing' };
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
export function useDeployMetadataBetweenOrgs(
  sourceOrg: SalesforceOrgUi,
  destinationOrg: SalesforceOrgUi,
  selectedMetadata: Record<string, ListMetadataResult[]>,
  deployOptions: DeployOptions
) {
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

  const deployMetadata = useCallback(async () => {
    try {
      const start = new Date();
      dispatch({ type: 'REQUEST' });
      const { id } = await retrieveMetadataFromListMetadata(sourceOrg, selectedMetadata);
      if (isMounted.current) {
        dispatch({ type: 'RETRIEVE_SUCCESS' });
        const { results: deployResults, zipFile } = await pollAndDeployMetadataResultsWhenReady(sourceOrg, destinationOrg, id, {
          deployOptions,
          onChecked: () => setLastChecked(new Date()),
        });

        if (isMounted.current) {
          dispatch({ type: 'DEPLOY_IN_PROG', payload: { deployId: deployResults.id } });
          const results = await pollMetadataResultsUntilDone(destinationOrg, deployResults.id, {
            includeDetails: true,
            onChecked: (results) => {
              dispatch({ type: 'DEPLOY_IN_PROG', payload: { deployId: deployResults.id, results } });
              setLastChecked(new Date());
            },
          });
          dispatch({ type: 'SUCCESS', payload: { results } });
          saveHistory({
            sourceOrg,
            destinationOrg,
            type: 'orgToOrg',
            start,
            metadata: selectedMetadata,
            deployOptions,
            results,
            file: zipFile,
          });
          if (results.success) {
            notifyUser(`Deployment finished successfully`, {
              body: getNotificationMessageBody(results),
              tag: 'deploy-org-to-org',
            });
          } else {
            notifyUser(`Deployment failed`, {
              body: getNotificationMessageBody(results),
              tag: 'deploy-org-to-org',
            });
          }
        }
      }
    } catch (ex) {
      logger.warn('[useDeployMetadataBetweenOrgs][ERROR]', getErrorMessage(ex));
      if (isMounted.current) {
        dispatch({ type: 'ERROR', payload: { errorMessage: getErrorMessage(ex) } });
      }
    }
  }, [deployOptions, destinationOrg, selectedMetadata, sourceOrg]);

  return { deployMetadata, results, deployId, hasLoaded, loading, status, lastChecked, hasError, errorMessage };
}

/** @jsx jsx */
import { logger } from '@jetstream/shared/client-logger';
import { retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollAndDeployMetadataResultsWhenReady, pollMetadataResultsUntilDone } from '@jetstream/shared/ui-utils';
import { DeployOptions, DeployResult, ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

export type DeployMetadataStatus = 'idle' | 'submitting' | 'preparing' | 'adding';

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
  deployId: string;
  results: DeployResult;
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
      return { ...state, status: 'adding', deployId: action.payload.deployId, results: action.payload.results };
    case 'SUCCESS':
      return { ...state, loading: false, status: 'idle', results: action.payload.results };
    case 'ERROR':
      return { ...state, loading: false, hasError: true, errorMessage: action.payload.errorMessage, status: 'idle', results: null };
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
export function useDeployMetadata(
  sourceOrg: SalesforceOrgUi,
  destinationOrg: SalesforceOrgUi,
  selectedMetadata: MapOf<ListMetadataResult[]>,
  deployOptions: DeployOptions
) {
  const isMounted = useRef(null);

  const [{ hasLoaded, loading, hasError, errorMessage, status, deployId, results }, dispatch] = useReducer(reducer, {
    hasLoaded: false,
    loading: false,
    hasError: false,
    status: 'idle',
    deployId: null,
    results: null,
  });

  const [lastChecked, setLastChecked] = useState<Date>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  const deployMetadata = useCallback(async () => {
    try {
      dispatch({ type: 'REQUEST' });
      const { id } = await retrieveMetadataFromListMetadata(sourceOrg, selectedMetadata);
      if (isMounted.current) {
        dispatch({ type: 'RETRIEVE_SUCCESS' });
        const { results: deployResults } = await pollAndDeployMetadataResultsWhenReady(sourceOrg, destinationOrg, id, {
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
        }
      }
    } catch (ex) {
      logger.warn('[useDeployMetadata][ERROR]', ex.message);
      if (isMounted.current) {
        dispatch({ type: 'ERROR', payload: { errorMessage: ex.message } });
      }
    }
  }, [deployOptions, destinationOrg, selectedMetadata, sourceOrg]);

  return { deployMetadata, results, deployId, hasLoaded, loading, status, lastChecked, hasError, errorMessage };
}

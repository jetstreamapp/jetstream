/** @jsx jsx */
import { logger } from '@jetstream/shared/client-logger';
import { getPackageXml, retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollAndDeployMetadataResultsWhenReady, pollMetadataResultsUntilDone } from '@jetstream/shared/ui-utils';
import { DeployResult, ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { DeployMetadataStatus } from '../deploy-metadata.types';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

export function getStatusValue(value: DeployMetadataStatus) {
  switch (value) {
    case 'submitting':
      return 'Requesting metadata from org';
    case 'preparing':
      return 'Waiting for metadata to be ready';
    case 'adding':
      return 'Adding metadata to changeset';
    default:
      return '';
  }
}

type Action =
  | { type: 'REQUEST' }
  | { type: 'RETRIEVE_SUCCESS' }
  | { type: 'DEPLOY_IN_PROG'; payload: { deployId: string } }
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
      return { ...state, status: 'adding', deployId: action.payload.deployId };
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
export function useAddItemsToChangeset(
  selectedOrg: SalesforceOrgUi,
  {
    changesetName,
    changesetDescription,
    selectedMetadata,
  }: { changesetName: string; changesetDescription: string; selectedMetadata: MapOf<ListMetadataResult[]> }
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
      const { id } = await retrieveMetadataFromListMetadata(selectedOrg, selectedMetadata);
      if (isMounted.current) {
        dispatch({ type: 'RETRIEVE_SUCCESS' });
        const replacementPackageXml = await getPackageXml(selectedOrg, selectedMetadata, {
          fullName: changesetName,
          description: changesetDescription,
        });
        const { results: deployResults } = await pollAndDeployMetadataResultsWhenReady(selectedOrg, selectedOrg, id, {
          deployOptions: {
            autoUpdatePackage: true,
            checkOnly: false,
            allowMissingFiles: true,
            runAllTests: false,
            singlePackage: false,
            testLevel: 'NoTestRun',
          },
          replacementPackageXml,
          changesetName,
          onChecked: () => setLastChecked(new Date()),
        });

        if (isMounted.current) {
          dispatch({ type: 'DEPLOY_IN_PROG', payload: { deployId: deployResults.id } });
          const results = await pollMetadataResultsUntilDone(selectedOrg, deployResults.id, {
            includeDetails: true,
            onChecked: () => setLastChecked(new Date()),
          });
          dispatch({ type: 'SUCCESS', payload: { results } });
        }
      }
    } catch (ex) {
      logger.warn('[useAddItemsToChangeset][ERROR]', ex.message);
      if (isMounted.current) {
        dispatch({ type: 'ERROR', payload: { errorMessage: ex.message } });
      }
    }
  }, [selectedOrg, changesetName, changesetDescription, selectedMetadata]);

  return { deployMetadata, results, deployId, loading, status, lastChecked, hasError, errorMessage };
}

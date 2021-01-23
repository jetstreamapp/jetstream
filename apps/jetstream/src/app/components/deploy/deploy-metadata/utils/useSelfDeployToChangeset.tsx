/** @jsx jsx */
import { logger } from '@jetstream/shared/client-logger';
import { getPackageXml, retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollAndDeployMetadataResultsWhenReady, pollMetadataResultsUntilDone } from '@jetstream/shared/ui-utils';
import { ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { DeployResult } from 'jsforce';
import { useCallback, useEffect, useRef, useState } from 'react';

export type AddItemsToChangesetStatus = 'idle' | 'submitting' | 'preparing' | 'adding';

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
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [status, setStatus] = useState<AddItemsToChangesetStatus>('idle');
  const [lastChecked, setLastChecked] = useState<Date>(null);
  const [deployId, setDeployId] = useState<string>();
  const [results, setResults] = useState<DeployResult>();

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  const deployMetadata = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      setResults(null);
      setHasError(false);
      setDeployId(null);

      setStatus('submitting');
      const { id } = await retrieveMetadataFromListMetadata(selectedOrg, selectedMetadata);
      if (isMounted.current) {
        setStatus('preparing');
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
          } as any,
          replacementPackageXml,
          changesetName,
          onChecked: () => setLastChecked(new Date()),
        });

        if (isMounted.current) {
          setStatus('adding');
          setDeployId(deployResults.id);
          const results = await pollMetadataResultsUntilDone(selectedOrg, deployResults.id, {
            onChecked: () => setLastChecked(new Date()),
          });
          setResults(results);
        }
      }
    } catch (ex) {
      logger.warn('[useAddItemsToChangeset][ERROR]', ex.message);
      if (isMounted.current) {
        setHasError(true);
        setErrorMessage(ex.message);
      }
    } finally {
      if (isMounted.current) {
        setStatus('idle');
        setLoading(false);
      }
    }
  }, [selectedOrg, changesetName, changesetDescription, selectedMetadata]);

  return { deployMetadata, results, deployId, loading, status, lastChecked, hasError, errorMessage };
}

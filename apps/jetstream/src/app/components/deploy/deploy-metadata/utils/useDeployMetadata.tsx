/** @jsx jsx */
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { DeployOptions } from 'jsforce';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChangeSetPackage } from '../deploy-metadata.types';
import { getQueryForPackage } from './deploy-metadata.utils';

export function useDeployMetadata(selectedOrg: SalesforceOrgUi, deployOptions: DeployOptions) {
  const isMounted = useRef(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [results, setResults] = useState(false);
  const [lastChecked, setLastChecked] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  // const deployMetadata = useCallback(async () => {
  //   try {
  //     setHasLoaded(true);
  //     setLoading(true);
  //     if (hasError) {
  //       setHasError(false);
  //     }

  //     const { queryResults } = await query<ChangeSetPackage>(selectedOrg, getQueryForPackage());

  //     if (isMounted.current) {
  //       setChangesetPackages(getListItemFromQueryResults(queryResults.records));
  //     }
  //   } catch (ex) {
  //     logger.warn('[useChangesetList][ERROR]', ex.message);
  //     if (isMounted.current) {
  //       setHasError(true);
  //     }
  //   } finally {
  //     if (isMounted.current) {
  //       setLoading(false);
  //     }
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [selectedOrg]);

  // return { loadPackages, loading, changesetPackages, hasError };
}

/**
 * Convert records into ListItem
 * @param records
 */
function getListItemFromQueryResults(records: ChangeSetPackage[]) {
  return records.map(
    (changesetPackage): ListItem<string, ChangeSetPackage> => {
      return {
        id: changesetPackage.Name,
        label: changesetPackage.Name,
        value: changesetPackage.Name,
        meta: changesetPackage,
        title: changesetPackage.Description,
      };
    }
  );
}

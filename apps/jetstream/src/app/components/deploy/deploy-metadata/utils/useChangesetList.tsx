/** @jsx jsx */
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChangeSetPackage } from '../deploy-metadata.types';
import { getQueryForPackage } from './deploy-metadata.utils';

export function useChangesetList(selectedOrg: SalesforceOrgUi, initialPackages: ListItem<string, ChangeSetPackage>[]) {
  const isMounted = useRef(null);
  const [hasLoaded, setHasLoaded] = useState(initialPackages ? true : false);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [changesetPackages, setChangesetPackages] = useState<ListItem<string, ChangeSetPackage>[]>(initialPackages || []);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    // LOAD PROFILES/PERM SETS
    if (selectedOrg && !hasLoaded) {
      loadPackages();
    } else if (!selectedOrg) {
      setChangesetPackages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  const loadPackages = useCallback(async () => {
    try {
      setHasLoaded(true);
      setLoading(true);
      if (hasError) {
        setHasError(false);
      }

      const { queryResults } = await query<ChangeSetPackage>(selectedOrg, getQueryForPackage());

      if (isMounted.current) {
        setChangesetPackages(getListItemFromQueryResults(queryResults.records));
      }
    } catch (ex) {
      logger.warn('[useChangesetList][ERROR]', ex.message);
      if (isMounted.current) {
        setHasError(true);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  return { loadPackages, loading, changesetPackages, hasError };
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

/** @jsx jsx */
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { useReducerFetchFn } from '@jetstream/shared/ui-utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { ChangeSetPackage } from '../deploy-metadata.types';
import { getQueryForPackage } from './deploy-metadata.utils';

export function useChangesetList(selectedOrg: SalesforceOrgUi, initialPackages?: ListItem<string, ChangeSetPackage>[]) {
  const isMounted = useRef(null);

  const [{ hasLoaded, loading, data, hasError, errorMessage }, dispatch] = useReducer(
    useReducerFetchFn<ListItem<string, ChangeSetPackage>[]>(),
    {
      hasLoaded: !!initialPackages,
      loading: false,
      hasError: false,
      data: initialPackages || [],
    }
  );

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  const loadPackages = useCallback(async () => {
    try {
      dispatch({ type: 'REQUEST', payload: [] });
      const { queryResults } = await query<ChangeSetPackage>(selectedOrg, getQueryForPackage());

      if (isMounted.current) {
        dispatch({ type: 'SUCCESS', payload: getListItemFromQueryResults(queryResults.records) });
      }
    } catch (ex) {
      logger.warn('[useChangesetList][ERROR]', ex.message);
      if (isMounted.current) {
        dispatch({ type: 'ERROR', payload: { errorMessage: ex.message } });
      }
    }
  }, [selectedOrg]);

  useEffect(() => {
    // LOAD PROFILES/PERM SETS
    if (selectedOrg && !hasLoaded) {
      loadPackages();
    }
  }, [selectedOrg, hasLoaded, loadPackages]);

  return { loadPackages, loading, changesetPackages: data, hasError, errorMessage };
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

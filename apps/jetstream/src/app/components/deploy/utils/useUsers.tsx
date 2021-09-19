import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, queryWithCache } from '@jetstream/shared/data';
import { useReducerFetchFn } from '@jetstream/shared/ui-utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import formatRelative from 'date-fns/formatRelative';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { SalesforceUser } from '../deploy-metadata.types';
import { getQueryForUsers } from './deploy-metadata.utils';

let _lastRefreshed: string;

export function useUsers(selectedOrg: SalesforceOrgUi, initialUsers?: ListItem<string, SalesforceUser>[], loadOnInit = true) {
  const isMounted = useRef(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);

  const [{ hasLoaded, loading, data, hasError, errorMessage }, dispatch] = useReducer(
    useReducerFetchFn<ListItem<string, SalesforceUser>[]>(),
    {
      hasLoaded: !!initialUsers,
      loading: false,
      hasError: false,
      data: initialUsers || [],
    }
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (lastRefreshed) {
      _lastRefreshed = lastRefreshed;
    }
  }, [lastRefreshed]);

  const loadUsers = useCallback(
    async (clearCache = false) => {
      try {
        dispatch({ type: 'REQUEST', payload: [] });
        if (clearCache) {
          clearCacheForOrg(selectedOrg);
        }
        const { data, cache } = await queryWithCache<SalesforceUser>(selectedOrg, getQueryForUsers());

        if (isMounted.current) {
          if (cache) {
            setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
          }
          dispatch({ type: 'SUCCESS', payload: getListItemFromQueryResults(data.queryResults.records) });
        }
      } catch (ex) {
        logger.warn('[useUsers][ERROR]', ex.message);
        if (isMounted.current) {
          dispatch({ type: 'ERROR', payload: { errorMessage: ex.message } });
        }
      }
    },
    [selectedOrg]
  );

  useEffect(() => {
    // LOAD PROFILES/PERM SETS
    if (selectedOrg && loadOnInit && !hasLoaded) {
      loadUsers();
    }
  }, [selectedOrg, loadOnInit, hasLoaded, loadUsers]);

  return { loadUsers, loading, users: data, hasError, errorMessage, lastRefreshed };
}

/**
 * Convert records into ListItem
 * @param records
 */
function getListItemFromQueryResults(records: SalesforceUser[]) {
  return records.map((user): ListItem<string, SalesforceUser> => {
    return {
      id: user.Id,
      label: user.Name,
      value: user.Id,
      meta: user,
      secondaryLabel: user.IsActive ? `${user.Username}` : `${user.Username} (Inactive)`,
    };
  });
}

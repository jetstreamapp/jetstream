import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, queryAllWithCache } from '@jetstream/shared/data';
import { useReducerFetchFn } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { ListItem, Maybe, SalesforceOrgUi, SalesforceUser } from '@jetstream/types';
import { formatRelative } from 'date-fns/formatRelative';
import partition from 'lodash/partition';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getQueryForUsers } from './deploy-metadata.utils';

let _lastRefreshed: string;

export function useUsers(
  selectedOrg: SalesforceOrgUi,
  initialUsers?: Maybe<ListItem<string, SalesforceUser>[]>,
  sortCurrentUserFirst = true,
  loadOnInit = true
) {
  const isMounted = useRef(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);

  const [{ hasLoaded, loading, data, hasError, errorMessage }, dispatch] = useReducer(
    useReducerFetchFn<ListItem<string, SalesforceUser>[] | null>(),
    {
      hasLoaded: !!initialUsers,
      loading: false,
      hasError: false,
      data: initialUsers || null,
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
        dispatch({ type: 'REQUEST', payload: null });
        if (clearCache) {
          clearCacheForOrg(selectedOrg);
        }
        const { data, cache } = await queryAllWithCache<SalesforceUser>(selectedOrg, getQueryForUsers());

        if (isMounted.current) {
          if (cache) {
            setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
          }
          dispatch({ type: 'SUCCESS', payload: getListItemFromQueryResults(selectedOrg, data.queryResults.records, sortCurrentUserFirst) });
        }
      } catch (ex) {
        logger.warn('[useUsers][ERROR]', getErrorMessage(ex));
        if (isMounted.current) {
          dispatch({ type: 'ERROR', payload: { errorMessage: getErrorMessage(ex) } });
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
function getListItemFromQueryResults(selectedOrg: SalesforceOrgUi, records: SalesforceUser[], sortCurrentUserFirst = false) {
  records = sortCurrentUserFirst ? partition(records, (record) => record.Id === selectedOrg.userId).flat() : records;
  return records.map((user): ListItem<string, SalesforceUser> => {
    return {
      id: user.Id,
      label: selectedOrg.userId === user.Id ? `${user.Name} (Me)` : user.Name,
      value: user.Id,
      meta: user,
      secondaryLabel: user.IsActive ? `${user.Username}` : `${user.Username} (Inactive)`,
    };
  });
}

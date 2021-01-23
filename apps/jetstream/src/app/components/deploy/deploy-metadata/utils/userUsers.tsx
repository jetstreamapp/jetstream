/** @jsx jsx */
import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, queryWithCache } from '@jetstream/shared/data';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import formatRelative from 'date-fns/formatRelative';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SalesforceUser } from '../deploy-metadata.types';
import { getQueryForUsers } from './deploy-metadata.utils';

let _lastRefreshed: string;

export function useUsers(selectedOrg: SalesforceOrgUi, initialUsers?: ListItem<string, SalesforceUser>[], loadOnInit = true) {
  const isMounted = useRef(null);
  const [hasLoaded, setHasLoaded] = useState(initialUsers ? true : false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [users, setUsers] = useState<ListItem<string, SalesforceUser>[]>(initialUsers || []);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    // LOAD PROFILES/PERM SETS
    if (selectedOrg && loadOnInit && !hasLoaded) {
      loadUsers();
    } else if (!selectedOrg) {
      setUsers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, loadOnInit]);

  useEffect(() => {
    if (lastRefreshed) {
      _lastRefreshed = lastRefreshed;
    }
  }, [lastRefreshed]);

  const loadUsers = useCallback(
    async (clearCache = false) => {
      try {
        setHasLoaded(true);
        setLoading(true);
        if (hasError) {
          setHasError(false);
        }

        if (clearCache) {
          clearCacheForOrg(selectedOrg);
        }
        const { data, cache } = await queryWithCache<SalesforceUser>(selectedOrg, getQueryForUsers());

        if (isMounted.current) {
          if (cache) {
            setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
          }
          setUsers(getListItemFromQueryResults(data.queryResults.records));
        }
      } catch (ex) {
        logger.warn('[useUsers][ERROR]', ex.message);
        if (isMounted.current) {
          setHasError(true);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [selectedOrg]
  );

  return { loadUsers, loading, users, hasError, lastRefreshed };
}

/**
 * Convert records into ListItem
 * @param records
 */
function getListItemFromQueryResults(records: SalesforceUser[]) {
  return records.map(
    (user): ListItem<string, SalesforceUser> => {
      return {
        id: user.Id,
        label: user.Name,
        value: user.Id,
        meta: user,
        secondaryLabel: user.IsActive ? `${user.Username}` : `${user.Username} (Inactive)`,
      };
    }
  );
}

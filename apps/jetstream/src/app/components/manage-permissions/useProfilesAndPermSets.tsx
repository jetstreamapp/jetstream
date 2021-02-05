/** @jsx jsx */
import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, queryWithCache } from '@jetstream/shared/data';
import { isPermissionSetWithProfile } from '@jetstream/shared/ui-utils';
import {
  ListItem,
  PermissionSetNoProfileRecord,
  PermissionSetRecord,
  PermissionSetWithProfileRecord,
  SalesforceOrgUi,
} from '@jetstream/types';
import formatRelative from 'date-fns/formatRelative';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getQueryForPermissionSetsWithProfiles } from './utils/permission-manager-utils';

let _lastRefreshed: string;

export function useProfilesAndPermSets(selectedOrg: SalesforceOrgUi) {
  const isMounted = useRef(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [profiles, setProfiles] = useState<ListItem<string, PermissionSetWithProfileRecord>[]>([]);
  const [permissionSets, setPermissionSets] = useState<ListItem<string, PermissionSetNoProfileRecord>[]>([]);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (lastRefreshed) {
      _lastRefreshed = lastRefreshed;
    }
  }, [lastRefreshed]);

  useEffect(() => {
    // LOAD PROFILES/PERM SETS
    if (selectedOrg) {
      fetchMetadata();
    } else {
      setProfiles([]);
      setPermissionSets([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  const fetchMetadata = useCallback(
    async (skipCache = false) => {
      try {
        setLoading(true);
        if (hasError) {
          setHasError(false);
        }

        if (skipCache) {
          clearCacheForOrg(selectedOrg);
        }

        const { data, cache } = await queryWithCache<PermissionSetRecord>(selectedOrg, getQueryForPermissionSetsWithProfiles());
        if (isMounted.current) {
          if (cache) {
            setLastRefreshed(`Last updated ${formatRelative(cache.age, new Date())}`);
          }

          const output = getListItemFromQueryResults(data.queryResults.records.filter((item) => item.Type !== 'Group'));
          setProfiles(output.profiles);
          setPermissionSets(output.permissionSets);
        }
      } catch (ex) {
        logger.warn('[useProfilesAndPermSets][ERROR]', ex.message);
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

  return { fetchMetadata, loading, profiles, permissionSets, hasError, lastRefreshed };
}

/**
 * Convert records into ListItem
 * @param records
 */
function getListItemFromQueryResults(records: PermissionSetRecord[]) {
  return records.reduce(
    (
      output: {
        profiles: ListItem<string, PermissionSetWithProfileRecord>[];
        permissionSets: ListItem<string, PermissionSetNoProfileRecord>[];
      },
      record
    ) => {
      const listItem: ListItem = {
        id: record.Id,
        label: record.Label,
        secondaryLabel: record.Name,
        value: record.Id,
        meta: record,
      };

      if (isPermissionSetWithProfile(record)) {
        listItem.label = record.Profile.Name;
        listItem.secondaryLabel = undefined;
        output.profiles.push(listItem);
      } else {
        output.permissionSets.push(listItem);
      }
      return output;
    },
    {
      profiles: [],
      permissionSets: [],
    }
  );
}

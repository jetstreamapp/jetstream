import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, queryWithCache } from '@jetstream/shared/data';
import {
  ListItem,
  Maybe,
  PermissionSetNoProfileRecord,
  PermissionSetRecord,
  PermissionSetWithProfileRecord,
  SalesforceOrgUi,
} from '@jetstream/types';
import { Query, composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import { formatRelative } from 'date-fns/formatRelative';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isPermissionSetWithProfile } from '../shared-ui-utils';

let _lastRefreshed: string;

/**
 * Gets profile and permission set ListItems
 *
 * @param selectedOrg
 * @param _initProfiles initial data for profiles
 * @param _initPermissionSets initial data for permission sets
 * @returns
 */
export function useProfilesAndPermSets(
  selectedOrg: SalesforceOrgUi,
  _initProfiles?: ListItem<string, PermissionSetWithProfileRecord>[] | null,
  _initPermissionSets?: ListItem<string, PermissionSetNoProfileRecord>[] | null
) {
  const isMounted = useRef(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [profiles, setProfiles] = useState<ListItem<string, PermissionSetWithProfileRecord>[] | null>(_initProfiles || null);
  const [permissionSets, setPermissionSets] = useState<ListItem<string, PermissionSetNoProfileRecord>[] | null>(
    _initPermissionSets || null
  );

  const [profilesAndPermSetsById, setProfilesAndPermSetsById] = useState<
    Record<string, PermissionSetWithProfileRecord | PermissionSetNoProfileRecord>
  >({});

  useEffect(() => {
    if (profiles && permissionSets) {
      const newItemsById: Record<string, PermissionSetWithProfileRecord | PermissionSetNoProfileRecord> = {};
      profiles.forEach((item) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        newItemsById[item.id] = item.meta!;
      });
      permissionSets.forEach((item) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        newItemsById[item.id] = item.meta!;
      });
      setProfilesAndPermSetsById(newItemsById);
    } else {
      setProfilesAndPermSetsById({});
    }
  }, [profiles, permissionSets]);

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
      if (!selectedOrg) {
        return;
      }
      try {
        setLoading(true);
        if (hasError) {
          setHasError(false);
        }

        if (skipCache) {
          clearCacheForOrg(selectedOrg);
          setProfiles(null);
          setPermissionSets(null);
        }

        const { data, cache } = await queryWithCache<PermissionSetRecord>(
          selectedOrg,
          getQueryForPermissionSetsWithProfiles(selectedOrg.orgNamespacePrefix)
        );
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedOrg]
  );

  return {
    fetchMetadata,
    loading: loading && !profiles?.length,
    profiles,
    permissionSets,
    profilesAndPermSetsById,
    hasError,
    lastRefreshed,
  };
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
        listItem.secondaryLabel = record.IsCustom ? 'Custom Profile' : 'Standard Profile';
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

function getQueryForPermissionSetsWithProfiles(orgNamespace?: Maybe<string>): string {
  const query: Query = {
    fields: [
      getField('Id'),
      getField('Name'),
      getField('Label'),
      getField('Type'), // this field does not support filtering by
      getField('IsCustom'),
      getField('IsOwnedByProfile'),
      getField('NamespacePrefix'),
      getField('ProfileId'),
      getField('Profile.Id'),
      getField('Profile.Name'),
      getField('Profile.UserType'),
    ],
    sObject: 'PermissionSet',
    orderBy: [
      {
        field: 'IsOwnedByProfile',
        order: 'DESC',
      },
      {
        field: 'Profile.Name',
        order: 'ASC',
      },
      {
        field: 'Name',
        order: 'ASC',
      },
    ],
  };
  // TODO: we should omit profiles that do not allow editing (not sure how to identify)
  // maybe user access query?
  if (!orgNamespace) {
    query.where = {
      left: {
        field: 'NamespacePrefix',
        operator: '=',
        value: 'null',
        literalType: 'NULL',
      },
    };
  } else {
    query.where = {
      left: {
        field: 'NamespacePrefix',
        operator: '=',
        value: 'null',
        literalType: 'NULL',
      },
      operator: 'OR',
      right: {
        left: {
          field: 'NamespacePrefix',
          operator: '=',
          value: orgNamespace,
          literalType: 'STRING',
        },
      },
    };
  }
  const soql = composeQuery(query);
  logger.log('getQueryForPermissionSetsWithProfiles()', soql);
  return soql;
}

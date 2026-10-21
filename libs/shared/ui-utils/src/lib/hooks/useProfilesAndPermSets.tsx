import { logger } from '@jetstream/shared/client-logger';
import { clearCacheForOrg, queryAllWithCache } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
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
import {
  isManagedPermissionSet,
  isPermissionSetWithProfile,
  isSalesforceInternalPermissionSet,
  isSalesforceProvidedPermissionSet,
} from '../shared-ui-utils';

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
  _initPermissionSets?: ListItem<string, PermissionSetNoProfileRecord>[] | null,
  _initManagedPermissionSets?: ListItem<string, PermissionSetNoProfileRecord>[] | null,
) {
  const isMounted = useRef(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>(_lastRefreshed);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hiddenProfileCount, setHiddenProfileCount] = useState(0);
  const [profiles, setProfiles] = useState<ListItem<string, PermissionSetWithProfileRecord>[] | null>(_initProfiles || null);
  const [permissionSets, setPermissionSets] = useState<ListItem<string, PermissionSetNoProfileRecord>[] | null>(
    _initPermissionSets || null,
  );
  const [managedPermissionSets, setManagedPermissionSets] = useState<ListItem<string, PermissionSetNoProfileRecord>[] | null>(
    _initManagedPermissionSets || null,
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
      permissionSets.concat(managedPermissionSets || []).forEach((item) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        newItemsById[item.id] = item.meta!;
      });
      setProfilesAndPermSetsById(newItemsById);
    } else {
      setProfilesAndPermSetsById({});
    }
  }, [profiles, permissionSets, managedPermissionSets]);

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
      setManagedPermissionSets([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  const fetchMetadata = useCallback(
    async (skipCache = false) => {
      if (!selectedOrg?.uniqueId) {
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
          setManagedPermissionSets(null);
        }

        const { data, cache } = await queryAllWithCache<PermissionSetRecord>(selectedOrg, getQueryForPermissionSetsWithProfiles());
        if (isMounted.current) {
          if (cache) {
            setLastRefreshed(`Last updated from Salesforce ${formatRelative(cache.age, new Date())}`);
          }

          const output = getProfileAndPermissionSetListItems(
            data.queryResults.records.filter((item) => item.Type !== 'Group' && !isSalesforceInternalPermissionSet(item)),
            selectedOrg.orgNamespacePrefix,
          );
          setProfiles(output.profiles);
          setPermissionSets(output.permissionSets);
          setManagedPermissionSets(output.managedPermissionSets);
          setHiddenProfileCount(output.hiddenProfileCount);
        }
      } catch (ex) {
        logger.info('[useProfilesAndPermSets][ERROR]', getErrorMessage(ex));
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
    [selectedOrg],
  );

  return {
    fetchMetadata,
    loading: loading && !profiles?.length,
    profiles,
    permissionSets,
    /** Managed-package and Salesforce standard permission sets - read-only, and excluded from `permissionSets`. */
    managedPermissionSets,
    profilesAndPermSetsById,
    hasError,
    /** Profiles the user cannot see because they lack the View All Profiles permission (Salesforce profile filtering). */
    hiddenProfileCount,
    lastRefreshed,
  };
}

/**
 * Convert records into ListItem
 *
 * With profile filtering (enforced in Winter '27), users without View All Profiles get a null `Profile` on every
 * profile-owned permission set except their own. Those rows have no usable name, so they are left out and counted.
 */
export function getProfileAndPermissionSetListItems(records: PermissionSetRecord[], orgNamespacePrefix: Maybe<string>) {
  return records.reduce(
    (
      output: {
        profiles: ListItem<string, PermissionSetWithProfileRecord>[];
        permissionSets: ListItem<string, PermissionSetNoProfileRecord>[];
        managedPermissionSets: ListItem<string, PermissionSetNoProfileRecord>[];
        hiddenProfileCount: number;
      },
      record,
    ) => {
      if (isPermissionSetWithProfile(record) && !record.Profile) {
        output.hiddenProfileCount++;
        return output;
      }

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
      } else if (isManagedPermissionSet(record, orgNamespacePrefix)) {
        // The source goes in the secondary label so the list filter, which searches label and secondary
        // label, can find a permission set by the package it came from.
        listItem.secondaryLabel = isSalesforceProvidedPermissionSet(record)
          ? `${record.Name} • Salesforce standard`
          : `${record.Name} • Managed package: ${record.NamespacePrefix}`;
        output.managedPermissionSets.push(listItem);
      } else {
        output.permissionSets.push(listItem);
      }
      return output;
    },
    {
      profiles: [],
      permissionSets: [],
      managedPermissionSets: [],
      hiddenProfileCount: 0,
    },
  );
}

function getQueryForPermissionSetsWithProfiles(): string {
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
  // Managed-package and Salesforce standard permission sets are fetched too, but returned in their own list -
  // callers that assign permissions ignore them, and the permission manager shows them read-only.
  const soql = composeQuery(query);
  logger.log('getQueryForPermissionSetsWithProfiles()', soql);
  return soql;
}

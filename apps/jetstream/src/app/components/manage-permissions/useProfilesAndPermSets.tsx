/** @jsx jsx */
import { queryWithCache } from '@jetstream/shared/data';
import { isPermissionSetWithProfile } from '@jetstream/shared/ui-utils';
import {
  ListItem,
  PermissionSetNoProfileRecord,
  PermissionSetRecord,
  PermissionSetWithProfileRecord,
  SalesforceOrgUi,
} from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@jetstream/shared/client-logger';
import { getQueryForPermissionSetsWithProfiles } from './utils/permission-manager-utils';

export function useProfilesAndPermSets(selectedOrg: SalesforceOrgUi) {
  const isMounted = useRef(null);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [profiles, setProfiles] = useState<ListItem<string, PermissionSetWithProfileRecord>[]>([]);
  const [permissionSets, setPermissionSets] = useState<ListItem<string, PermissionSetNoProfileRecord>[]>([]);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

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

  const fetchMetadata = useCallback(async () => {
    try {
      setLoading(true);
      if (hasError) {
        setHasError(false);
      }
      const { data } = await queryWithCache<PermissionSetRecord>(selectedOrg, getQueryForPermissionSetsWithProfiles());
      if (isMounted.current) {
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
  }, [selectedOrg]);

  return { loading, profiles, permissionSets, hasError };
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

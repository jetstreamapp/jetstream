import { query } from '@jetstream/shared/data';
import { useSentry } from '@jetstream/shared/ui-utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useState } from 'react';

let cachedResult = true;

export interface UserPermissionAccess {
  Id: string;
  PermissionsModifyAllData: boolean;
  PermissionsModifyMetadata: boolean;
}

/**
 * Fetch tooling api permissions for selected org
 *
 * @param selectedOrg
 * @returns
 */
export function useOrgPermissions(selectedOrg: Maybe<SalesforceOrgUi>) {
  const uniqueId = selectedOrg?.uniqueId;
  const connectionError = !!selectedOrg?.connectionError;
  const [hasMetadataAccess, setHasMetadataAccess] = useState(cachedResult);
  const sentry = useSentry();

  const fetchOrgPermissions = useCallback(async () => {
    if (selectedOrg && !selectedOrg.connectionError) {
      try {
        const { queryResults } = await query<UserPermissionAccess>(
          selectedOrg,
          'SELECT Id, PermissionsModifyAllData, PermissionsModifyMetadata FROM UserPermissionAccess'
        );
        const records = queryResults.records;
        if (records.length > 0) {
          setHasMetadataAccess(records[0].PermissionsModifyAllData || records[0].PermissionsModifyMetadata);
          cachedResult = records[0].PermissionsModifyAllData || records[0].PermissionsModifyMetadata;
        }
      } catch (ex) {
        sentry.trackError(`Error checking for org access: ${ex.message}`, ex, 'fetchOrgPermissions');
      }
    }
  }, [selectedOrg, sentry]);

  useEffect(() => {
    if (uniqueId && !connectionError) {
      fetchOrgPermissions();
    }
  }, [connectionError, fetchOrgPermissions, uniqueId]);

  return { hasMetadataAccess };
}

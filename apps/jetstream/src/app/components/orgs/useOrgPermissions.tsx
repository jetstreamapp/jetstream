import { query } from '@jetstream/shared/data';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useState } from 'react';

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
export function useOrgPermissions(selectedOrg: SalesforceOrgUi) {
  const uniqueId = selectedOrg?.uniqueId;
  const connectionError = !!selectedOrg?.connectionError;
  const [hasMetadataAccess, setHasMetadataAccess] = useState(true);
  const rollbar = useRollbar();

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
        }
      } catch (ex) {
        rollbar.warn(`Error checking for org access: ${ex.message}`, ex);
      }
    }
  }, [selectedOrg]);

  useEffect(() => {
    if (uniqueId && !connectionError) {
      fetchOrgPermissions();
    }
  }, [connectionError, fetchOrgPermissions, uniqueId]);

  return { hasMetadataAccess };
}

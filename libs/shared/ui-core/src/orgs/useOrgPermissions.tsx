import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
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
        logger.error('Error fetching org permissions', ex);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  useEffect(() => {
    if (uniqueId && !connectionError) {
      fetchOrgPermissions();
    }
  }, [connectionError, fetchOrgPermissions, uniqueId]);

  return { hasMetadataAccess };
}

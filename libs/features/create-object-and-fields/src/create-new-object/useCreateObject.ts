import { logger } from '@jetstream/shared/client-logger';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { useDeployMetadataPackage } from '@jetstream/ui-core';
import { useCallback, useState } from 'react';
import { CreateFieldParams } from './create-object-types';
import { getMetadataPackage, getObjectAndTabPermissionRecords, savePermissionRecords } from './create-object-utils';

export type CreateObjectResultsStatus = 'NOT_STARTED' | 'LOADING_METADATA' | 'LOADING_PERMISSIONS' | 'SUCCESS' | 'FAILED';

export function getFriendlyStatus(status: CreateObjectResultsStatus) {
  switch (status) {
    case 'NOT_STARTED':
      return '';
    case 'LOADING_METADATA':
      return '(Creating Object)';
    case 'LOADING_PERMISSIONS':
      return '(Setting Permissions)';
    case 'SUCCESS':
      return '(Success)';
    case 'FAILED':
      return '(Failed)';
  }
}

interface UseCreateObjectOptions {
  apiVersion: string;
  serverUrl: string;
  selectedOrg: SalesforceOrgUi;
}

export default function useCreateObject({ apiVersion, serverUrl, selectedOrg }: UseCreateObjectOptions) {
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [status, setStatus] = useState<CreateObjectResultsStatus>('NOT_STARTED');
  const [permissionRecordResults, setPermissionRecordResults] = useState<
    Maybe<{
      skipped: number;
      success: number;
      failed: number;
      errors: Maybe<string>[];
    }>
  >(null);

  const {
    deployMetadata: doDeployMetadata,
    results,
    loading: deployLoading,
    lastChecked,
    hasError,
    errorMessage,
  } = useDeployMetadataPackage(serverUrl);

  /**
   * DEPLOY METADATA
   */
  const deployMetadata = useCallback(
    async (data: CreateFieldParams) => {
      try {
        const { apiName } = data;
        const { orgNamespacePrefix } = selectedOrg;
        logger.info('[deployMetadata]', data);
        setStatus('LOADING_METADATA');
        setPermissionRecordResults(null);
        const permissionRecords = getObjectAndTabPermissionRecords(data, orgNamespacePrefix);
        const file = await getMetadataPackage(apiVersion, data);

        try {
          const results = await doDeployMetadata(selectedOrg, file, {
            rollbackOnError: true,
            singlePackage: true,
            allowMissingFiles: false,
          });

          if (!results?.success) {
            setStatus('FAILED');
            return;
          }

          if (permissionRecords?.objectPermissions.length || permissionRecords?.tabPermissions.length) {
            setStatus('LOADING_PERMISSIONS');
            const permissionRecordResults = await savePermissionRecords(selectedOrg, apiName, permissionRecords);
            logger.info('[permissionRecordResults]', permissionRecordResults);
            setPermissionRecordResults({
              errors: permissionRecordResults.recordInsertResults
                .filter((record) => !record.success)
                .flatMap((record) => (!record.success ? record.errors : []))
                .map((record) => record.message),
              failed: permissionRecordResults.recordInsertResults.filter((record) => !record.success).length,
              skipped: permissionRecordResults.recordInsertResults.filter((record) => record.success).length,
              success: permissionRecordResults.recordInsertResults.filter((record) => record.success).length,
            });
          }
          setStatus('SUCCESS');
        } catch (ex) {
          rollbar.error('Deploy object permission records Fatal Error', getErrorMessageAndStackObj(ex));
          setStatus('FAILED');
        } finally {
          setLoading(false);
          setDeployed(true);
        }
      } catch (ex) {
        rollbar.error('Deploy object Fatal Error', getErrorMessageAndStackObj(ex));
        setStatus('FAILED');
      }
    },
    [apiVersion, doDeployMetadata, rollbar, selectedOrg]
  );

  return {
    status,
    results,
    permissionRecordResults,
    loading: loading || deployLoading || status === 'LOADING_METADATA' || status === 'LOADING_PERMISSIONS',
    deployed,
    lastChecked,
    hasError,
    errorMessage,
    getMetadataPackage,
    deployMetadata,
  };
}

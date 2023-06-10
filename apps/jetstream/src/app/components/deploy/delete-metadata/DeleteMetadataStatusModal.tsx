import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, DeployResult, SalesforceOrgUi, Undefinable } from '@jetstream/types';
import { SalesforceLogin } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import { getDeploymentStatusUrl } from '../utils/deploy-metadata.utils';
import DeployMetadataStatusModal from '../utils/DeployMetadataStatusModal';
import { getStatusValue, useDeployMetadataPackage } from '../utils/useDeployMetadataPackage';

export interface DeployMetadataPackageStatusModalProps {
  destinationOrg: SalesforceOrgUi;
  deployOptions: DeployOptions;
  file: ArrayBuffer;
  // used to hide while download window is open
  hideModal: boolean;
  onGoBack?: () => void;
  onClose: () => void;
  onDownload: (deployResults: DeployResult, deploymentUrl: string) => void;
  deploymentHistoryName?: Undefinable<string>;
}

export const DeployMetadataPackageStatusModal: FunctionComponent<DeployMetadataPackageStatusModalProps> = ({
  destinationOrg,
  deployOptions,
  file,
  hideModal,
  onGoBack,
  onClose,
  onDownload,
  deploymentHistoryName,
}) => {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [deployStatusUrl, setDeployStatusUrl] = useState<string | null>(null);
  const { deployMetadata, results, deployId, loading, status, lastChecked, hasError, errorMessage } = useDeployMetadataPackage(
    destinationOrg,
    deployOptions,
    file,
    deploymentHistoryName
  );

  useEffect(() => {
    deployMetadata('delete');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useNonInitialEffect(() => {
    if (deployId) {
      setDeployStatusUrl(getDeploymentStatusUrl(deployId));
    }
  }, [deployId]);

  console.log('Delete STATUS', deploymentHistoryName);

  return (
    <DeployMetadataStatusModal
      destinationOrg={destinationOrg}
      deployStatusUrl={deployStatusUrl}
      loading={loading}
      status={status}
      results={results}
      lastChecked={lastChecked}
      errorMessage={errorMessage}
      hasError={hasError}
      inProgressLabel="Your items are being deleted, this may take a few minutes."
      finishedSuccessfullyLabel="Your destructive deployment has finished successfully"
      finishedPartialSuccessfullyLabel="Your destructive deployment has finished partially"
      fallbackErrorMessageLabel="There was a problem deleting your metadata."
      fallbackUnknownErrorMessageLabel="There was a problem deleting your metadata."
      statusUrls={
        <Fragment>
          {deployStatusUrl && (
            <div>
              <SalesforceLogin org={destinationOrg} serverUrl={serverUrl} iconPosition="right" returnUrl={deployStatusUrl}>
                View the destructive deployment details.
              </SalesforceLogin>
            </div>
          )}
        </Fragment>
      }
      hideModal={hideModal}
      getStatusValue={getStatusValue}
      onGoBack={onGoBack}
      onClose={onClose}
      onDownload={onDownload}
      deploymentHistoryName={deploymentHistoryName}
    />
  );
};

export default DeployMetadataPackageStatusModal;

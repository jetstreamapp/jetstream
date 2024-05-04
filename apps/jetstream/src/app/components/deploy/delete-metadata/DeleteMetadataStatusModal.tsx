import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, DeployResult, SalesforceOrgUi } from '@jetstream/types';
import { SalesforceLogin } from '@jetstream/ui';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import DeployMetadataStatusModal from '../utils/DeployMetadataStatusModal';
import { getDeploymentStatusUrl } from '../utils/deploy-metadata.utils';
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
}

export const DeployMetadataPackageStatusModal: FunctionComponent<DeployMetadataPackageStatusModalProps> = ({
  destinationOrg,
  deployOptions,
  file,
  hideModal,
  onGoBack,
  onClose,
  onDownload,
}) => {
  const { serverUrl } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);
  const [deployStatusUrl, setDeployStatusUrl] = useState<string | null>(null);
  const { deployMetadata, results, deployId, loading, status, lastChecked, hasError, errorMessage } = useDeployMetadataPackage(
    destinationOrg,
    deployOptions,
    file
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
        // eslint-disable-next-line react/jsx-no-useless-fragment
        <Fragment>
          {deployStatusUrl && (
            <div>
              <SalesforceLogin
                org={destinationOrg}
                serverUrl={serverUrl}
                skipFrontDoorAuth={skipFrontDoorAuth}
                iconPosition="right"
                returnUrl={deployStatusUrl}
              >
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
    />
  );
};

export default DeployMetadataPackageStatusModal;

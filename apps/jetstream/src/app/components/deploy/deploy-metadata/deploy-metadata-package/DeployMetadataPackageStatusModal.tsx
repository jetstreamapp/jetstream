/** @jsx jsx */
import { jsx } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, DeployResult, SalesforceOrgUi } from '@jetstream/types';
import { SalesforceLogin } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../../app-state';
import { getDeploymentStatusUrl } from '../utils/deploy-metadata.utils';
import DeployMetadataStatusModal from '../utils/DeployMetadataStatusModal';
import { getStatusValue, useDeployMetadataPackage } from '../utils/useDeployMetadataPackage';

export interface DeployMetadataPackageStatusModalProps {
  destinationOrg: SalesforceOrgUi;
  deployOptions: DeployOptions;
  file: ArrayBuffer;
  // used to hide while download window is open
  hideModal: boolean;
  onClose: () => void;
  onDownload: (deployResults: DeployResult, deploymentUrl: string) => void;
}

export const DeployMetadataPackageStatusModal: FunctionComponent<DeployMetadataPackageStatusModalProps> = ({
  destinationOrg,
  deployOptions,
  file,
  hideModal,
  onClose,
  onDownload,
}) => {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [deployStatusUrl, setDeployStatusUrl] = useState<string>();
  const { deployMetadata, results, deployId, loading, status, lastChecked, hasError, errorMessage } = useDeployMetadataPackage(
    destinationOrg,
    deployOptions,
    file
  );

  useEffect(() => {
    deployMetadata();
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
      statusUrls={
        <Fragment>
          {deployStatusUrl && (
            <div>
              <SalesforceLogin org={destinationOrg} serverUrl={serverUrl} iconPosition="right" returnUrl={deployStatusUrl}>
                View the deployment details.
              </SalesforceLogin>
            </div>
          )}
        </Fragment>
      }
      hideModal={hideModal}
      getStatusValue={getStatusValue}
      onClose={onClose}
      onDownload={onDownload}
    />
  );
};

export default DeployMetadataPackageStatusModal;

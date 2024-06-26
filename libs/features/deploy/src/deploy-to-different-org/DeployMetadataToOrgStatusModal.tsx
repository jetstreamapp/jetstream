import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, DeployResult, ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { SalesforceLogin } from '@jetstream/ui';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import DeployMetadataStatusModal from '../utils/DeployMetadataStatusModal';
import { getDeploymentStatusUrl } from '../utils/deploy-metadata.utils';
import { getStatusValue, useDeployMetadataBetweenOrgs } from '../utils/useDeployMetadataBetweenOrgs';

export interface DeployMetadataToOrgStatusModalProps {
  sourceOrg: SalesforceOrgUi;
  destinationOrg: SalesforceOrgUi;
  selectedMetadata: Record<string, ListMetadataResult[]>;
  deployOptions: DeployOptions;
  // used to hide while download window is open
  hideModal: boolean;
  onGoBack: () => void;
  onClose: () => void;
  onDownload: (deployResults: DeployResult, deploymentUrl: string) => void;
}

export const DeployMetadataToOrgStatusModal: FunctionComponent<DeployMetadataToOrgStatusModalProps> = ({
  sourceOrg,
  destinationOrg,
  selectedMetadata,
  deployOptions,
  hideModal,
  onGoBack,
  onClose,
  onDownload,
}) => {
  const { serverUrl } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);
  const [deployStatusUrl, setDeployStatusUrl] = useState<string | null>(null);
  const { deployMetadata, results, deployId, loading, status, lastChecked, hasError, errorMessage } = useDeployMetadataBetweenOrgs(
    sourceOrg,
    destinationOrg,
    selectedMetadata,
    deployOptions
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
                View the deployment details.
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

export default DeployMetadataToOrgStatusModal;

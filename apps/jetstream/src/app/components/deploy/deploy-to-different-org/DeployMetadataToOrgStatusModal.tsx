import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, DeployResult, ListMetadataResult, MapOf, SalesforceOrgUi, Undefinable } from '@jetstream/types';
import { SalesforceLogin } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import { getDeploymentStatusUrl } from '../utils/deploy-metadata.utils';
import DeployMetadataStatusModal from '../utils/DeployMetadataStatusModal';
import { getStatusValue, useDeployMetadataBetweenOrgs } from '../utils/useDeployMetadataBetweenOrgs';

export interface DeployMetadataToOrgStatusModalProps {
  sourceOrg: SalesforceOrgUi;
  destinationOrg: SalesforceOrgUi;
  selectedMetadata: MapOf<ListMetadataResult[]>;
  deployOptions: DeployOptions;
  // used to hide while download window is open
  hideModal: boolean;
  onGoBack: () => void;
  onClose: () => void;
  onDownload: (deployResults: DeployResult, deploymentUrl: string) => void;
  deploymentHistoryName?: Undefinable<string>;
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
  deploymentHistoryName,
}) => {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [deployStatusUrl, setDeployStatusUrl] = useState<string | null>(null);
  const { deployMetadata, results, deployId, loading, status, lastChecked, hasError, errorMessage } = useDeployMetadataBetweenOrgs(
    sourceOrg,
    destinationOrg,
    selectedMetadata,
    deployOptions,
    deploymentHistoryName
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
      onGoBack={onGoBack}
      onClose={onClose}
      onDownload={onDownload}
      deploymentHistoryName={deploymentHistoryName}
    />
  );
};

export default DeployMetadataToOrgStatusModal;

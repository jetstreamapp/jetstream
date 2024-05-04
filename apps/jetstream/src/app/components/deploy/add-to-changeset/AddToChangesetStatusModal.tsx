import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ChangeSet, DeployResult, ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { SalesforceLogin } from '@jetstream/ui';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import DeployMetadataStatusModal from '../utils/DeployMetadataStatusModal';
import { getDeploymentStatusUrl, getLightningChangesetUrl } from '../utils/deploy-metadata.utils';
import { getStatusValue, useAddItemsToChangeset } from '../utils/useAddItemsToChangeset';

export interface AddToChangesetStatusModalProps {
  selectedOrg: SalesforceOrgUi;
  selectedMetadata: Record<string, ListMetadataResult[]>;
  changesetName: string;
  changesetDescription: string;
  changeset?: ChangeSet | null;
  // used to hide while download window is open
  hideModal: boolean;
  onGoBack: () => void;
  onClose: () => void;
  onDownload: (deployResults: DeployResult, deploymentUrl: string) => void;
}

export const AddToChangesetStatusModal: FunctionComponent<AddToChangesetStatusModalProps> = ({
  selectedOrg,
  changesetName,
  changesetDescription,
  changeset,
  selectedMetadata,
  hideModal,
  onGoBack,
  onClose,
  onDownload,
}) => {
  const { serverUrl } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);
  const [deployStatusUrl, setDeployStatusUrl] = useState<string | null>(null);
  const { deployMetadata, results, deployId, loading, status, lastChecked, hasError, errorMessage } = useAddItemsToChangeset(selectedOrg, {
    changesetName,
    changesetDescription,
    selectedMetadata,
  });

  useEffect(() => {
    if (selectedOrg && changesetName) {
      deployMetadata();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, changesetName]);

  useNonInitialEffect(() => {
    if (deployId) {
      setDeployStatusUrl(getDeploymentStatusUrl(deployId));
    }
  }, [deployId]);

  return (
    <DeployMetadataStatusModal
      destinationOrg={selectedOrg}
      deployLabel="Add to Changeset"
      inProgressLabel="Your items are being added, this may take a few minutes."
      finishedSuccessfullyLabel="Your changeset has been updated successfully"
      finishedPartialSuccessfullyLabel="Your changeset has been partially updated"
      fallbackErrorMessageLabel="There was a problem updating your changeset."
      fallbackUnknownErrorMessageLabel="There was a problem updating your changeset."
      deployStatusUrl={deployStatusUrl}
      loading={loading}
      status={status}
      results={results}
      lastChecked={lastChecked}
      errorMessage={errorMessage}
      hasError={hasError}
      statusUrls={
        <Fragment>
          {changeset?.link && (
            <div>
              <SalesforceLogin
                org={selectedOrg}
                serverUrl={serverUrl}
                skipFrontDoorAuth={skipFrontDoorAuth}
                iconPosition="right"
                returnUrl={getLightningChangesetUrl(changeset)}
              >
                View the outbound changeset.
              </SalesforceLogin>
            </div>
          )}
          {deployStatusUrl && (
            <div>
              <SalesforceLogin
                org={selectedOrg}
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

export default AddToChangesetStatusModal;

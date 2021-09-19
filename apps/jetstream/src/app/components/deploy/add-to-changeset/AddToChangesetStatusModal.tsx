import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployResult, ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { SalesforceLogin } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import { getChangesetUrl, getDeploymentStatusUrl } from '../utils/deploy-metadata.utils';
import DeployMetadataStatusModal from '../utils/DeployMetadataStatusModal';
import { getStatusValue, useAddItemsToChangeset } from '../utils/useAddItemsToChangeset';

export interface AddToChangesetStatusModalProps {
  selectedOrg: SalesforceOrgUi;
  selectedMetadata: MapOf<ListMetadataResult[]>;
  changesetName: string;
  changesetDescription: string;
  changesetId?: string;
  // used to hide while download window is open
  hideModal: boolean;
  onClose: () => void;
  onDownload: (deployResults: DeployResult, deploymentUrl: string) => void;
}

export const AddToChangesetStatusModal: FunctionComponent<AddToChangesetStatusModalProps> = ({
  selectedOrg,
  changesetName,
  changesetDescription,
  changesetId,
  selectedMetadata,
  hideModal,
  onClose,
  onDownload,
}) => {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [deployStatusUrl, setDeployStatusUrl] = useState<string>();
  const [changesetUrl, setChangesetUrl] = useState<string>();
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

  useEffect(() => {
    if (changesetId) {
      setChangesetUrl(getChangesetUrl(changesetId));
    }
  }, [changesetId]);

  return (
    <DeployMetadataStatusModal
      destinationOrg={selectedOrg}
      deployLabel="Add to Changeset"
      inProgressLabel="Your items are being added, this may take a few minutes."
      finishedSuccessfullyLabel="Your changeset has been updated successfully"
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
          {changesetUrl && (
            <div>
              <SalesforceLogin org={selectedOrg} serverUrl={serverUrl} iconPosition="right" returnUrl={changesetUrl}>
                View the outbound changeset.
              </SalesforceLogin>
            </div>
          )}
          {deployStatusUrl && (
            <div>
              <SalesforceLogin org={selectedOrg} serverUrl={serverUrl} iconPosition="right" returnUrl={deployStatusUrl}>
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

export default AddToChangesetStatusModal;

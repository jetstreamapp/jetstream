/** @jsx jsx */
import { jsx } from '@emotion/react';
import { ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Icon, Modal, SalesforceLogin } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { AddItemsToChangesetStatus, useAddItemsToChangeset } from './utils/useSelfDeployToChangeset';
import formatDate from 'date-fns/format';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { getDeploymentStatusUrl } from 'apps/jetstream/src/app/components/deploy/deploy-metadata/utils/deploy-metadata.utils';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from 'apps/jetstream/src/app/app-state';

export interface DeployMetadataUploadStatusModalProps {
  selectedOrg: SalesforceOrgUi;
  selectedMetadata: MapOf<ListMetadataResult[]>;
  changesetName: string;
  changesetDescription: string;
  onClose: () => void;
}

export const DeployMetadataUploadStatusModal: FunctionComponent<DeployMetadataUploadStatusModalProps> = ({
  selectedOrg,
  changesetName,
  changesetDescription,
  selectedMetadata,
  onClose,
}) => {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [deployStatusUrl, setDeployStatusUrl] = useState<string>();
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

  function getStatusValue(value: AddItemsToChangesetStatus) {
    switch (value) {
      case 'submitting':
        return 'Requesting metadata from org';
      case 'preparing':
        return 'Waiting for metadata to be ready';
      case 'adding':
        return 'Adding metadata to changeset';
      default:
        return '';
    }
  }

  return (
    <Modal
      header="Deploy Metadata Status"
      closeDisabled={loading}
      closeOnBackdropClick={false}
      closeOnEsc={false}
      footer={
        <Fragment>
          <button className="slds-button slds-button_brand" onClick={() => onClose()} disabled={loading}>
            Close
          </button>
        </Fragment>
      }
      size="lg"
      onClose={onClose}
    >
      <div className="slds-is-relative slds-m-around_large">
        {status !== 'idle' && (
          <div>
            <div>Your items are being added to your changeset, this may take a few minutes.</div>
            <p>
              <strong>Status:</strong> {getStatusValue(status)}
            </p>
            {lastChecked && (
              <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_xx-small">
                {formatDate(lastChecked, DATE_FORMATS.FULL)}
              </p>
            )}
          </div>
        )}
        {status === 'idle' && results && (
          <Fragment>
            {results.status === 'Succeeded' && (
              <div>
                <div>
                  Your deployment has finished successfully
                  <Icon
                    type="utility"
                    icon="success"
                    className="slds-icon slds-icon-text-success slds-icon_x-small slds-m-left_xx-small"
                    containerClassname="slds-icon_container slds-icon-utility-success"
                    description="deployed successfully"
                  />
                </div>
                <p>
                  <strong>Status:</strong> {results.status}
                </p>
                <div>Number of items deployed: {results.numberComponentsDeployed}</div>
              </div>
            )}
            {results.status !== 'Succeeded' && (
              <div>
                <div>
                  There was a problem deploying your metadata.
                  <Icon
                    type="utility"
                    icon="error"
                    className="slds-icon slds-icon-text-error slds-icon_x-small slds-m-left_xx-small"
                    containerClassname="slds-icon_container slds-icon-utility-error"
                    description="There was an error with the deployment"
                  />
                </div>
              </div>
            )}
          </Fragment>
        )}
        {deployStatusUrl && (
          <div>
            <SalesforceLogin org={selectedOrg} serverUrl={serverUrl} iconPosition="right" returnUrl={deployStatusUrl}>
              View the deployment details in Salesforce.
            </SalesforceLogin>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DeployMetadataUploadStatusModal;

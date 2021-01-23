/** @jsx jsx */
import { jsx } from '@emotion/react';
import { ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Modal } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect } from 'react';
import { AddItemsToChangesetStatus, useAddItemsToChangeset } from './utils/useSelfDeployToChangeset';
import formatDate from 'date-fns/format';
import { DATE_FORMATS } from '@jetstream/shared/constants';

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
            <div>Your items are being added to your changeset. This may take a few minutes...</div>
            <p>{getStatusValue(status)}</p>
            {deployId && <p>Salesforce is processing the deployment, you can monitor the status here {deployId}</p>}
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
                  Your deployment has finished successfully{' '}
                  <span role="img" aria-label="tada">
                    🎉
                  </span>
                </div>
                <p>{results.status}</p>
                <div>Number of items deployed: {results.numberComponentsDeployed}</div>
              </div>
            )}
            {results.status !== 'Succeeded' && (
              <div>
                <div>There was a problem deploying your metadata.</div>
                <p>{results.status}</p>
              </div>
            )}
          </Fragment>
        )}
      </div>
    </Modal>
  );
};

export default DeployMetadataUploadStatusModal;

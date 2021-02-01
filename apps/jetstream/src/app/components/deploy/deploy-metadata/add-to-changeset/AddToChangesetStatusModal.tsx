/** @jsx jsx */
import { jsx } from '@emotion/react';
import { ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Icon, Modal, SalesforceLogin } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { getStatusValue, useAddItemsToChangeset } from '../utils/useAddItemsToChangeset';
import formatDate from 'date-fns/format';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { getDeploymentStatusUrl, getChangesetUrl } from '../utils/deploy-metadata.utils';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../../app-state';

export interface AddToChangesetStatusModalProps {
  selectedOrg: SalesforceOrgUi;
  selectedMetadata: MapOf<ListMetadataResult[]>;
  changesetName: string;
  changesetDescription: string;
  changesetId?: string;
  onClose: () => void;
}

export const AddToChangesetStatusModal: FunctionComponent<AddToChangesetStatusModalProps> = ({
  selectedOrg,
  changesetName,
  changesetDescription,
  changesetId,
  selectedMetadata,
  onClose,
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
    <Modal
      header="Update Outbound Changeset"
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
                {changesetUrl && (
                  <div>
                    <SalesforceLogin org={selectedOrg} serverUrl={serverUrl} iconPosition="right" returnUrl={changesetUrl}>
                      View the outbound changeset.
                    </SalesforceLogin>
                  </div>
                )}
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
              View the deployment details.
            </SalesforceLogin>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AddToChangesetStatusModal;

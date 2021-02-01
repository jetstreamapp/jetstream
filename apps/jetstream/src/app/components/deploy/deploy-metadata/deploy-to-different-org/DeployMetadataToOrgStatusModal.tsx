/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, DeployResult, ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Grid, Icon, Modal, SalesforceLogin } from '@jetstream/ui';
import formatDate from 'date-fns/format';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../../app-state';
import { getDeploymentStatusUrl } from '../utils/deploy-metadata.utils';
import DeployMetadataProgressSummary from '../utils/DeployMetadataProgressSummary';
import { getStatusValue, useDeployMetadata } from '../utils/useDeployMetadata';

export interface DeployMetadataToOrgStatusModalProps {
  sourceOrg: SalesforceOrgUi;
  destinationOrg: SalesforceOrgUi;
  selectedMetadata: MapOf<ListMetadataResult[]>;
  deployOptions: DeployOptions;
  // used to hide while download window is open
  hideModal: boolean;
  onClose: () => void;
  onDownload: (deployResults: DeployResult, deploymentUrl: string) => void;
}

export const DeployMetadataToOrgStatusModal: FunctionComponent<DeployMetadataToOrgStatusModalProps> = ({
  sourceOrg,
  destinationOrg,
  selectedMetadata,
  deployOptions,
  hideModal,
  onClose,
  onDownload,
}) => {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [deployStatusUrl, setDeployStatusUrl] = useState<string>();
  const { deployMetadata, results, deployId, loading, status, lastChecked, hasError, errorMessage } = useDeployMetadata(
    sourceOrg,
    destinationOrg,
    selectedMetadata,
    deployOptions
  );

  useEffect(() => {
    deployMetadata();
  }, []);

  useNonInitialEffect(() => {
    if (deployId) {
      setDeployStatusUrl(getDeploymentStatusUrl(deployId));
    }
  }, [deployId]);

  return (
    <Modal
      hide={hideModal}
      header="Deploy Metadata"
      closeDisabled={loading}
      closeOnBackdropClick={false}
      closeOnEsc={false}
      footer={
        <Grid align="spread">
          <button
            className="slds-button slds-button_neutral"
            disabled={!results?.done}
            onClick={() => {
              onDownload(results, `${destinationOrg.instanceUrl}${deployStatusUrl}`);
            }}
          >
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download Results
          </button>
          <button className="slds-button slds-button_brand" onClick={() => onClose()} disabled={loading}>
            Close
          </button>
        </Grid>
      }
      size="lg"
      onClose={onClose}
    >
      <div
        className="slds-is-relative slds-m-around_large"
        css={css`
          min-height: 225px;
        `}
      >
        {status !== 'idle' && (
          <div>
            <div>Your items are being deployed, this may take a few minutes.</div>
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
              </div>
            )}
            {results.status !== 'Succeeded' && (
              <div>
                <div>
                  {errorMessage || 'There was a problem deploying your metadata.'}
                  <Icon
                    type="utility"
                    icon="error"
                    className="slds-icon slds-icon-text-error slds-icon_x-small slds-m-left_xx-small"
                    containerClassname="slds-icon_container slds-icon-utility-error"
                    description="There was an error with the deployment"
                  />
                </div>
                <p>
                  <strong>Status:</strong> {results.status}
                </p>
              </div>
            )}
          </Fragment>
        )}
        {status === 'idle' && !results && hasError && (
          <div>
            <div>
              {errorMessage || 'There was an unknown problem deploying your metadata.'}
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
        {deployStatusUrl && (
          <div>
            <SalesforceLogin org={destinationOrg} serverUrl={serverUrl} iconPosition="right" returnUrl={deployStatusUrl}>
              View the deployment details.
            </SalesforceLogin>
          </div>
        )}
        {results && (
          <Fragment>
            <Grid className="slds-m-top_large">
              <DeployMetadataProgressSummary
                className="slds-m-right_large"
                title={`${results.checkOnly ? 'Validate' : 'Deploy'} Results`}
                status={results.status}
                totalProcessed={results.numberComponentsDeployed}
                totalErrors={results.numberComponentErrors}
                totalItems={results.numberComponentsTotal}
              />
              {results.runTestsEnabled && (
                <DeployMetadataProgressSummary
                  title="Unit Test Results"
                  status={results.status}
                  totalProcessed={results.numberTestsCompleted}
                  totalErrors={results.numberTestErrors}
                  totalItems={results.numberTestsTotal}
                />
              )}
            </Grid>
          </Fragment>
        )}
      </div>
    </Modal>
  );
};

export default DeployMetadataToOrgStatusModal;

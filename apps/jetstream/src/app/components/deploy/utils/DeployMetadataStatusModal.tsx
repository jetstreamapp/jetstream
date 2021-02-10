/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { DeployResult, SalesforceOrgUi } from '@jetstream/types';
import { Grid, Icon, Modal } from '@jetstream/ui';
import formatDate from 'date-fns/format';
import { Fragment, FunctionComponent } from 'react';
import OrgLabelBadge from '../../core/OrgLabelBadge';
import { DeployMetadataStatus } from '../deploy-metadata.types';
import DeployMetadataProgressSummary from './DeployMetadataProgressSummary';

export interface DeployMetadataStatusModalProps {
  destinationOrg: SalesforceOrgUi;
  deployLabel?: string;
  inProgressLabel?: string;
  finishedSuccessfullyLabel?: string;
  fallbackErrorMessageLabel?: string;
  fallbackUnknownErrorMessageLabel?: string;
  deployStatusUrl: string;
  loading: boolean;
  status: DeployMetadataStatus;
  results: DeployResult;
  lastChecked: Date;
  errorMessage: string;
  hasError: boolean;
  // if provided, this will show links to access the metadata
  statusUrls?: React.ReactNode;
  // used to hide while download window is open
  hideModal?: boolean;
  // return a string to translate statuses into values
  getStatusValue: (value: DeployMetadataStatus) => string;
  onClose: () => void;
  onDownload?: (deployResults: DeployResult, deploymentUrl: string) => void;
}

export const DeployMetadataStatusModal: FunctionComponent<DeployMetadataStatusModalProps> = ({
  destinationOrg,
  deployLabel = 'Deploy',
  inProgressLabel = 'Your items are being deployed, this may take a few minutes.',
  finishedSuccessfullyLabel = 'Your deployment has finished successfully',
  fallbackErrorMessageLabel = 'There was a problem deploying your metadata.',
  fallbackUnknownErrorMessageLabel = 'There was a problem deploying your metadata.',
  deployStatusUrl,
  loading,
  status,
  results,
  lastChecked,
  errorMessage,
  hasError,
  statusUrls,
  hideModal,
  getStatusValue,
  onClose,
  onDownload,
}) => {
  return (
    <Modal
      hide={hideModal}
      header="Deploy Metadata"
      closeDisabled={loading}
      closeOnBackdropClick={false}
      closeOnEsc={false}
      tagline={
        <div className="slds-align_absolute-center">
          Deploying changes to <OrgLabelBadge org={destinationOrg} />
        </div>
      }
      footer={
        <Grid align="spread">
          <div>
            {onDownload && (
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
            )}
          </div>
          <button className="slds-button slds-button_brand" onClick={() => onClose()} disabled={loading}>
            Close
          </button>
        </Grid>
      }
      size="lg"
      onClose={onClose}
    >
      <div
        className="slds-is-relative slds-m-horizontal_large slds-m-vertical_small"
        css={css`
          min-height: 225px;
        `}
      >
        {status !== 'idle' && (
          <div>
            <div>{inProgressLabel}</div>
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
                  {finishedSuccessfullyLabel}
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
                  {errorMessage || fallbackErrorMessageLabel}
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
            <div className="slds-text-color_error">
              {errorMessage || fallbackUnknownErrorMessageLabel}
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
        {statusUrls}
        {results && (
          <Fragment>
            <Grid className="slds-m-top_large">
              <DeployMetadataProgressSummary
                className="slds-m-right_large"
                title={`${results.checkOnly ? 'Validate' : deployLabel} Results`}
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

export default DeployMetadataStatusModal;

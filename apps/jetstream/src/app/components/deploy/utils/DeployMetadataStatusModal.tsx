/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { DeployResult, SalesforceOrgUi } from '@jetstream/types';
import { Grid, GridCol, Icon, Modal, TabsRef } from '@jetstream/ui';
import formatDate from 'date-fns/format';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import OrgLabelBadge from '../../core/OrgLabelBadge';
import { DeployMetadataStatus } from '../deploy-metadata.types';
import DeployMetadataProgressSummary from './DeployMetadataProgressSummary';
import DeployMetadataResultsTables from './DeployMetadataResultsTables';

const DivWithTopMargin: FunctionComponent = ({ children }) => (
  <div
    css={css`
      margin-top: 0.6rem;
    `}
  >
    {children}
  </div>
);

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
  const [hasErrors, setHasErrors] = useState(false);
  const tabsRef = useRef<TabsRef>();
  // when errors are encountered for the first time, focus the errors tab
  useEffect(() => {
    if (results?.details?.componentFailures?.length > 0 && !hasErrors && tabsRef.current) {
      setHasErrors(true);
      tabsRef.current.changeTab('component-errors');
    }
  }, [hasErrors, results]);

  return (
    <Modal
      classStyles={css`
        min-height: 50vh;
        max-height: 50vh;
      `}
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
        <Grid>
          <GridCol
            growNone
            className="slds-m-right_xx-small"
            css={css`
              min-width: 265px;
            `}
          >
            {status !== 'idle' && (
              <DivWithTopMargin>
                <div>{inProgressLabel}</div>
                <p>
                  <strong>Status:</strong> {getStatusValue(status)}
                </p>
                {lastChecked && (
                  <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_xx-small">
                    {formatDate(lastChecked, DATE_FORMATS.HH_MM_SS_a)}
                  </p>
                )}
              </DivWithTopMargin>
            )}
            {status === 'idle' && results && (
              <Fragment>
                {results.status === 'Succeeded' && (
                  <DivWithTopMargin>
                    <div className="slds-text-color_success">
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
                  </DivWithTopMargin>
                )}
                {results.status !== 'Succeeded' && (
                  <DivWithTopMargin>
                    <div className="slds-text-color_error">
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
                  </DivWithTopMargin>
                )}
              </Fragment>
            )}
            {status === 'idle' && !results && hasError && (
              <DivWithTopMargin>
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
              </DivWithTopMargin>
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
                    totalErrors={results.numberComponentErrors || results.details?.componentFailures.length}
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
          </GridCol>
          <GridCol grow className="slds-scrollable">
            {results && <DeployMetadataResultsTables results={results} />}
          </GridCol>
        </Grid>
      </div>
    </Modal>
  );
};

export default DeployMetadataStatusModal;

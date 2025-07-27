import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, MIME_TYPES } from '@jetstream/shared/constants';
import { saveFile, useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { ReadMetadataRecordTypeExtended } from '@jetstream/types';
import { Grid, GridCol, Icon, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import {
  ConfirmPageChange,
  DeployMetadataProgressSummary,
  DeployMetadataResultsTables,
  useAmplitude,
  useDeployMetadataPackage,
} from '@jetstream/ui-core';
import { applicationCookieState, selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, useState } from 'react';
import { RecordTypePicklistSummary, ViewMode } from '../types/record-types.types';
import { prepareRecordTypeMetadataPackage } from '../utils/record-types.utils';
import { DeploymentSummary } from './DeploymentModalSummary';

interface DeploymentModalProps {
  modifiedValues: RecordTypePicklistSummary[];
  recordTypeMetadataByFullName: Record<string, ReadMetadataRecordTypeExtended>;
  viewMode: ViewMode;
  onClose: (didDeploy: boolean) => void;
}

export function DeploymentModal({ modifiedValues, recordTypeMetadataByFullName, viewMode, onClose }: DeploymentModalProps) {
  const rollbar = useRollbar();
  const { trackEvent } = useAmplitude();
  const { defaultApiVersion: apiVersion, serverUrl } = useAtomValue(applicationCookieState);
  const selectedOrg = useAtomValue(selectedOrgState);
  const [inProgress, setInProgress] = useState(false);
  const [prepareError, setPrepareError] = useState(false);

  const {
    deployMetadata: doDeployMetadata,
    results,
    loading: deployLoading,
    lastChecked,
    hasError,
    errorMessage,
  } = useDeployMetadataPackage(serverUrl);

  async function handleDownload() {
    const file = await prepareRecordTypeMetadataPackage({
      apiVersion,
      modifiedValues,
      recordTypesByFullName: recordTypeMetadataByFullName,
    });
    saveFile(file, `package.zip`, MIME_TYPES.ZIP);
    trackEvent(ANALYTICS_KEYS.record_type_picklist_download_package, { viewMode, modifiedValuesLength: modifiedValues.length });
  }

  async function handleDeploy() {
    try {
      setInProgress(true);
      const file = await prepareRecordTypeMetadataPackage({
        apiVersion,
        modifiedValues,
        recordTypesByFullName: recordTypeMetadataByFullName,
      });

      // upload package and show status
      // TODO: make sure this works in production - do we need to adjust the run tests?
      await doDeployMetadata(selectedOrg, file, {
        rollbackOnError: true,
        singlePackage: true,
        allowMissingFiles: false,
      });
      trackEvent(ANALYTICS_KEYS.record_type_picklist_deploy, { viewMode, modifiedValuesLength: modifiedValues.length });
    } catch (ex) {
      logger.error('Error preparing deployment package', ex);
      setPrepareError(true);
      rollbar.error('Record Type Picklist: Error preparing deployment package', getErrorMessageAndStackObj(ex));
    } finally {
      setInProgress(false);
    }
  }

  return (
    <Fragment>
      <ConfirmPageChange actionInProgress={inProgress || deployLoading} />
      <Modal
        size="lg"
        header="Deploy Changes"
        closeOnEsc={false}
        closeOnBackdropClick={false}
        closeDisabled={inProgress}
        onClose={() => onClose(!!results)}
        footer={
          <Grid align="spread">
            <div>
              <button className="slds-button slds-button_neutral" onClick={() => handleDownload()} disabled={inProgress}>
                <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                Download Metadata Package
              </button>
            </div>
            <div>
              <button className="slds-button slds-button_neutral" onClick={() => onClose(false)} disabled={inProgress}>
                Close
              </button>
              <button className="slds-button slds-button_brand" onClick={handleDeploy} disabled={inProgress}>
                Deploy
              </button>
            </div>
          </Grid>
        }
      >
        <div
          css={css`
            height: 75vh;
          `}
          className="slds-is-relative"
        >
          {(inProgress || deployLoading) && <Spinner />}

          {prepareError && (
            <ScopedNotification theme="error" className="slds-m-vertical_medium">
              There was an error preparing your deployment package. Please try again.
            </ScopedNotification>
          )}
          {errorMessage && (
            <ScopedNotification theme="error" className="slds-m-vertical_medium">
              {errorMessage || 'Unknown error'}
            </ScopedNotification>
          )}
          {!results && (
            <div>
              <p>The following Record Type picklist fields have been modified:</p>
              <DeploymentSummary modifiedValues={modifiedValues} viewMode={viewMode} />
            </div>
          )}
          {results && (
            <>
              <GridCol size={2}>
                <DeployMetadataProgressSummary
                  className="slds-m-right_large"
                  title="Deploy Results"
                  status={results.status}
                  totalProcessed={results.numberComponentsDeployed}
                  totalErrors={results.numberComponentErrors || results.details?.componentFailures.length || 0}
                  totalItems={results.numberComponentsTotal}
                />
              </GridCol>

              <GridCol className="slds-scrollable_x">
                <DeployMetadataResultsTables results={results} />
              </GridCol>
            </>
          )}
        </div>
      </Modal>
    </Fragment>
  );
}

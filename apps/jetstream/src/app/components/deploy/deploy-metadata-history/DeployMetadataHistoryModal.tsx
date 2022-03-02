import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { MapOf, SalesforceDeployHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, EmptyState, FileDownloadModal, Icon, Modal, OpenRoadIllustration, Spinner } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import * as fromAppState from '../../../app-state';
import { useAmplitude } from '../../core/analytics';
import ConfirmPageChange from '../../core/ConfirmPageChange';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import { getDeployResultsExcelData, getHistory, getHistoryItemFile } from '../utils/deploy-metadata.utils';
import DeployMetadataHistoryTable from './DeployMetadataHistoryTable';
import DeployMetadataHistoryViewResults from './DeployMetadataHistoryViewResults';

export const DeployMetadataHistoryModal: FunctionComponent = () => {
  const { trackEvent } = useAmplitude();
  const [{ serverUrl, google_apiKey, google_appId, google_clientId }] = useRecoilState(fromAppState.applicationCookieState);
  const [isOpen, setIsOpen] = useState(false);
  const [downloadPackageModalState, setDownloadPackageModalState] = useState<{ open: boolean; org: SalesforceOrgUi; data: ArrayBuffer }>({
    open: false,
    org: null,
    data: null,
  });
  const [viewItemModalState, setViewItemModalState] = useState<{ open: boolean; org: SalesforceOrgUi; item: SalesforceDeployHistoryItem }>({
    open: false,
    org: null,
    item: null,
  });
  const [downloadItemModalState, setDownloadItemModalState] = useState<{ open: boolean; org: SalesforceOrgUi; data: MapOf<any[]> }>({
    open: false,
    org: null,
    data: null,
  });
  const [historyItems, setHistoryItems] = useState<SalesforceDeployHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // TODO: if we cannot load history, we need to show an error
  const [error, setError] = useState<string>(null);
  const orgsById = useRecoilValue(fromAppState.salesforceOrgsById);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      (async () => {
        try {
          const items = await getHistory();
          logger.log('[DEPLOY HISTORY]', { items });
          setHistoryItems(items);
        } catch (ex) {
          // TODO: add rollbar
          logger.warn('Failed to get deploy history', ex);
          setError('There was an error retrieving your history.');
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [isOpen]);

  // useEffect(() => {
  //   if (isDone) {
  //     trackEvent(ANALYTICS_KEYS.deploy_finished, {
  //       checkOnly: results.checkOnly,
  //       completedDate: results.completedDate,
  //       numberComponentErrors: results.numberComponentErrors,
  //       numberComponentsDeployed: results.numberComponentsDeployed,
  //       numberComponentsTotal: results.numberComponentsTotal,
  //       numberTestErrors: results.numberTestErrors,
  //       numberTestsCompleted: results.numberTestsCompleted,
  //       numberTestsTotal: results.numberTestsTotal,
  //       rollbackOnError: results.rollbackOnError,
  //       runTestsEnabled: results.runTestsEnabled,
  //       startDate: results.startDate,
  //       success: results.success,
  //     });
  //   }
  // }, [isDone]);

  function handleToggleOpen(open: boolean) {
    setIsOpen(open);
  }

  async function handleDownload(item: SalesforceDeployHistoryItem) {
    try {
      logger.log('[DEPLOY HISTORY] Selected Item for download', { item });
      const file = await getHistoryItemFile(item);
      setDownloadPackageModalState({
        open: true,
        org: orgsById[item.destinationOrg.uniqueId],
        data: file,
      });
    } catch (ex) {
      logger.warn('Failed to download deploy history item', ex);
      // TODO: rollbar, show error to user (maybe toast?)
    }
  }

  function handleDownloadModalClose() {
    setDownloadPackageModalState({ open: false, org: null, data: null });
  }

  async function handleViewModalOpen(item: SalesforceDeployHistoryItem) {
    try {
      logger.log('[DEPLOY HISTORY] Selected Item', { item });
      setViewItemModalState({
        open: true,
        org: orgsById[item.destinationOrg.uniqueId],
        item,
      });
    } catch (ex) {
      logger.warn('Failed to download deploy history item', ex);
      // TODO: rollbar, show error to user (maybe toast?)
    }
  }

  function handleViewModalClose() {
    setViewItemModalState({ open: false, org: null, item: null });
    handleToggleOpen(false);
  }

  function handleViewModalGoBack() {
    setViewItemModalState({ open: false, org: null, item: null });
  }

  /** Initiated from view modal */
  function handleDownloadResults() {
    setDownloadItemModalState({
      open: true,
      org: viewItemModalState.org,
      data: getDeployResultsExcelData(
        viewItemModalState.item.results,
        `${viewItemModalState.org.instanceUrl}${viewItemModalState.item.url}`
      ),
    });
    setViewItemModalState({ open: false, org: null, item: null });
  }

  function handleDownloadResultsModalClose() {
    setDownloadItemModalState({ open: false, org: null, data: null });
  }

  return (
    <Fragment>
      <button
        className="slds-button slds-button_neutral"
        aria-haspopup="true"
        title="View deployment history"
        onClick={() => handleToggleOpen(true)}
      >
        <Icon type="utility" icon="date_time" className="slds-button__icon slds-button__icon_left" omitContainer />
        History
      </button>
      {downloadPackageModalState.open && (
        <FileDownloadModal
          org={downloadPackageModalState.org}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Download Package"
          data={downloadPackageModalState.data}
          fileNameParts={['package']}
          allowedTypes={['zip']}
          onModalClose={() => handleDownloadModalClose()}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      {downloadItemModalState.open && (
        <FileDownloadModal
          org={downloadItemModalState.org}
          modalHeader="Download Deploy Results"
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          fileNameParts={['deploy-results']}
          allowedTypes={['xlsx']}
          data={downloadItemModalState.data}
          onModalClose={() => handleDownloadResultsModalClose()}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      {viewItemModalState.open && (
        <DeployMetadataHistoryViewResults
          item={viewItemModalState.item}
          destinationOrg={viewItemModalState.org}
          serverUrl={serverUrl}
          onGoBack={handleViewModalGoBack}
          onClose={handleViewModalClose}
          onDownload={handleDownloadResults}
        />
      )}
      {isOpen && (
        <Modal
          classStyles={css`
            min-height: 70vh;
            max-height: 70vh;
          `}
          hide={downloadPackageModalState.open || viewItemModalState.open || downloadItemModalState.open}
          header="Deploy History"
          closeDisabled={false}
          closeOnBackdropClick={false}
          closeOnEsc={false}
          footer={
            <button className="slds-button slds-button_brand" onClick={() => handleToggleOpen(false)} disabled={false}>
              Close
            </button>
          }
          size="lg"
          onClose={() => handleToggleOpen(false)}
        >
          <div className="slds-is-relative slds-scrollable_x">
            <ConfirmPageChange actionInProgress={false} />
            {isLoading && <Spinner />}
            {historyItems?.length === 0 && !isLoading && (
              <EmptyState headline="You don't have any deployment history" illustration={<OpenRoadIllustration />}></EmptyState>
            )}
            {!!historyItems?.length && (
              <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={250}>
                <DeployMetadataHistoryTable
                  items={historyItems}
                  orgsById={orgsById}
                  onDownload={handleDownload}
                  onView={handleViewModalOpen}
                />
              </AutoFullHeightContainer>
            )}
          </div>
        </Modal>
      )}
    </Fragment>
  );
};

export default DeployMetadataHistoryModal;

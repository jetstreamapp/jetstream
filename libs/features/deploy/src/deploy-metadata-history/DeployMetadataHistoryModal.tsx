import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { hasModifierKey, isHKey, useGlobalEventHandler, useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { SalesforceDeployHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import {
  EmptyState,
  FileDownloadModal,
  Icon,
  KeyboardShortcut,
  Modal,
  OpenRoadIllustration,
  ScopedNotification,
  Spinner,
  Tooltip,
  fireToast,
  getModifierKey,
} from '@jetstream/ui';
import { ConfirmPageChange, fromAppState, fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import classNames from 'classnames';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { getDeployResultsExcelData, getHistory, getHistoryItemFile } from '../utils/deploy-metadata.utils';
import DeployMetadataHistoryTable from './DeployMetadataHistoryTable';
import DeployMetadataHistoryViewResults from './DeployMetadataHistoryViewResults';

interface DeployMetadataHistoryModalProps {
  className?: string;
}

export const DeployMetadataHistoryModal = ({ className }: DeployMetadataHistoryModalProps) => {
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const modalRef = useRef(null);
  const [{ serverUrl, google_apiKey, google_appId, google_clientId }] = useRecoilState(fromAppState.applicationCookieState);
  const [isOpen, setIsOpen] = useState(false);
  const [downloadPackageModalState, setDownloadPackageModalState] = useState<{
    open: boolean;
    org: SalesforceOrgUi | null;
    data: ArrayBuffer | null;
  }>({
    open: false,
    org: null,
    data: null,
  });
  const [viewItemModalState, setViewItemModalState] = useState<{
    open: boolean;
    org: SalesforceOrgUi | null;
    item: SalesforceDeployHistoryItem | null;
  }>({
    open: false,
    org: null,
    item: null,
  });
  const [downloadItemModalState, setDownloadItemModalState] = useState<{
    open: boolean;
    org: SalesforceOrgUi | null;
    data: Record<string, any[]> | null;
  }>({
    open: false,
    org: null,
    data: null,
  });
  const [historyItems, setHistoryItems] = useState<SalesforceDeployHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setError] = useState<string | null>(null);
  const orgsById = useRecoilValue(fromAppState.salesforceOrgsById);

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen && hasModifierKey(event as any) && isHKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        handleToggleOpen(true, 'keyboardShortcut');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen]
  );

  useGlobalEventHandler('keydown', onKeydown);

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
          logger.warn('Failed to get deploy history', ex);
          setError('There was an error retrieving your history.');
          rollbar.error('Failed to get deploy history', getErrorMessageAndStackObj(ex));
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [isOpen]);

  function handleToggleOpen(open: boolean, source = 'buttonClick') {
    setIsOpen(open);
    if (open) {
      trackEvent(ANALYTICS_KEYS.deploy_history_opened, source);
    }
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
      trackEvent(ANALYTICS_KEYS.deploy_history_download_package, { type: item.type, status: item.status });
    } catch (ex) {
      logger.warn('Failed to download deploy history item', ex);
      rollbar.error('Failed to download deploy history item', getErrorMessageAndStackObj(ex));
      fireToast({
        message: 'There was an error downloading your file.',
        type: 'error',
      });
    }
  }

  function handleDownloadModalClose() {
    setDownloadPackageModalState({ open: false, org: null, data: null });
  }

  async function handleViewModalOpen(item: SalesforceDeployHistoryItem) {
    try {
      logger.log('[DEPLOY HISTORY] Selected Item to view', { item });
      setViewItemModalState({
        open: true,
        org: orgsById[item.destinationOrg.uniqueId],
        item,
      });
      trackEvent(ANALYTICS_KEYS.deploy_history_view_details, { type: item.type, status: item.status });
    } catch (ex) {
      logger.warn('Failed to view history', ex);
      rollbar.error('Failed to view history', getErrorMessageAndStackObj(ex));
      fireToast({
        message: 'Oops. There was a problem opening your history',
        type: 'error',
      });
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
    if (viewItemModalState.org && viewItemModalState.item?.results) {
      setDownloadItemModalState({
        open: true,
        org: viewItemModalState.org,
        data: getDeployResultsExcelData(
          viewItemModalState.item.results,
          `${viewItemModalState.org.instanceUrl}${viewItemModalState.item.url}`
        ),
      });
      setViewItemModalState({ open: false, org: null, item: null });
      trackEvent(ANALYTICS_KEYS.deploy_history_download_results, {
        type: viewItemModalState.item.type,
        status: viewItemModalState.item.status,
      });
    }
  }

  function handleDownloadResultsModalClose() {
    setDownloadItemModalState({ open: false, org: null, data: null });
  }

  return (
    <Fragment>
      <Tooltip
        content={
          <div className="slds-p-bottom_small">
            <KeyboardShortcut inverse keys={[getModifierKey(), 'h']} />
          </div>
        }
      >
        <button
          className={classNames('slds-button slds-button_neutral slds-m-right_xx-small', className)}
          aria-haspopup="true"
          title="View deployment history"
          onClick={() => handleToggleOpen(true)}
        >
          <Icon type="utility" icon="date_time" className="slds-button__icon slds-button__icon_left" omitContainer />
          <span>History</span>
        </button>
      </Tooltip>
      {downloadPackageModalState.open && downloadPackageModalState.org && downloadPackageModalState.data && (
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
      {downloadItemModalState.open && downloadItemModalState.org && downloadItemModalState.data && (
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
      {viewItemModalState.open && viewItemModalState.org && viewItemModalState.item && (
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
          ref={modalRef}
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
            {historyItems?.length === 0 && !isLoading && !errorMessage && (
              <EmptyState headline="You don't have any deployment history" illustration={<OpenRoadIllustration />}></EmptyState>
            )}
            {errorMessage && (
              <div className="slds-m-around-medium">
                <ScopedNotification theme="error" className="slds-m-top_medium">
                  {errorMessage}
                </ScopedNotification>
              </div>
            )}
            {!!historyItems?.length && (
              <div
                css={css`
                  height: calc(70vh - 2rem);
                `}
              >
                <DeployMetadataHistoryTable
                  items={historyItems}
                  orgsById={orgsById}
                  modalRef={modalRef}
                  onDownload={handleDownload}
                  onView={handleViewModalOpen}
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </Fragment>
  );
};

export default DeployMetadataHistoryModal;

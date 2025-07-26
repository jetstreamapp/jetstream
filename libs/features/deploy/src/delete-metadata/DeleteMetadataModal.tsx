import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { DeployOptions, DeployResult, ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal } from '@jetstream/ui';
import { fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useState } from 'react';
import { getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import DeleteMetadataConfigModal from './DeleteMetadataConfigModal';
import DeleteMetadataStatusModal from './DeleteMetadataStatusModal';

export interface DeleteMetadataModalProps {
  selectedOrg: SalesforceOrgUi;
  selectedMetadata: Record<string, ListMetadataResult[]>;
  onClose: () => void;
}

export const DeleteMetadataModal: FunctionComponent<DeleteMetadataModalProps> = ({ selectedOrg, selectedMetadata, onClose }) => {
  const { trackEvent } = useAmplitude();
  const { google_apiKey, google_appId, google_clientId, defaultApiVersion } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(true);
  const [deployStatusModalOpen, setDeployStatusModalOpen] = useState<boolean>(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [downloadPackageModalOpen, setDownloadPackageModalOpen] = useState<boolean>(false);
  const [file, setFile] = useState<ArrayBuffer>();
  const [deployOptions, setDeployOptions] = useState<DeployOptions>();
  const [deployResultsData, setDeployResultsData] = useState<Record<string, any[]>>();

  function handleDeploy(file: ArrayBuffer, deployOptions: DeployOptions) {
    setFile(file);
    setDeployOptions(deployOptions);
    setConfigModalOpen(false);
    setDeployStatusModalOpen(true);
    trackEvent(ANALYTICS_KEYS.deploy_deployMetadata, { type: 'package-to-org', deployOptions });
  }

  function handleGoBackFromDeploy() {
    setDeployStatusModalOpen(false);
    setConfigModalOpen(true);
  }

  function handleDeployResultsDownload(deployResults: DeployResult, deploymentUrl: string) {
    setDeployResultsData(getDeployResultsExcelData(deployResults, deploymentUrl));
    setDownloadResultsModalOpen(true);
  }

  function handleDownloadPackage(file: ArrayBuffer) {
    setFile(file);
    setConfigModalOpen(false);
    setDownloadPackageModalOpen(true);
  }

  return (
    <Fragment>
      {/* MODALS */}
      {configModalOpen && (
        <DeleteMetadataConfigModal
          selectedOrg={selectedOrg}
          defaultApiVersion={defaultApiVersion}
          selectedMetadata={selectedMetadata}
          initialOptions={deployOptions}
          onClose={() => onClose()}
          onDeploy={handleDeploy}
          onDownloadPackage={handleDownloadPackage}
        />
      )}
      {deployStatusModalOpen && deployOptions && file && (
        <DeleteMetadataStatusModal
          destinationOrg={selectedOrg}
          deployOptions={deployOptions}
          file={file}
          hideModal={downloadResultsModalOpen}
          onGoBack={handleGoBackFromDeploy}
          onClose={onClose}
          onDownload={handleDeployResultsDownload}
        />
      )}
      {downloadResultsModalOpen && deployResultsData && (
        <FileDownloadModal
          modalHeader="Download Deploy Results"
          org={selectedOrg}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          fileNameParts={['deploy-results']}
          allowedTypes={['xlsx']}
          data={deployResultsData}
          onModalClose={() => setDownloadResultsModalOpen(false)}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
          source="deploy_metadata_delete_modal"
          trackEvent={trackEvent}
        />
      )}
      {downloadPackageModalOpen && file && (
        <FileDownloadModal
          modalHeader="Download Destructive Package"
          org={selectedOrg}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          fileNameParts={['destructive-package']}
          allowedTypes={['zip']}
          data={file}
          onModalClose={() => {
            setDownloadPackageModalOpen(false);
            setConfigModalOpen(true);
          }}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
          source="deploy_metadata_delete_modal"
          trackEvent={trackEvent}
        />
      )}
    </Fragment>
  );
};

export default DeleteMetadataModal;

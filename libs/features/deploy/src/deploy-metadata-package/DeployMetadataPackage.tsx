import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { DeployOptions, DeployResult, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal, Icon } from '@jetstream/ui';
import { applicationCookieState, fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import classNames from 'classnames';
import { Fragment, FunctionComponent, useState } from 'react';
import { useRecoilState } from 'recoil';
import { getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import DeployMetadataPackageConfigModal from './DeployMetadataPackageConfigModal';
import DeployMetadataPackageStatusModal from './DeployMetadataPackageStatusModal';

export interface DeployMetadataPackageProps {
  className?: string;
  selectedOrg: SalesforceOrgUi;
}

export const DeployMetadataPackage: FunctionComponent<DeployMetadataPackageProps> = ({ className, selectedOrg: initialSelectedOrg }) => {
  const { trackEvent } = useAmplitude();
  const [{ google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const [destinationOrg, setDestinationOrg] = useState<SalesforceOrgUi>(initialSelectedOrg);
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [deployStatusModalOpen, setDeployStatusModalOpen] = useState<boolean>(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [fileInfo, setFileInfo] = useState<{ file?: ArrayBuffer; filename?: string; fileContents?: string[]; isSinglePackage?: boolean }>(
    {}
  );
  const [deployOptions, setDeployOptions] = useState<DeployOptions>();
  const [deployResultsData, setDeployResultsData] = useState<Record<string, any[]>>();

  function handleClick() {
    setDestinationOrg(initialSelectedOrg);
    setConfigModalOpen(true);
  }

  function handleDeploy(
    fileInfo: { file?: ArrayBuffer; filename?: string; fileContents?: string[]; isSinglePackage?: boolean },
    org: SalesforceOrgUi,
    deployOptions: DeployOptions
  ) {
    setFileInfo(fileInfo);
    setDestinationOrg(org);
    setDeployOptions(deployOptions);
    setConfigModalOpen(false);
    setDeployStatusModalOpen(true);
    trackEvent(ANALYTICS_KEYS.deploy_deployMetadata, { type: 'package-to-org', deployOptions });
  }

  function handleGoBackFromDeploy() {
    setDeployStatusModalOpen(false);
    setConfigModalOpen(true);
  }

  function handleCloseDeploymentModal() {
    setConfigModalOpen(false);
    setDeployStatusModalOpen(false);
  }

  function handleDeployResultsDownload(deployResults: DeployResult, deploymentUrl: string) {
    setDeployResultsData(getDeployResultsExcelData(deployResults, deploymentUrl));
    setDownloadResultsModalOpen(true);
  }

  return (
    <Fragment>
      <button
        className={classNames('slds-button slds-button_neutral', className)}
        onClick={handleClick}
        title="If you have an existing metadata package zip file, you can deploy that file to the currently selected org."
      >
        <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
        <span>Upload Metadata Zip</span>
      </button>
      {/* MODALS */}
      {configModalOpen && (
        <DeployMetadataPackageConfigModal
          selectedOrg={destinationOrg}
          initialOptions={deployOptions}
          initialFile={fileInfo.file}
          initialFilename={fileInfo.filename}
          initialFileContents={fileInfo.fileContents}
          initialIsSinglePackage={fileInfo.isSinglePackage}
          onClose={() => setConfigModalOpen(false)}
          onDeploy={handleDeploy}
        />
      )}
      {deployStatusModalOpen && deployOptions && fileInfo.file && (
        <DeployMetadataPackageStatusModal
          destinationOrg={destinationOrg}
          deployOptions={deployOptions}
          file={fileInfo.file}
          hideModal={downloadResultsModalOpen}
          onGoBack={handleGoBackFromDeploy}
          onClose={handleCloseDeploymentModal}
          onDownload={handleDeployResultsDownload}
        />
      )}
      {downloadResultsModalOpen && deployResultsData && (
        <FileDownloadModal
          modalHeader="Download Deploy Results"
          org={destinationOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          fileNameParts={['deploy-results']}
          allowedTypes={['xlsx']}
          data={deployResultsData}
          onModalClose={() => setDownloadResultsModalOpen(false)}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
    </Fragment>
  );
};

export default DeployMetadataPackage;

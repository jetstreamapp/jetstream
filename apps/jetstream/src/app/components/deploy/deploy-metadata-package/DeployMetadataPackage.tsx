/** @jsx jsx */
import { jsx } from '@emotion/react';
import { DeployOptions, DeployResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal, Icon } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import { getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import DeployMetadataPackageConfigModal from './DeployMetadataPackageConfigModal';
import DeployMetadataPackageStatusModal from './DeployMetadataPackageStatusModal';

export interface DeployMetadataPackageProps {
  selectedOrg: SalesforceOrgUi;
}

export const DeployMetadataPackage: FunctionComponent<DeployMetadataPackageProps> = ({ selectedOrg }) => {
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [deployStatusModalOpen, setDeployStatusModalOpen] = useState<boolean>(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [file, setFile] = useState<ArrayBuffer>();
  const [deployOptions, setDeployOptions] = useState<DeployOptions>();
  const [deployResultsData, setDeployResultsData] = useState<MapOf<any[]>>();

  function handleClick() {
    setConfigModalOpen(true);
  }

  function handleDeploy(file: ArrayBuffer, deployOptions: DeployOptions) {
    setFile(file);
    setDeployOptions(deployOptions);
    setConfigModalOpen(false);
    setDeployStatusModalOpen(true);
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
      <button className="slds-button slds-button_neutral" onClick={handleClick}>
        <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
        Upload Metadata Package
      </button>
      {/* MODALS */}
      {configModalOpen && (
        <DeployMetadataPackageConfigModal selectedOrg={selectedOrg} onClose={() => setConfigModalOpen(false)} onDeploy={handleDeploy} />
      )}
      {deployStatusModalOpen && (
        <DeployMetadataPackageStatusModal
          destinationOrg={selectedOrg}
          deployOptions={deployOptions}
          file={file}
          hideModal={downloadResultsModalOpen}
          onClose={handleCloseDeploymentModal}
          onDownload={handleDeployResultsDownload}
        />
      )}
      {downloadResultsModalOpen && (
        <FileDownloadModal
          modalHeader="Download Deploy Results"
          org={selectedOrg}
          fileNameParts={['deploy-results']}
          allowedTypes={['xlsx']}
          data={deployResultsData}
          onModalClose={() => setDownloadResultsModalOpen(false)}
        />
      )}
    </Fragment>
  );
};

export default DeployMetadataPackage;

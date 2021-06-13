/** @jsx jsx */
import { jsx } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { DeployOptions, DeployResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal, Icon } from '@jetstream/ui';
import { useAmplitude } from 'apps/jetstream/src/app/components/core/analytics';
import { Fragment, FunctionComponent, useState } from 'react';
import { getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import DeployMetadataPackageConfigModal from './DeployMetadataPackageConfigModal';
import DeployMetadataPackageStatusModal from './DeployMetadataPackageStatusModal';

export interface DeployMetadataPackageProps {
  selectedOrg: SalesforceOrgUi;
}

export const DeployMetadataPackage: FunctionComponent<DeployMetadataPackageProps> = ({ selectedOrg }) => {
  const { trackEvent } = useAmplitude();
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
    trackEvent(ANALYTICS_KEYS.deploy_deployMetadata, { type: 'package-to-org', deployOptions });
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
        className="slds-button slds-button_neutral"
        onClick={handleClick}
        title="If you have an existing metadata package zip file, you can deploy that file to the currently selected org."
      >
        <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
        Upload Metadata Zip
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

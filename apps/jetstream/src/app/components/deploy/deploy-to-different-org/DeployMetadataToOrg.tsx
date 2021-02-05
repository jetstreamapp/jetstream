/** @jsx jsx */
import { jsx } from '@emotion/react';
import { DeployOptions, DeployResult, ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal, Icon } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import { DeployMetadataTableRow } from '../deploy-metadata.types';
import { convertRowsToMapOfListMetadataResults, getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import DeployMetadataToOrgConfigModal from './DeployMetadataToOrgConfigModal';
import DeployMetadataToOrgStatusModal from './DeployMetadataToOrgStatusModal';

export interface DeployMetadataToOrgProps {
  selectedOrg: SalesforceOrgUi;
  loading: boolean;
  selectedRows: Set<DeployMetadataTableRow>;
}

export const DeployMetadataToOrg: FunctionComponent<DeployMetadataToOrgProps> = ({ selectedOrg, loading, selectedRows }) => {
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [deployStatusModalOpen, setDeployStatusModalOpen] = useState(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [deployResultsData, setDeployResultsData] = useState<MapOf<any[]>>();

  const [destinationOrg, setDestinationOrg] = useState<SalesforceOrgUi>();
  const [deployMetadataOptions, setDeployMetadataOptions] = useState<DeployOptions>();

  const [selectedMetadata, setSelectedMetadata] = useState<MapOf<ListMetadataResult[]>>();

  function handleClick() {
    setConfigModalOpen(true);
  }

  function handleCloseConfigModal() {
    setConfigModalOpen(false);
    setDeployMetadataOptions(null);
  }

  function handleDeployMetadata(destinationOrg: SalesforceOrgUi, deployOptions: DeployOptions) {
    setDestinationOrg(destinationOrg);
    setDeployMetadataOptions(deployOptions);
    setSelectedMetadata(convertRowsToMapOfListMetadataResults(Array.from(selectedRows)));
    setConfigModalOpen(false);
    setDeployStatusModalOpen(true);
  }

  function handleDeployResultsDownload(deployResults: DeployResult, deploymentUrl: string) {
    setDeployResultsData(getDeployResultsExcelData(deployResults, deploymentUrl));
    setDownloadResultsModalOpen(true);
  }

  return (
    <Fragment>
      <button className="slds-button slds-button_brand" disabled={loading || selectedRows.size === 0} onClick={handleClick}>
        <Icon type="utility" icon="share" className="slds-button__icon slds-button__icon_left" omitContainer />
        Deploy to Different Org
      </button>
      {/* MODALS */}
      {configModalOpen && <DeployMetadataToOrgConfigModal onClose={handleCloseConfigModal} onDeploy={handleDeployMetadata} />}
      {deployStatusModalOpen && (
        <DeployMetadataToOrgStatusModal
          hideModal={downloadResultsModalOpen}
          sourceOrg={selectedOrg}
          destinationOrg={destinationOrg}
          selectedMetadata={selectedMetadata}
          deployOptions={deployMetadataOptions}
          onClose={() => setDeployStatusModalOpen(false)}
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

export default DeployMetadataToOrg;

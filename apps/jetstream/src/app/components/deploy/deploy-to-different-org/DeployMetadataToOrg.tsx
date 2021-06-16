/** @jsx jsx */
import { jsx } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { DeployOptions, DeployResult, ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal, Icon } from '@jetstream/ui';
import { useAmplitude } from 'apps/jetstream/src/app/components/core/analytics';
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
  const { trackEvent } = useAmplitude();
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [deployStatusModalOpen, setDeployStatusModalOpen] = useState(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [deployResultsData, setDeployResultsData] = useState<MapOf<any[]>>();

  const [destinationOrg, setDestinationOrg] = useState<SalesforceOrgUi>();
  const [deployMetadataOptions, setDeployMetadataOptions] = useState<DeployOptions>();

  const [selectedMetadata, setSelectedMetadata] = useState<MapOf<ListMetadataResult[]>>();

  function handleClick() {
    setConfigModalOpen(true);
    setSelectedMetadata(convertRowsToMapOfListMetadataResults(Array.from(selectedRows)));
  }

  function handleCloseConfigModal() {
    setConfigModalOpen(false);
    setDeployMetadataOptions(null);
  }

  function handleDeployMetadata(destinationOrg: SalesforceOrgUi, deployOptions: DeployOptions) {
    setDestinationOrg(destinationOrg);
    setDeployMetadataOptions(deployOptions);
    setConfigModalOpen(false);
    setDeployStatusModalOpen(true);
    trackEvent(ANALYTICS_KEYS.deploy_deployMetadata, { type: 'org-to-org', deployOptions });
  }

  function handleDeployResultsDownload(deployResults: DeployResult, deploymentUrl: string) {
    setDeployResultsData(getDeployResultsExcelData(deployResults, deploymentUrl));
    setDownloadResultsModalOpen(true);
  }

  return (
    <Fragment>
      <button
        className="slds-button slds-button_brand"
        disabled={loading || selectedRows.size === 0}
        onClick={handleClick}
        title="Deploy the selected metadata to any other org."
      >
        <Icon type="utility" icon="share" className="slds-button__icon slds-button__icon_left" omitContainer />
        Deploy to Different Org
      </button>
      {/* MODALS */}
      {configModalOpen && (
        <DeployMetadataToOrgConfigModal
          sourceOrg={selectedOrg}
          selectedMetadata={selectedMetadata}
          onClose={handleCloseConfigModal}
          onDeploy={handleDeployMetadata}
        />
      )}
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

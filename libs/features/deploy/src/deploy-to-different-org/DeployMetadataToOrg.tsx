import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { DeployMetadataTableRow, DeployOptions, DeployResult, ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal, Icon } from '@jetstream/ui';
import { fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState } from '@jetstream/ui/app-state';
import { Fragment, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { convertRowsToMapOfListMetadataResults, getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import DeployMetadataToOrgConfigModal from './DeployMetadataToOrgConfigModal';
import DeployMetadataToOrgStatusModal from './DeployMetadataToOrgStatusModal';

export interface DeployMetadataToOrgProps {
  selectedOrg: SalesforceOrgUi;
  loading: boolean;
  selectedRows: Set<DeployMetadataTableRow>;
}

export const DeployMetadataToOrg = ({ selectedOrg, loading, selectedRows }: DeployMetadataToOrgProps) => {
  const { trackEvent } = useAmplitude();
  const { google_apiKey, google_appId, google_clientId } = useRecoilValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useRecoilValue(googleDriveAccessState);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [deployStatusModalOpen, setDeployStatusModalOpen] = useState(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [deployResultsData, setDeployResultsData] = useState<Record<string, any[]>>();

  const [destinationOrg, setDestinationOrg] = useState<SalesforceOrgUi>();
  const [deployMetadataOptions, setDeployMetadataOptions] = useState<DeployOptions | null>(null);

  const [selectedMetadata, setSelectedMetadata] = useState<Record<string, ListMetadataResult[]>>();

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

  function handleGoBackFromDeploy() {
    setDeployStatusModalOpen(false);
    setConfigModalOpen(true);
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
      {configModalOpen && selectedMetadata && (
        <DeployMetadataToOrgConfigModal
          sourceOrg={selectedOrg}
          initialOptions={deployMetadataOptions}
          initialSelectedDestinationOrg={destinationOrg}
          selectedMetadata={selectedMetadata}
          onClose={handleCloseConfigModal}
          onDeploy={handleDeployMetadata}
        />
      )}
      {deployStatusModalOpen && destinationOrg && selectedMetadata && (
        <DeployMetadataToOrgStatusModal
          hideModal={downloadResultsModalOpen}
          sourceOrg={selectedOrg}
          destinationOrg={destinationOrg}
          selectedMetadata={selectedMetadata}
          deployOptions={deployMetadataOptions || {}}
          onGoBack={handleGoBackFromDeploy}
          onClose={() => setDeployStatusModalOpen(false)}
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
          source="deploy_metadata_to_org"
          trackEvent={trackEvent}
        />
      )}
    </Fragment>
  );
};

export default DeployMetadataToOrg;

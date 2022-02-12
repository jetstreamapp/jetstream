import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { DeployOptions, DeployResult, ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import { useAmplitude } from '../../core/analytics';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import { getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import DeleteMetadataConfigModal from './DeleteMetadataConfigModal';
import DeleteMetadataStatusModal from './DeleteMetadataStatusModal';

export interface DeleteMetadataModalProps {
  selectedOrg: SalesforceOrgUi;
  selectedMetadata: MapOf<ListMetadataResult[]>;
  onClose: () => void;
}

export const DeleteMetadataModal: FunctionComponent<DeleteMetadataModalProps> = ({ selectedOrg, selectedMetadata, onClose }) => {
  const { trackEvent } = useAmplitude();
  const [{ google_apiKey, google_appId, google_clientId, defaultApiVersion }] = useRecoilState(applicationCookieState);
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(true);
  const [deployStatusModalOpen, setDeployStatusModalOpen] = useState<boolean>(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [file, setFile] = useState<ArrayBuffer>();
  const [deployOptions, setDeployOptions] = useState<DeployOptions>();
  const [deployResultsData, setDeployResultsData] = useState<MapOf<any[]>>();

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
        />
      )}
      {deployStatusModalOpen && (
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
      {downloadResultsModalOpen && (
        <FileDownloadModal
          modalHeader="Download Deploy Results"
          org={selectedOrg}
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

export default DeleteMetadataModal;

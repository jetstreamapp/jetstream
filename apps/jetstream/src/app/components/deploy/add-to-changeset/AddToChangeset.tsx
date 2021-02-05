/** @jsx jsx */
import { jsx } from '@emotion/react';
import { DeployResult, ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal, Icon } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import { useRecoilState } from 'recoil';
import * as fromDeployMetadataState from '../deploy-metadata.state';
import { DeployMetadataTableRow } from '../deploy-metadata.types';
import { convertRowsToMapOfListMetadataResults, getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import AddToChangesetConfigModal from './AddToChangesetConfigModal';
import AddToChangesetStatusModal from './AddToChangesetStatusModal';

export interface AddToChangesetProps {
  selectedOrg: SalesforceOrgUi;
  loading: boolean;
  selectedRows: Set<DeployMetadataTableRow>;
}

export const AddToChangeset: FunctionComponent<AddToChangesetProps> = ({ selectedOrg, loading, selectedRows }) => {
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [deployStatusModalOpen, setDeployStatusModalOpen] = useState(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [deployResultsData, setDeployResultsData] = useState<MapOf<any[]>>();

  const [changesetPackageName, setChangesetPackageName] = useState<string>();
  const [changesetPackageDescription, setChangesetPackageDescription] = useState<string>();
  const [changesetId, setChangesetId] = useState<string>(null);

  const [changesetPackage, setChangesetPackage] = useRecoilState(fromDeployMetadataState.changesetPackage);
  const [changesetPackages, setChangesetPackages] = useRecoilState(fromDeployMetadataState.changesetPackages);

  const [selectedMetadata, setSelectedMetadata] = useState<MapOf<ListMetadataResult[]>>();

  function handleClick() {
    setConfigModalOpen(true);
  }

  function handleDeployToChangeset(packageName: string, changesetDescription: string, changesetId?: string) {
    setChangesetPackageName(packageName);
    setChangesetPackageDescription(changesetDescription);
    setChangesetId(changesetId);
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
        <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
        Add To Outbound Changeset
      </button>
      {/* MODALS */}
      {configModalOpen && (
        <AddToChangesetConfigModal
          selectedOrg={selectedOrg}
          initialPackages={changesetPackages}
          initialPackage={changesetPackage}
          onChangesetPackages={setChangesetPackages}
          onSelection={setChangesetPackage}
          onClose={() => setConfigModalOpen(false)}
          onDeploy={handleDeployToChangeset}
        />
      )}
      {deployStatusModalOpen && (
        <AddToChangesetStatusModal
          hideModal={downloadResultsModalOpen}
          selectedOrg={selectedOrg}
          changesetName={changesetPackageName}
          changesetDescription={changesetPackageDescription}
          changesetId={changesetId}
          selectedMetadata={selectedMetadata}
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

export default AddToChangeset;

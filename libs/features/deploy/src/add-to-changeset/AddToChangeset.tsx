import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import {
  ChangeSet,
  DeployMetadataTableRow,
  DeployOptions,
  DeployResult,
  ListMetadataResult,
  Maybe,
  SalesforceOrgUi,
} from '@jetstream/types';
import { FileDownloadModal, Icon } from '@jetstream/ui';
import { fromDeployMetadataState, fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtom, useAtomValue } from 'jotai';
import { Fragment, useState } from 'react';
import { convertRowsToMapOfListMetadataResults, getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import { AddToChangesetConfigModal } from './AddToChangesetConfigModal';
import { AddToChangesetStatusModal } from './AddToChangesetStatusModal';

export interface AddToChangesetProps {
  className?: string;
  selectedOrg: SalesforceOrgUi;
  loading: boolean;
  selectedRows: Set<DeployMetadataTableRow>;
}

export const AddToChangeset = ({ className, selectedOrg, loading, selectedRows }: AddToChangesetProps) => {
  const { trackEvent } = useAmplitude();
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [deployStatusModalOpen, setDeployStatusModalOpen] = useState(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [deployResultsData, setDeployResultsData] = useState<Record<string, any[]>>();

  const [changesetPackageName, setChangesetPackageName] = useState<string | null>(null);
  const [changesetPackageDescription, setChangesetPackageDescription] = useState<string | null>(null);
  const [deployOptions, setDeployOptions] = useState<DeployOptions | null>(null);
  const [selectedChangeset, setSelectedChangeset] = useState<ChangeSet | null | undefined>(null);

  const [changesetPackage, setChangesetPackage] = useAtom(fromDeployMetadataState.changesetPackage);
  const [changesetPackages, setChangesetPackages] = useAtom(fromDeployMetadataState.changesetPackages);

  const [selectedMetadata, setSelectedMetadata] = useState<Record<string, ListMetadataResult[]>>({});

  function handleClick() {
    setConfigModalOpen(true);
    setSelectedMetadata(convertRowsToMapOfListMetadataResults(Array.from(selectedRows)));
  }

  function handleDeployToChangeset(
    packageName: string,
    changesetDescription: string,
    deployOptions: DeployOptions,
    changeset?: Maybe<ChangeSet>,
  ) {
    setChangesetPackageName(encodeURIComponent(packageName));
    setChangesetPackageDescription(changesetDescription);
    setDeployOptions(deployOptions);
    setSelectedChangeset(changeset);
    setConfigModalOpen(false);
    setDeployStatusModalOpen(true);
    trackEvent(ANALYTICS_KEYS.deploy_addToChangeset, {
      hasDescription: !!changesetDescription,
      itemCount: selectedRows.size,
    });
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
        className={classNames('slds-button slds-button_neutral', className)}
        disabled={loading || selectedRows.size === 0}
        onClick={handleClick}
        title="You can deploy the selected components to an existing outbound changeset."
      >
        <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
        <span>Add To Outbound Changeset</span>
      </button>
      {/* MODALS */}
      {configModalOpen && (
        <AddToChangesetConfigModal
          selectedOrg={selectedOrg}
          selectedMetadata={selectedMetadata}
          initialPackages={changesetPackages}
          initialPackage={changesetPackage}
          initialDescription={changesetPackageDescription}
          onChangesetPackages={setChangesetPackages}
          onSelection={setChangesetPackage}
          onClose={() => setConfigModalOpen(false)}
          onDeploy={handleDeployToChangeset}
        />
      )}
      {deployStatusModalOpen && changesetPackageName && (
        <AddToChangesetStatusModal
          hideModal={downloadResultsModalOpen}
          selectedOrg={selectedOrg}
          changesetName={changesetPackageName}
          changesetDescription={changesetPackageDescription || ''}
          changeset={selectedChangeset}
          deployOptions={deployOptions}
          selectedMetadata={selectedMetadata}
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
          source="deploy_metadata_add_to_changeset_modal"
          trackEvent={trackEvent}
        />
      )}
    </Fragment>
  );
};

export default AddToChangeset;

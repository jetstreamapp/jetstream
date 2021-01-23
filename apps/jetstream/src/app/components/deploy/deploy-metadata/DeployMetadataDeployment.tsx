/** @jsx jsx */
import { jsx } from '@emotion/react';
import { useListMetadata } from '@jetstream/connected-ui';
import { logger } from '@jetstream/shared/client-logger';
import { getPackageXml } from '@jetstream/shared/data';
import { formatNumber, saveFile } from '@jetstream/shared/ui-utils';
import {
  AsyncJobNew,
  FileExtAllTypes,
  ListMetadataResult,
  MapOf,
  MimeType,
  RetrievePackageZipJob,
  SalesforceOrgUi,
} from '@jetstream/types';
import { Badge, FileFauxDownloadModal, Grid, Icon, Spinner, Toast, Toolbar, ToolbarItemActions, ToolbarItemGroup } from '@jetstream/ui';
import DeployMetadataUploadToChangesetModal from './DeployMetadataUploadToChangesetModal';
import { convertRowsToMapOfListMetadataResults } from './utils/deploy-metadata.utils';
import addMinutes from 'date-fns/addMinutes';
import formatISODate from 'date-fns/formatISO';
import isBefore from 'date-fns/isBefore';
import startOfDay from 'date-fns/startOfDay';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import * as fromDeployMetadataState from './deploy-metadata.state';
import { AllUser, DeployMetadataTableRow } from './deploy-metadata.types';
import DeployMetadataDeploymentTable from './DeployMetadataDeploymentTable';
import DeployMetadataLastRefreshedPopover from './DeployMetadataLastRefreshedPopover';
import DeployMetadataUploadStatusModal from './DeployMetadataUploadStatusModal';

const DEFAULT_MODAL_DATA = {
  modalOpen: false,
  type: null,
  fileNameParts: [],
  allowedTypes: [],
};

export interface DeployMetadataDeploymentProps {
  selectedOrg: SalesforceOrgUi;
}

export const DeployMetadataDeployment: FunctionComponent<DeployMetadataDeploymentProps> = ({ selectedOrg }) => {
  const match = useRouteMatch();

  const { loadListMetadata, loadListMetadataItem, loading, listMetadataItems, hasError } = useListMetadata(selectedOrg);
  const [modalData, setModalData] = useState<{
    modalOpen: boolean;
    type: 'XML' | 'ZIP';
    fileNameParts: string[];
    allowedTypes: FileExtAllTypes[];
  }>(DEFAULT_MODAL_DATA);

  const listMetadataQueries = useRecoilValue(fromDeployMetadataState.listMetadataQueriesSelector);
  const userSelection = useRecoilValue<AllUser>(fromDeployMetadataState.userSelectionState);
  const selectedUsers = useRecoilValue(fromDeployMetadataState.selectedUsersState);
  const dateRangeSelection = useRecoilValue<AllUser>(fromDeployMetadataState.dateRangeSelectionState);
  const dateRange = useRecoilValue<Date>(fromDeployMetadataState.dateRangeState);

  const [changesetDeployModalOpen, setChangesetDeployModalOpen] = useState(false);
  const [changesetPackageName, setChangesetPackageName] = useState<string>();
  const [changesetPackageDescription, setChangesetPackageDescription] = useState<string>();
  const [selectedMetadata, setSelectedMetadata] = useState<MapOf<ListMetadataResult[]>>();
  const [deployChangesetModalOpen, setDeployChangesetModalOpen] = useState(false);
  const [changesetPackage, setChangesetPackage] = useRecoilState(fromDeployMetadataState.changesetPackage);
  const [changesetPackages, setChangesetPackages] = useRecoilState(fromDeployMetadataState.changesetPackages);

  const [selectedRows, setSelectedRows] = useState<Set<DeployMetadataTableRow>>(new Set());

  const listMetadataFilterFn = useCallback(
    (item: ListMetadataResult) => {
      const selectedUserSet = new Set(selectedUsers);
      const dateToCompare = startOfDay(addMinutes(dateRange || new Date(), -1));
      if (item.manageableState !== 'unmanaged') {
        return false;
      }
      if (userSelection === 'user' && !selectedUserSet.has(item.lastModifiedById)) {
        return false;
      }
      if (dateRangeSelection === 'user' && !isBefore(dateToCompare, item.lastModifiedDate)) {
        return false;
      }
      return true;
    },
    [selectedUsers, dateRange, userSelection, dateRangeSelection]
  );

  useEffect(() => {
    if (selectedOrg) {
      loadListMetadata(listMetadataQueries, listMetadataFilterFn);
    }
  }, [
    selectedOrg,
    listMetadataQueries,
    loadListMetadata,
    selectedUsers,
    dateRange,
    userSelection,
    dateRangeSelection,
    listMetadataFilterFn,
  ]);

  function handleGoBack() {
    // TODO: RESET ANYTHING
  }

  async function handleDownloadManifest() {
    setModalData({
      modalOpen: true,
      type: 'XML',
      fileNameParts: ['package-manifest'],
      allowedTypes: ['xml'],
    });
  }

  async function handleDownloadZip() {
    setModalData({
      modalOpen: true,
      type: 'ZIP',
      fileNameParts: ['metadata-package'],
      allowedTypes: ['zip'],
    });
  }

  async function handleFileModalClose() {
    setModalData(DEFAULT_MODAL_DATA);
  }

  async function handleRefreshItem(type: string) {
    if (listMetadataItems[type]) {
      loadListMetadataItem(listMetadataItems[type], listMetadataFilterFn);
    }
  }

  async function handleRefreshAll() {
    loadListMetadata(listMetadataQueries, listMetadataFilterFn, true);
  }

  // TODO: error messages and what not - also break code up into functions
  async function handleFileDownload(data: { fileName: string; fileFormat: FileExtAllTypes; mimeType: MimeType }) {
    const { type } = modalData;
    handleFileModalClose();
    if (type === 'XML') {
      const payload = convertRowsToMapOfListMetadataResults(Array.from(selectedRows));
      const packageXml = await getPackageXml(selectedOrg, payload);
      logger.log('packageXml', { packageXml });
      saveFile(packageXml, data.fileName, data.mimeType);
    } else if (type === 'ZIP') {
      // emit background job
      const jobs: AsyncJobNew<RetrievePackageZipJob>[] = [
        {
          type: 'RetrievePackageZip',
          title: `Download Metadata Package`,
          org: selectedOrg,
          meta: {
            fileName: data.fileName,
            mimeType: data.mimeType,
            listMetadataItems: convertRowsToMapOfListMetadataResults(Array.from(selectedRows)),
          },
        },
      ];
      fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
    }
  }

  function handleDeployToChangeset(packageName: string, changesetDescription: string) {
    setChangesetPackageName(packageName);
    setChangesetPackageDescription(changesetDescription);
    setSelectedMetadata(convertRowsToMapOfListMetadataResults(Array.from(selectedRows)));
    setChangesetDeployModalOpen(false);
    setDeployChangesetModalOpen(true);
  }

  return (
    <div>
      {modalData.modalOpen && (
        <FileFauxDownloadModal
          modalHeader="Download Package Manifest"
          modalTagline={`${formatNumber(selectedRows.size)} components will be included`}
          org={selectedOrg}
          fileNameParts={modalData.fileNameParts}
          allowedTypes={modalData.allowedTypes}
          onCancel={handleFileModalClose}
          onDownload={handleFileDownload}
        />
      )}
      <Toolbar>
        <ToolbarItemGroup>
          <Link className="slds-button slds-button_brand" to={{ pathname: `/deploy/deploy-metadata` }} onClick={handleGoBack}>
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button className="slds-button slds-button_brand" onClick={handleDownloadManifest} disabled={loading || selectedRows.size === 0}>
            <Icon type="utility" icon="page" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download Manifest
          </button>
          <button className="slds-button slds-button_brand" onClick={handleDownloadZip} disabled={loading || selectedRows.size === 0}>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download Metadata
          </button>
          <button
            className="slds-button slds-button_brand"
            disabled={loading || selectedRows.size === 0}
            onClick={() => setChangesetDeployModalOpen(true)}
          >
            <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
            Add To Outbound Changeset
          </button>
          <button className="slds-button slds-button_brand" disabled>
            <Icon type="utility" icon="share" className="slds-button__icon slds-button__icon_left" omitContainer />
            Deploy to Different Org
          </button>
        </ToolbarItemActions>
      </Toolbar>
      <div>
        <Grid className="slds-box_small slds-theme_default slds-is-relative">
          {loading && <Spinner size="small"></Spinner>}
          <div className="slds-m-horizontal_x-small">
            <Badge>{formatNumber(listMetadataQueries.length)} Metadata Types</Badge>
          </div>
          <div className="slds-m-horizontal_x-small">
            <Badge>{userSelection === 'all' ? 'From All Users' : `Across ${selectedUsers.length} users`}</Badge>
          </div>
          <div className="slds-m-horizontal_x-small">
            <Badge>
              {dateRangeSelection === 'all'
                ? 'Modified Any Time'
                : `Modified since ${formatISODate(dateRange, { representation: 'date' })}`}
            </Badge>
          </div>
          <div className="slds-m-horizontal_x-small">
            <Badge>{formatNumber(selectedRows.size)} Components Selected</Badge>
          </div>
          {!loading && listMetadataItems && (
            <div className="slds-col_bump-left">
              <DeployMetadataLastRefreshedPopover
                listMetadataItems={listMetadataItems}
                onRefreshItem={handleRefreshItem}
                onRefreshAll={handleRefreshAll}
              />
            </div>
          )}
        </Grid>
        {hasError && <Toast type="error">Uh Oh. There was a problem getting the permission data from Salesforce.</Toast>}
        {!hasError && listMetadataItems && (
          <DeployMetadataDeploymentTable listMetadataItems={listMetadataItems} onSelectedRows={setSelectedRows} />
        )}
        {changesetDeployModalOpen && (
          <DeployMetadataUploadToChangesetModal
            selectedOrg={selectedOrg}
            initialPackages={changesetPackages}
            initialPackage={changesetPackage}
            onChangesetPackages={setChangesetPackages}
            onSelection={setChangesetPackage}
            onClose={() => setChangesetDeployModalOpen(false)}
            onDeploy={handleDeployToChangeset}
          />
        )}
        {deployChangesetModalOpen && (
          <DeployMetadataUploadStatusModal
            selectedOrg={selectedOrg}
            changesetName={changesetPackageName}
            changesetDescription={changesetPackageDescription}
            selectedMetadata={selectedMetadata}
            onClose={() => setDeployChangesetModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default DeployMetadataDeployment;

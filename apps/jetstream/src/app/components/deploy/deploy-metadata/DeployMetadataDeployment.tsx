/** @jsx jsx */
import { jsx } from '@emotion/react';
import { useListMetadata } from '@jetstream/connected-ui';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { Badge, Grid, Icon, Spinner, Toast, Toolbar, ToolbarItemActions, ToolbarItemGroup } from '@jetstream/ui';
import addMinutes from 'date-fns/addMinutes';
import formatISODate from 'date-fns/formatISO';
import isBefore from 'date-fns/isBefore';
import startOfDay from 'date-fns/startOfDay';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import AddToChangeset from './add-to-changeset/AddToChangeset';
import * as fromDeployMetadataState from './deploy-metadata.state';
import { AllUser, DeployMetadataTableRow } from './deploy-metadata.types';
import DeployMetadataToOrg from './deploy-to-different-org/DeployMetadataToOrg';
import DeployMetadataDeploymentTable from './DeployMetadataDeploymentTable';
import DeployMetadataLastRefreshedPopover from './DeployMetadataLastRefreshedPopover';
import { convertRowsToMapOfListMetadataResults } from './utils/deploy-metadata.utils';
import DownloadPackageWithFileSelector from './utils/DownloadPackageWithFileSelector';

export interface DeployMetadataDeploymentProps {
  selectedOrg: SalesforceOrgUi;
}

export const DeployMetadataDeployment: FunctionComponent<DeployMetadataDeploymentProps> = ({ selectedOrg }) => {
  const { loadListMetadata, loadListMetadataItem, loading, listMetadataItems, hasError } = useListMetadata(selectedOrg);
  // used for manifest or package download
  const [activeDownloadType, setActiveDownloadType] = useState<'manifest' | 'package' | null>(null);

  const listMetadataQueries = useRecoilValue(fromDeployMetadataState.listMetadataQueriesSelector);
  const userSelection = useRecoilValue<AllUser>(fromDeployMetadataState.userSelectionState);
  const selectedUsers = useRecoilValue(fromDeployMetadataState.selectedUsersState);
  const dateRangeSelection = useRecoilValue<AllUser>(fromDeployMetadataState.dateRangeSelectionState);
  const dateRange = useRecoilValue<Date>(fromDeployMetadataState.dateRangeState);

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

  async function handleRefreshItem(type: string) {
    if (listMetadataItems[type]) {
      loadListMetadataItem(listMetadataItems[type], listMetadataFilterFn);
    }
  }

  async function handleRefreshAll() {
    loadListMetadata(listMetadataQueries, listMetadataFilterFn, true);
  }

  async function handleDownloadActive(type: 'manifest' | 'package') {
    setActiveDownloadType(type);
  }

  async function handleFileModalClose() {
    setActiveDownloadType(null);
  }

  return (
    <div>
      {activeDownloadType && (
        <DownloadPackageWithFileSelector
          type={activeDownloadType}
          selectedOrg={selectedOrg}
          modalTagline={`${formatNumber(selectedRows.size)} components will be included`}
          listMetadataItems={convertRowsToMapOfListMetadataResults(Array.from(selectedRows))}
          onClose={handleFileModalClose}
        />
      )}

      <Toolbar>
        <ToolbarItemGroup>
          <Link className="slds-button slds-button_brand" to={{ pathname: `/deploy/deploy-metadata` }}>
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button
            className="slds-button slds-button_brand"
            onClick={() => handleDownloadActive('manifest')}
            disabled={loading || selectedRows.size === 0}
          >
            <Icon type="utility" icon="page" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download Manifest
          </button>
          <button
            className="slds-button slds-button_brand"
            onClick={() => handleDownloadActive('package')}
            disabled={loading || selectedRows.size === 0}
          >
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download Metadata
          </button>
          <AddToChangeset selectedOrg={selectedOrg} loading={loading} selectedRows={selectedRows} />
          <DeployMetadataToOrg selectedOrg={selectedOrg} loading={loading} selectedRows={selectedRows} />
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
      </div>
    </div>
  );
};

export default DeployMetadataDeployment;

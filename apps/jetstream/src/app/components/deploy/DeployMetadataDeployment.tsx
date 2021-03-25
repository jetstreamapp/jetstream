/** @jsx jsx */
import { jsx } from '@emotion/react';
import { useListMetadata } from '@jetstream/connected-ui';
import { formatNumber, transformTabularDataToExcelStr } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import {
  Badge,
  DropDown,
  Grid,
  Icon,
  Spinner,
  Toast,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  FileDownloadModal,
} from '@jetstream/ui';
import DeployMetadataPackage from './deploy-metadata-package/DeployMetadataPackage';
import copyToClipboard from 'copy-to-clipboard';
import addMinutes from 'date-fns/addMinutes';
import formatISODate from 'date-fns/formatISO';
import isBefore from 'date-fns/isBefore';
import startOfDay from 'date-fns/startOfDay';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import AddToChangeset from './add-to-changeset/AddToChangeset';
import * as fromDeployMetadataState from './deploy-metadata.state';
import { AllUser, DeployMetadataTableRow, YesNo } from './deploy-metadata.types';
import DeployMetadataToOrg from './deploy-to-different-org/DeployMetadataToOrg';
import DeployMetadataDeploymentTable from './DeployMetadataDeploymentTable';
import DeployMetadataLastRefreshedPopover from './DeployMetadataLastRefreshedPopover';
import { convertRowsForExport, convertRowsToMapOfListMetadataResults } from './utils/deploy-metadata.utils';
import DownloadPackageWithFileSelector from './utils/DownloadPackageWithFileSelector';

const TABLE_ACTION_CLIPBOARD = 'table-copy-to-clipboard';
const TABLE_ACTION_DOWNLOAD = 'table-download';

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
  const includeManagedPackageItems = useRecoilValue<YesNo>(fromDeployMetadataState.includeManagedPackageItems);

  const [exportData, setExportData] = useState<MapOf<any>>();
  const [rows, setRows] = useState<DeployMetadataTableRow[]>();
  const [selectedRows, setSelectedRows] = useState<Set<DeployMetadataTableRow>>(new Set());

  const listMetadataFilterFn = useCallback(
    (item: ListMetadataResult) => {
      const selectedUserSet = new Set(selectedUsers);
      const dateToCompare = startOfDay(addMinutes(dateRange || new Date(), -1));
      if (includeManagedPackageItems === 'No' && item.manageableState !== 'unmanaged') {
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
    [selectedUsers, dateRange, includeManagedPackageItems, userSelection, dateRangeSelection]
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

  function handleTableAction(id: string) {
    const exportDataTemp = convertRowsForExport(rows);
    if (id === TABLE_ACTION_CLIPBOARD) {
      copyToClipboard(transformTabularDataToExcelStr(exportDataTemp), { format: 'text/plain' });
    } else if (TABLE_ACTION_DOWNLOAD) {
      setExportData(exportDataTemp);
    }
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

      {exportData && (
        <FileDownloadModal
          org={selectedOrg}
          modalHeader="Export Metadata"
          data={exportData}
          fileNameParts={['metadata']}
          allowedTypes={['xlsx', 'csv', 'json']}
          onModalClose={() => setExportData(null)}
        />
      )}

      <Toolbar>
        <ToolbarItemGroup>
          <Link className="slds-button slds-button_brand" to={{ pathname: `/deploy-metadata` }}>
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <DeployMetadataPackage selectedOrg={selectedOrg} />
          <button
            title={`Download a Package.xml manifest file for all the selected metadata components. You can use this file to download this same set of metadata from any org at a later date.`}
            className="slds-button slds-button_neutral"
            onClick={() => handleDownloadActive('manifest')}
            disabled={loading || selectedRows.size === 0}
          >
            <Icon type="utility" icon="page" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download Manifest
          </button>
          <button
            title="Download a metadata package as a zip file so that you can view or modify the components locally and re-deploy to any org. You can also use this to keep a backup of the current state of the components."
            className="slds-button slds-button_neutral"
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
            <Badge>
              {formatNumber(listMetadataQueries.length)} Metadata {pluralizeIfMultiple('Type', listMetadataQueries)}
            </Badge>
          </div>
          <div className="slds-m-horizontal_x-small">
            <Badge>
              {userSelection === 'all' ? 'From All Users' : `Across ${selectedUsers.length} ${pluralizeIfMultiple('user', selectedUsers)}`}
            </Badge>
          </div>
          <div className="slds-m-horizontal_x-small">
            <Badge>
              {dateRangeSelection === 'all'
                ? 'Modified Any Time'
                : `Modified since ${formatISODate(dateRange, { representation: 'date' })}`}
            </Badge>
          </div>
          <div className="slds-m-horizontal_x-small">
            <Badge>
              {formatNumber(selectedRows.size)} {pluralizeFromNumber('Component', selectedRows.size)} Selected
            </Badge>
          </div>
          {!loading && rows && (
            <div className="slds-p-top_xxx-small">
              <DropDown
                buttonClassName="slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-small"
                actionText="Table Actions"
                description="Table Actions"
                items={[
                  {
                    id: TABLE_ACTION_CLIPBOARD,
                    icon: { type: 'utility', icon: 'copy_to_clipboard', description: 'Copy table to Clipboard' },
                    value: 'Copy metadata table to Clipboard',
                  },
                  {
                    id: TABLE_ACTION_DOWNLOAD,
                    icon: { type: 'utility', icon: 'download', description: 'Download table' },
                    value: 'Download metadata table',
                  },
                ]}
                onSelected={handleTableAction}
              />
            </div>
          )}
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
          <DeployMetadataDeploymentTable listMetadataItems={listMetadataItems} onRows={setRows} onSelectedRows={setSelectedRows} />
        )}
      </div>
    </div>
  );
};

export default DeployMetadataDeployment;

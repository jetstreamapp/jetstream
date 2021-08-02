/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { ListMetadataResultItem, useListMetadata } from '@jetstream/connected-ui';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { formatNumber, transformTabularDataToExcelStr } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { ListMetadataResult, MapOf, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Badge,
  DropDown,
  FileDownloadModal,
  Grid,
  Icon,
  Spinner,
  Toast,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
} from '@jetstream/ui';
import copyToClipboard from 'copy-to-clipboard';
import addMinutes from 'date-fns/addMinutes';
import formatISODate from 'date-fns/formatISO';
import isAfter from 'date-fns/isAfter';
import isBefore from 'date-fns/isBefore';
import startOfDay from 'date-fns/startOfDay';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useAmplitude } from '../core/analytics';
import AddToChangeset from './add-to-changeset/AddToChangeset';
import DeployMetadataPackage from './deploy-metadata-package/DeployMetadataPackage';
import * as fromDeployMetadataState from './deploy-metadata.state';
import { AllUser, DeployMetadataTableRow, SidePanelType, YesNo } from './deploy-metadata.types';
import DeployMetadataToOrg from './deploy-to-different-org/DeployMetadataToOrg';
import DeployMetadataDeploymentSidePanel from './DeployMetadataDeploymentSidePanel';
import DeployMetadataDeploymentTable from './DeployMetadataDeploymentTable';
import DeployMetadataLastRefreshedPopover from './DeployMetadataLastRefreshedPopover';
import { convertRowsForExport, convertRowsToMapOfListMetadataResults } from './utils/deploy-metadata.utils';
import DownloadPackageWithFileSelector from './utils/DownloadPackageWithFileSelector';
import ViewOrCompareMetadataModal from './view-or-compare-metadata/ViewOrCompareMetadataModal';

const TABLE_ACTION_CLIPBOARD = 'table-copy-to-clipboard';
const TABLE_ACTION_DOWNLOAD = 'table-download';

export interface DeployMetadataDeploymentProps {
  selectedOrg: SalesforceOrgUi;
}

export const DeployMetadataDeployment: FunctionComponent<DeployMetadataDeploymentProps> = ({ selectedOrg }) => {
  const { trackEvent } = useAmplitude();
  const {
    loadListMetadata,
    loadListMetadataItem,
    loading,
    listMetadataItems: listMetadataItemsUnfiltered,
    initialLoadFinished,
    hasError,
  } = useListMetadata(selectedOrg);
  const [listMetadataItems, setListMetadataItems] = useState<MapOf<ListMetadataResultItem>>(listMetadataItemsUnfiltered);

  // used for manifest or package download
  const [activeDownloadType, setActiveDownloadType] = useState<'manifest' | 'package' | null>(null);

  const listMetadataQueries = useRecoilValue(fromDeployMetadataState.listMetadataQueriesSelector);
  const userSelection = useRecoilValue<AllUser>(fromDeployMetadataState.userSelectionState);
  const selectedUsers = useRecoilValue(fromDeployMetadataState.selectedUsersState);
  const dateRangeSelection = useRecoilValue<AllUser>(fromDeployMetadataState.dateRangeSelectionState);
  const dateRangeStartState = useRecoilValue<Date>(fromDeployMetadataState.dateRangeStartState);
  const dateRangeEndState = useRecoilValue<Date>(fromDeployMetadataState.dateRangeEndState);
  const includeManagedPackageItems = useRecoilValue<YesNo>(fromDeployMetadataState.includeManagedPackageItems);
  const amplitudeSubmissionSelector = useRecoilValue(fromDeployMetadataState.amplitudeSubmissionSelector);

  const [exportData, setExportData] = useState<MapOf<any>>();
  const [rows, setRows] = useState<DeployMetadataTableRow[]>();
  const [selectedRows, setSelectedRows] = useState<Set<DeployMetadataTableRow>>(new Set());

  const [sidePanelType, setSidePanelType] = useState<SidePanelType>('type-selection');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [modifiedLabel, setModifiedLabel] = useState('');

  const [viewOrCompareModalOpen, setViewOrCompareModalOpen] = useState(false);

  const listMetadataFilterFn = useCallback(
    (item: ListMetadataResult) => {
      const selectedUserSet = new Set(selectedUsers);
      if (includeManagedPackageItems === 'No' && item.manageableState !== 'unmanaged') {
        return false;
      }
      if (userSelection === 'user' && !selectedUserSet.has(item.lastModifiedById)) {
        return false;
      }
      if (
        dateRangeSelection === 'user' &&
        dateRangeStartState &&
        !isBefore(startOfDay(addMinutes(dateRangeStartState || new Date(), -1)), item.lastModifiedDate)
      ) {
        return false;
      }
      if (
        dateRangeSelection === 'user' &&
        dateRangeEndState &&
        !isAfter(startOfDay(addMinutes(dateRangeEndState || new Date(), +1)), item.lastModifiedDate)
      ) {
        return false;
      }
      return true;
    },
    [userSelection, selectedUsers, dateRangeSelection, dateRangeStartState, dateRangeEndState, includeManagedPackageItems]
  );

  useEffect(() => {
    if (listMetadataFilterFn && listMetadataItemsUnfiltered) {
      setListMetadataItems(
        Object.keys(listMetadataItemsUnfiltered).reduce((output, key) => {
          const item = listMetadataItemsUnfiltered[key];
          output[key] = { ...item, items: item.items.filter(listMetadataFilterFn) };
          return output;
        }, {})
      );
    }
  }, [listMetadataFilterFn, listMetadataItemsUnfiltered]);

  useEffect(() => {
    if (selectedOrg) {
      let skipCacheIfOlderThan: number;
      if (dateRangeSelection === 'user' && dateRangeStartState) {
        skipCacheIfOlderThan = startOfDay(dateRangeStartState || new Date()).getTime();
      }
      loadListMetadata(listMetadataQueries, {
        metadataToRetain: initialLoadFinished ? listMetadataItemsUnfiltered : undefined,
        skipRequestCache: false,
        skipCacheIfOlderThan,
      });
    }
  }, [
    selectedOrg,
    listMetadataQueries,
    loadListMetadata,
    selectedUsers,
    dateRangeStartState,
    dateRangeEndState,
    userSelection,
    dateRangeSelection,
  ]);

  useEffect(() => {
    if (dateRangeStartState || dateRangeEndState) {
      if (dateRangeStartState && dateRangeEndState) {
        setModifiedLabel(
          `Modified between ${formatISODate(dateRangeStartState, { representation: 'date' })} ${formatISODate(dateRangeEndState, {
            representation: 'date',
          })}`
        );
      } else if (dateRangeStartState) {
        setModifiedLabel(`Modified since ${formatISODate(dateRangeStartState, { representation: 'date' })}`);
      } else {
        setModifiedLabel(`Modified before ${formatISODate(dateRangeEndState, { representation: 'date' })}`);
      }
    }
  }, [dateRangeStartState, dateRangeEndState]);

  async function handleRefreshItem(type: string) {
    if (listMetadataItems[type]) {
      loadListMetadataItem(listMetadataItems[type]);
    }
  }

  async function handleRefreshAll() {
    // this will clear all user selections
    loadListMetadata(listMetadataQueries, { skipRequestCache: true });
  }

  async function handleDownloadActive(type: 'manifest' | 'package') {
    setActiveDownloadType(type);
    trackEvent(ANALYTICS_KEYS.deploy_download, { type, itemCount: selectedRows.size });
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

  function handleOpenSidePanel(activeItem: SidePanelType) {
    if (activeItem === sidePanelType && isSidePanelOpen) {
      setIsSidePanelOpen(false);
    } else {
      setSidePanelType(activeItem);
      setIsSidePanelOpen(true);
    }
  }

  function handleCloseSidePanel() {
    setIsSidePanelOpen(false);
    trackEvent(ANALYTICS_KEYS.deploy_configuration, { page: 'deploy-table', ...amplitudeSubmissionSelector });
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

      {viewOrCompareModalOpen && (
        <ViewOrCompareMetadataModal
          sourceOrg={selectedOrg}
          selectedMetadata={convertRowsToMapOfListMetadataResults(Array.from(selectedRows))}
          onClose={() => setViewOrCompareModalOpen(false)}
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
        <Grid className="slds-box_small slds-theme_default slds-is-relative" verticalAlign="center" wrap>
          {loading && <Spinner size="small"></Spinner>}
          {/* TODO: on a small screen, we need to change to icon buttons or something */}
          <div className="slds-m-right_xx-small">
            <button
              className="slds-button slds-button_neutral"
              onClick={() => handleOpenSidePanel('type-selection')}
              title="Click to adjust which types to include"
            >
              {formatNumber(listMetadataQueries.length)} Metadata {pluralizeIfMultiple('Type', listMetadataQueries)}
            </button>
          </div>
          <div className="slds-m-right_xx-small">
            <button
              className="slds-button slds-button_neutral"
              onClick={() => handleOpenSidePanel('user-selection')}
              title="Click to adjust which users are used to filter"
            >
              {userSelection === 'all' ? 'From All Users' : `Across ${selectedUsers.length} ${pluralizeIfMultiple('user', selectedUsers)}`}
            </button>
          </div>
          <div className="slds-m-right_xx-small">
            <button
              className="slds-button slds-button_neutral"
              onClick={() => handleOpenSidePanel('date-range-selection')}
              title="Click to adjust the date range"
            >
              {dateRangeSelection === 'all' ? 'Modified Any Time' : modifiedLabel}
            </button>
          </div>
          <div className="slds-m-right_x-small">
            <button
              className="slds-button slds-button_neutral"
              onClick={() => handleOpenSidePanel('include-managed-selection')}
              title="Click to change if managed items are shown"
            >
              {includeManagedPackageItems === 'Yes' ? `Include Managed` : 'Exclude Managed'}
            </button>
          </div>
          <div className="slds-m-right_xx-small">
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
          <Grid>
            <DeployMetadataDeploymentSidePanel
              selectedOrg={selectedOrg}
              activeItem={sidePanelType}
              isOpen={isSidePanelOpen}
              onClosed={handleCloseSidePanel}
            />
            <AutoFullHeightContainer
              className="slds-scrollable bg-white"
              bottomBuffer={10}
              delayForSecondTopCalc
              css={css`
                width: 100%;
              `}
            >
              <DeployMetadataDeploymentTable
                listMetadataItems={listMetadataItems}
                hasSelectedRows={selectedRows.size > 0}
                onRows={setRows}
                onSelectedRows={setSelectedRows}
                onViewOrCompareOpen={() => setViewOrCompareModalOpen(true)}
              />
            </AutoFullHeightContainer>
          </Grid>
        )}
      </div>
    </div>
  );
};

export default DeployMetadataDeployment;

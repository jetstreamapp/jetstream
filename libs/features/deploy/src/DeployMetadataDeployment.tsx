import { css } from '@emotion/react';
import { ListMetadataResultItem, useListMetadata } from '@jetstream/connected-ui';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { copyRecordsToClipboard, formatNumber, isChromeExtension } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { DeployMetadataTableRow, ListMetadataResult, SalesforceOrgUi, SidePanelType } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ButtonGroupContainer,
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
import { applicationCookieState, fromDeployMetadataState, fromJetstreamEvents, selectedOrgState, useAmplitude } from '@jetstream/ui-core';
import { addMinutes } from 'date-fns/addMinutes';
import { formatISO as formatISODate } from 'date-fns/formatISO';
import { isAfter } from 'date-fns/isAfter';
import { isBefore } from 'date-fns/isBefore';
import { startOfDay } from 'date-fns/startOfDay';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import DeployMetadataDeploymentSidePanel from './DeployMetadataDeploymentSidePanel';
import DeployMetadataDeploymentTable from './DeployMetadataDeploymentTable';
import DeployMetadataLastRefreshedPopover from './DeployMetadataLastRefreshedPopover';
import AddToChangeset from './add-to-changeset/AddToChangeset';
import DeleteMetadataModal from './delete-metadata/DeleteMetadataModal';
import DeployMetadataHistoryModal from './deploy-metadata-history/DeployMetadataHistoryModal';
import DeployMetadataPackage from './deploy-metadata-package/DeployMetadataPackage';
import DeployMetadataToOrg from './deploy-to-different-org/DeployMetadataToOrg';
import DeployMetadataSelectedItemsBadge from './utils/DeployMetadataSelectedItemsBadge';
import DownloadPackageWithFileSelector from './utils/DownloadPackageWithFileSelector';
import { convertRowsForExport, convertRowsToMapOfListMetadataResults, getRows } from './utils/deploy-metadata.utils';
import ViewOrCompareMetadataModal from './view-or-compare-metadata/ViewOrCompareMetadataModal';

const TABLE_ACTION_CLIPBOARD = 'table-copy-to-clipboard';
const TABLE_ACTION_CLIPBOARD_SELECTED = 'table-copy-to-clipboard-selected';
const TABLE_ACTION_DOWNLOAD = 'table-download';
const TABLE_ACTION_DOWNLOAD_SELECTED = 'table-download-selected';
const TABLE_ACTION_DOWNLOAD_MANIFEST = 'download-manifest';
const TABLE_ACTION_DELETE_METADATA = 'delete-manifest';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeployMetadataDeploymentProps {}

export const DeployMetadataDeployment: FunctionComponent<DeployMetadataDeploymentProps> = () => {
  const { trackEvent } = useAmplitude();
  const [{ google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const {
    loadListMetadata,
    loadListMetadataItem,
    loading,
    listMetadataItems: listMetadataItemsUnfiltered,
    initialLoadFinished,
    hasError,
  } = useListMetadata(selectedOrg);
  const [listMetadataItems, setListMetadataItems] = useState<Record<string, ListMetadataResultItem> | undefined>(
    listMetadataItemsUnfiltered
  );

  // used for manifest or package download
  const [activeDownloadType, setActiveDownloadType] = useState<'manifest' | 'package' | null>(null);

  const listMetadataQueries = useRecoilValue(fromDeployMetadataState.listMetadataQueriesSelector);
  const userSelection = useRecoilValue(fromDeployMetadataState.userSelectionState);
  const selectedUsers = useRecoilValue(fromDeployMetadataState.selectedUsersState);
  const dateRangeSelection = useRecoilValue(fromDeployMetadataState.dateRangeSelectionState);
  const dateRangeStartState = useRecoilValue(fromDeployMetadataState.dateRangeStartState);
  const dateRangeEndState = useRecoilValue(fromDeployMetadataState.dateRangeEndState);
  const includeManagedPackageItems = useRecoilValue(fromDeployMetadataState.includeManagedPackageItems);
  const amplitudeSubmissionSelector = useRecoilValue(fromDeployMetadataState.amplitudeSubmissionSelector);

  const [exportData, setExportData] = useState<Record<string, any> | null>(null);
  const [rows, setRows] = useState<DeployMetadataTableRow[]>();
  const [selectedRows, setSelectedRows] = useState<Set<DeployMetadataTableRow>>(new Set());

  const [sidePanelType, setSidePanelType] = useState<SidePanelType>('type-selection');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [modifiedLabel, setModifiedLabel] = useState('');

  const [viewOrCompareModalOpen, setViewOrCompareModalOpen] = useState(false);
  const [deleteMetadataModalOpen, setDeleteMetadataModalOpen] = useState(false);

  const [chromeExtension] = useState(() => isChromeExtension());

  const listMetadataFilterFn = useCallback(
    (item: ListMetadataResult) => {
      const selectedUserSet = new Set(selectedUsers);
      if (includeManagedPackageItems === 'No' && item.manageableState !== 'unmanaged') {
        return false;
      }
      if (userSelection === 'user' && !selectedUserSet.has(item.lastModifiedById || '')) {
        return false;
      }
      if (userSelection === 'currentUser' && item.lastModifiedById !== selectedOrg.userId) {
        return false;
      }
      if (
        dateRangeSelection === 'user' &&
        dateRangeStartState &&
        item.lastModifiedDate &&
        !isBefore(startOfDay(addMinutes(dateRangeStartState || new Date(), -1)), item.lastModifiedDate)
      ) {
        return false;
      }
      if (
        dateRangeSelection === 'user' &&
        dateRangeEndState &&
        item.lastModifiedDate &&
        !isAfter(startOfDay(addMinutes(dateRangeEndState || new Date(), +1)), item.lastModifiedDate)
      ) {
        return false;
      }
      return true;
    },
    [
      selectedUsers,
      includeManagedPackageItems,
      userSelection,
      selectedOrg?.userId,
      dateRangeSelection,
      dateRangeStartState,
      dateRangeEndState,
    ]
  );

  useEffect(() => {
    if (listMetadataFilterFn && listMetadataItemsUnfiltered) {
      const _listMetadataItems = Object.keys(listMetadataItemsUnfiltered).reduce((output: Record<string, ListMetadataResultItem>, key) => {
        const item = listMetadataItemsUnfiltered[key];
        output[key] = { ...item, items: item.items.filter(listMetadataFilterFn) };
        return output;
      }, {});
      setRows(getRows(_listMetadataItems));
      setListMetadataItems(_listMetadataItems);
    }
  }, [listMetadataFilterFn, listMetadataItemsUnfiltered]);

  useEffect(() => {
    if (selectedOrg) {
      let skipCacheIfOlderThan: number | undefined = undefined;
      if (dateRangeSelection === 'user' && dateRangeStartState) {
        skipCacheIfOlderThan = startOfDay(dateRangeStartState || new Date()).getTime();
      }
      loadListMetadata(listMetadataQueries, {
        metadataToRetain: initialLoadFinished ? listMetadataItemsUnfiltered : undefined,
        skipRequestCache: false,
        skipCacheIfOlderThan,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } else if (dateRangeEndState) {
        setModifiedLabel(`Modified before ${formatISODate(dateRangeEndState, { representation: 'date' })}`);
      }
    }
  }, [dateRangeStartState, dateRangeEndState]);

  async function handleRefreshItem(type: string) {
    if (listMetadataItems?.[type]) {
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

  function handleDropdownMenuSelect(id: string) {
    if (id === TABLE_ACTION_DOWNLOAD_MANIFEST) {
      handleDownloadActive('manifest');
    } else if (id === TABLE_ACTION_CLIPBOARD) {
      copyRecordsToClipboard(convertRowsForExport(rows || [], selectedRows));
    } else if (id === TABLE_ACTION_CLIPBOARD_SELECTED) {
      copyRecordsToClipboard(convertRowsForExport(rows || [], selectedRows, true));
    } else if (id === TABLE_ACTION_DOWNLOAD) {
      setExportData(convertRowsForExport(rows || [], selectedRows));
    } else if (id === TABLE_ACTION_DOWNLOAD_SELECTED) {
      setExportData(convertRowsForExport(rows || [], selectedRows, true));
    } else if (id === TABLE_ACTION_DELETE_METADATA) {
      setDeleteMetadataModalOpen(true);
    }
  }

  const handleViewOrCompareOpen = useCallback(() => {
    setViewOrCompareModalOpen(true);
  }, []);

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
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Export Metadata"
          data={exportData}
          fileNameParts={['metadata']}
          allowedTypes={['xlsx', 'csv', 'json']}
          onModalClose={() => setExportData(null)}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}

      {viewOrCompareModalOpen && (
        <ViewOrCompareMetadataModal
          sourceOrg={selectedOrg}
          selectedMetadata={convertRowsToMapOfListMetadataResults(Array.from(selectedRows))}
          onClose={() => setViewOrCompareModalOpen(false)}
        />
      )}

      {deleteMetadataModalOpen && (
        <DeleteMetadataModal
          selectedOrg={selectedOrg}
          selectedMetadata={convertRowsToMapOfListMetadataResults(Array.from(selectedRows))}
          onClose={() => setDeleteMetadataModalOpen(false)}
        />
      )}

      <Toolbar>
        <ToolbarItemGroup>
          <Link className="slds-button slds-button_brand" to="..">
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <DeployMetadataHistoryModal className="collapsible-button collapsible-button-xxl" />
          <ButtonGroupContainer>
            <DeployMetadataPackage className="collapsible-button collapsible-button-xl" selectedOrg={selectedOrg} />
            <button
              title="Download a metadata package as a zip file so that you can view or modify the components locally and re-deploy to any org. You can also use this to keep a backup of the current state of the components."
              className="slds-button slds-button_neutral collapsible-button collapsible-button-xl"
              onClick={() => handleDownloadActive('package')}
              disabled={loading || selectedRows.size === 0}
            >
              <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
              <span>Download Metadata</span>
            </button>
            <AddToChangeset
              className="collapsible-button collapsible-button-sm"
              selectedOrg={selectedOrg}
              loading={loading}
              selectedRows={selectedRows}
            />
            {!chromeExtension && <DeployMetadataToOrg selectedOrg={selectedOrg} loading={loading} selectedRows={selectedRows} />}
            <DropDown
              className="slds-button_last"
              position="right"
              items={[
                {
                  id: TABLE_ACTION_CLIPBOARD,
                  subheader: 'Export All Table Data',
                  icon: { type: 'utility', icon: 'copy_to_clipboard', description: 'Copy table to Clipboard' },
                  value: 'Copy metadata table to Clipboard',
                },
                {
                  id: TABLE_ACTION_DOWNLOAD,
                  icon: { type: 'utility', icon: 'download', description: 'Download table' },
                  value: 'Download metadata table',
                  trailingDivider: true,
                },
                {
                  id: TABLE_ACTION_CLIPBOARD_SELECTED,
                  subheader: 'Export Selected Table Data',
                  icon: { type: 'utility', icon: 'copy_to_clipboard', description: 'Copy table to Clipboard' },
                  value: 'Copy selected metadata table to Clipboard',
                  disabled: selectedRows.size === 0,
                  title: selectedRows.size === 0 ? 'Select at least one item from the table to enable this option' : '',
                },
                {
                  id: TABLE_ACTION_DOWNLOAD_SELECTED,
                  icon: { type: 'utility', icon: 'download', description: 'Download table' },
                  value: 'Download selected metadata table',
                  disabled: selectedRows.size === 0,
                  title: selectedRows.size === 0 ? 'Select at least one item from the table to enable this option' : '',
                  trailingDivider: true,
                },
                {
                  id: TABLE_ACTION_DOWNLOAD_MANIFEST,
                  subheader: 'Metadata Actions',
                  value: 'Download package.xml manifest',
                  icon: { icon: 'page', type: 'utility' },
                  disabled: selectedRows.size === 0,
                  title: selectedRows.size === 0 ? 'Select at least one item from the table to enable this option' : '',
                },
                {
                  id: TABLE_ACTION_DELETE_METADATA,
                  icon: { type: 'utility', icon: 'delete', description: 'Delete selected metadata' },
                  value: 'Delete selected metadata',
                  disabled: selectedRows.size === 0,
                  title: selectedRows.size === 0 ? 'Select at least one item from the table to enable this option' : '',
                },
              ]}
              disabled={loading}
              onSelected={handleDropdownMenuSelect}
            />
          </ButtonGroupContainer>
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
              {userSelection === 'all' && 'From All Users'}
              {userSelection === 'currentUser' && 'From Current Users'}
              {userSelection === 'user' && `Across ${selectedUsers.length} ${pluralizeIfMultiple('user', selectedUsers)}`}
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
            <DeployMetadataSelectedItemsBadge selectedRows={selectedRows} />
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
                rows={rows || []}
                hasSelectedRows={selectedRows.size > 0}
                onSelectedRows={setSelectedRows}
                onViewOrCompareOpen={handleViewOrCompareOpen}
              />
            </AutoFullHeightContainer>
          </Grid>
        )}
      </div>
    </div>
  );
};

export default DeployMetadataDeployment;

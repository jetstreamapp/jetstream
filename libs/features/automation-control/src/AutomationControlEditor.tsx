import { css } from '@emotion/react';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { formatNumber, useTitle } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import {
  FileExtAllTypes,
  ListMetadataResult,
  Maybe,
  MimeType,
  RetrievePackageFromListMetadataJob,
  SalesforceOrgUi,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Badge,
  ButtonGroupContainer,
  FileDownloadModal,
  FileFauxDownloadModal,
  Grid,
  Icon,
  SearchInput,
  Spinner,
  Toast,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
} from '@jetstream/ui';
import {
  RequireMetadataApiBanner,
  applicationCookieState,
  fromAutomationControlState,
  fromJetstreamEvents,
  selectSkipFrontdoorAuth,
  selectedOrgState,
  useAmplitude,
} from '@jetstream/ui-core';
import classNames from 'classnames';
import { FunctionComponent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import AutomationControlEditorReviewModal from './AutomationControlEditorReviewModal';
import AutomationControlEditorTable from './AutomationControlEditorTable';
import AutomationControlLastRefreshedPopover from './AutomationControlLastRefreshedPopover';
import {
  getAutomationDeployType,
  isDuplicateRecord,
  isTableRow,
  isTableRowChild,
  isTableRowItem,
  isToolingApexRecord,
  isValidationRecord,
  isWorkflowRuleRecord,
} from './automation-control-data-utils';
import { TableRowItem } from './automation-control-types';
import { useAutomationControlData } from './useAutomationControlData';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlEditorProps {}

export const AutomationControlEditor: FunctionComponent<AutomationControlEditorProps> = () => {
  useTitle(TITLES.AUTOMATION_CONTROL);
  const { trackEvent } = useAmplitude();

  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const { serverUrl, defaultApiVersion, google_apiKey, google_appId, google_clientId } = useRecoilValue(applicationCookieState);
  const skipFrontdoorLogin = useRecoilValue(selectSkipFrontdoorAuth);

  const selectedSObjects = useRecoilValue(fromAutomationControlState.selectedSObjectsState);
  const selectedAutomationTypes = useRecoilValue(fromAutomationControlState.selectedAutomationTypes);

  const [dirtyRows, setDirtyRows] = useState<TableRowItem[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [quickFilterText, setQuickFilterText] = useState<string | null>(null);

  const [exportDataModalOpen, setExportDataModalOpen] = useState<boolean>(false);
  const [exportDataModalData, setExportDataModalData] = useState<any[]>([]);

  const [exportMetadataModalOpen, setExportMetadataModalOpen] = useState<boolean>(false);

  const {
    rows,
    visibleRows,
    hasError,
    loading,
    fetchData,
    refreshProcessBuilders,
    toggleRowExpand,
    updateIsActiveFlag,
    toggleAll,
    resetChanges,
    // restoreSnapshot,
    dirtyCount,
  } = useAutomationControlData({
    selectedOrg,
    defaultApiVersion,
    selectedSObjects,
    selectedAutomationTypes,
  });

  function handleResetChanges() {
    resetChanges();
    trackEvent(ANALYTICS_KEYS.automation_toggle_all, { type: 'reset' });
  }

  function handleReviewChanges() {
    const _dirtyRows = rows.filter((row) => {
      if (isTableRow(row) || isTableRowChild(row)) {
        return false;
      }
      return row.isActive !== row.isActiveInitialState || row.activeVersionNumber !== row.activeVersionNumberInitialState;
    }) as TableRowItem[];
    setDirtyRows(_dirtyRows);
    setSaveModalOpen(true);
    trackEvent(ANALYTICS_KEYS.automation_review, { rows: _dirtyRows.length, objects: selectedSObjects.length });
  }

  function handleDeployModalClose(refreshData?: boolean) {
    if (refreshData) {
      fetchData();
    }
    setSaveModalOpen(false);
  }

  function handleRefreshProcessBuilders() {
    refreshProcessBuilders();
  }

  function exportPackage() {
    setExportMetadataModalOpen(true);
    trackEvent(ANALYTICS_KEYS.automation_export, { type: 'zip' });
  }

  async function handlePackageDownload(data: {
    fileName: string;
    fileFormat: FileExtAllTypes;
    mimeType: MimeType;
    uploadToGoogle: boolean;
    googleFolder?: Maybe<string>;
  }) {
    setExportMetadataModalOpen(false);
    const jobMeta: RetrievePackageFromListMetadataJob = {
      type: 'listMetadata',
      fileName: data.fileName,
      fileFormat: data.fileFormat,
      mimeType: data.mimeType,
      listMetadataItems: rows
        .filter((row) => isTableRowItem(row))
        .reduce((output: Record<string, ListMetadataResult[]>, _item) => {
          const item = _item as unknown as TableRowItem; // filter limited item types in list
          const type = getAutomationDeployType(item.type);
          output[type] = output[type] || [];
          const record = item.record;
          let fullName: string;
          let fileName: string;
          if (isToolingApexRecord(item.type, record)) {
            fullName = record.Name;
            fileName = `triggers/${record.Name}.trigger`;
          } else if (isDuplicateRecord(item.type, record)) {
            fullName = record.DeveloperName;
            fileName = `objects/${record.SobjectType}.duplicateRule`;
          } else if (isValidationRecord(item.type, record)) {
            fullName = record.FullName;
            fileName = `objects/${record.EntityDefinition.QualifiedApiName}.object`;
          } else if (isWorkflowRuleRecord(item.type, record)) {
            fullName = record.FullName;
            fileName = `workflows/${record.TableEnumOrId}.workflow`;
          } else {
            fullName = record.ApiName;
            fileName = `flows/${record.ApiName}.flow`;
          }
          output[type].push({
            createdById: null,
            createdByName: null,
            createdDate: null,
            fileName: fileName,
            fullName: fullName,
            id: record.Id,
            lastModifiedById: null,
            lastModifiedByName: null,
            lastModifiedDate: null,
            manageableState: 'unmanaged',
            namespacePrefix: null,
            type,
          });
          if (type === 'FlowDefinition') {
            output.Flow = output.Flow || [];
            output.Flow.push({
              createdById: null,
              createdByName: null,
              createdDate: null,
              fileName: fileName,
              fullName: fullName,
              id: record.Id,
              lastModifiedById: null,
              lastModifiedByName: null,
              lastModifiedDate: null,
              manageableState: 'unmanaged',
              namespacePrefix: null,
              type,
            });
          }
          return output;
        }, {}),
      uploadToGoogle: data.uploadToGoogle,
      googleFolder: data.googleFolder,
    };

    fromJetstreamEvents.emit({
      type: 'newJob',
      payload: [
        {
          type: 'RetrievePackageZip',
          title: `Download Metadata Package`,
          org: selectedOrg,
          meta: jobMeta,
        },
      ],
    });
  }

  function exportSpreadsheet() {
    const exportData = rows
      .filter((row) => isTableRowItem(row))
      .map((_row) => {
        const row = _row as unknown as TableRowItem;
        return {
          Type: row.type,
          Object: row.sobject,
          Name: row.label,
          'Is Active': row.isActiveInitialState,
          'Active Version': row.activeVersionNumber,
          'Last Modified': row.lastModifiedBy,
          Description: row.description,
          'Additional Information': row.additionalData
            ?.filter((item) => item.value)
            .map((item) => `${item.label}: ${item.value}`)
            .join('\n'),
        };
      });
    setExportDataModalData(exportData);
    setExportDataModalOpen(true);
    trackEvent(ANALYTICS_KEYS.automation_export, { type: 'spreadsheet' });
  }

  return (
    <div>
      {exportDataModalOpen && (
        <FileDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Export Automation"
          modalTagline="Exported data will reflect what is in Salesforce, not unsaved changes"
          data={exportDataModalData}
          header={['Type', 'Object', 'Name', 'Is Active', 'Active Version', 'Last Modified', 'Description', 'Additional Information']}
          fileNameParts={['automation']}
          onModalClose={() => setExportDataModalOpen(false)}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      {exportMetadataModalOpen && (
        <FileFauxDownloadModal
          modalHeader="Export Automation Package"
          modalTagline="You can deploy the downloaded package on the Deploy Metadata page"
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          fileNameParts={['automation']}
          allowedTypes={['zip']}
          onCancel={() => setExportMetadataModalOpen(false)}
          onDownload={handlePackageDownload}
        />
      )}
      <RequireMetadataApiBanner />
      <Toolbar>
        <ToolbarItemGroup>
          <Link
            className="slds-button slds-button_brand"
            title="Go back"
            to=".."
            // onClick={handleGoBack}
          >
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            <span>Go Back</span>
          </Link>
          {/* Select all does not work well for flows/process builders since there is a version that needs to be selected */}
          {/* <button className="slds-button slds-button_neutral slds-m-left_small" onClick={handleSelectAll}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
            Select All
          </button>
          <button className="slds-button slds-button_neutral slds-m-left_small" onClick={handleDeselectAll}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
            Deselect All
          </button> */}
          <SearchInput id="quick-filter" placeholder="Filter items..." className="slds-m-left_small" onChange={setQuickFilterText} />
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button
            className="slds-button slds-button_neutral collapsible-button collapsible-button-xl"
            onClick={handleResetChanges}
            title="Reset changes"
            disabled={loading || !dirtyCount}
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
            <span>Reset Changes</span>
          </button>
          <ButtonGroupContainer>
            <Tooltip content="Downloading as a metadata zip package will allow you to re-deploy the changes on the Deploy Metadata page.">
              <button
                className="slds-button slds-button_neutral slds-button_first collapsible-button collapsible-button-xl"
                disabled={loading}
                onClick={exportPackage}
              >
                <Icon type="utility" icon="archive" className="slds-button__icon slds-button__icon_left" />
                <span>Export as Zip</span>
              </button>
            </Tooltip>
            <button
              className="slds-button slds-button_neutral collapsible-button collapsible-button-md"
              disabled={loading}
              title="Export as Spreadsheet"
              onClick={exportSpreadsheet}
            >
              <Icon type="utility" icon="file" className="slds-button__icon slds-button__icon_left" />
              <span>Export as Spreadsheet</span>
            </button>
          </ButtonGroupContainer>
          <button className="slds-button slds-button_brand" disabled={loading || !dirtyCount} onClick={handleReviewChanges}>
            <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" />
            Review Changes
          </button>
        </ToolbarItemActions>
      </Toolbar>
      <div>
        <Grid>
          <Grid className="slds-grow slds-box_small slds-theme_default slds-is-relative" verticalAlign="center" wrap>
            {loading && <Spinner size="small"></Spinner>}
            <ButtonGroupContainer>
              <button
                className={classNames('slds-button slds-button_neutral')}
                title="Enable All"
                onClick={() => toggleAll(true)}
                disabled={loading}
              >
                <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
                Enable All
              </button>
              <button
                className={classNames('slds-button slds-button_neutral')}
                title="Disable All"
                onClick={() => toggleAll(false)}
                disabled={loading}
              >
                <Icon type="utility" icon="dash" className="slds-button__icon slds-button__icon_left" omitContainer />
                Disable All
              </button>
            </ButtonGroupContainer>
            <Badge className="slds-m-left_x-small">
              {formatNumber(dirtyCount)} {pluralizeFromNumber('item', dirtyCount)} modified
            </Badge>
            {selectedAutomationTypes.includes('FlowProcessBuilder') && (
              <div className="slds-col_bump-left">
                <AutomationControlLastRefreshedPopover onRefresh={handleRefreshProcessBuilders} />
              </div>
            )}
          </Grid>
        </Grid>
      </div>
      <AutoFullHeightContainer bottomBuffer={10} className="slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {hasError && <Toast type="error">Uh Oh. There was a problem loading these items.</Toast>}
        {!hasError && (
          <Grid>
            {/* <div>SidePanel to allow selection changes (optional)</div> */}
            {saveModalOpen && (
              <AutomationControlEditorReviewModal
                defaultApiVersion={defaultApiVersion}
                selectedOrg={selectedOrg}
                rows={dirtyRows}
                onClose={handleDeployModalClose}
              />
            )}
            <AutoFullHeightContainer
              className="slds-scrollable bg-white"
              bottomBuffer={10}
              setHeightAttr
              fillHeight
              delayForSecondTopCalc
              css={css`
                width: 100%;
              `}
            >
              <AutomationControlEditorTable
                serverUrl={serverUrl}
                skipFrontdoorLogin={skipFrontdoorLogin}
                selectedOrg={selectedOrg}
                rows={visibleRows}
                quickFilterText={quickFilterText}
                toggleRowExpand={toggleRowExpand}
                updateIsActiveFlag={updateIsActiveFlag}
              />
            </AutoFullHeightContainer>
          </Grid>
        )}
      </AutoFullHeightContainer>
    </div>
  );
};

export default AutomationControlEditor;

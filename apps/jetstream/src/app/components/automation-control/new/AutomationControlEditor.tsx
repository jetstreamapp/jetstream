import { css } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConnectedSobjectListMultiSelect,
  FileDownloadModal,
  Grid,
  Icon,
  Input,
  ListWithFilterMultiSelect,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  SearchInput,
  Spinner,
  Toast,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
} from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import { FunctionComponent, useRef, useState } from 'react';
import { useRouteMatch } from 'react-router';
import { Link } from 'react-router-dom';
import Split from 'react-split';
import { useTitle } from 'react-use';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../../app-state';
import * as fromAutomationCtlState from './automation-control.state';
import AutomationControlEditorTable from './AutomationControlEditorTable';
import { applicationCookieState, selectedOrgType } from '../../../app-state';
import { TableEditorImperativeHandle, TableRowItem, TableRowItemOrChild, TableRowItemSnapshot } from './automation-control-types';
import AutomationControlEditorReviewModal from './AutomationControlEditorReviewModal';
import AutomationControlEditorSaveSnapshotModal from './AutomationControlEditorSaveSnapshotModal';
import AutomationControlEditorRestoreSnapshotModal from './AutomationControlEditorRestoreSnapshotModal';
import DeployMetadataLastRefreshedPopover from './AutomationControlLastRefreshedPopover';
import { useAutomationControlData } from './useAutomationControlData';
import { isTableRow, isTableRowChild, isTableRowItem } from './automation-control-data-utils';
import classNames from 'classnames';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlEditorProps {
  goBackUrl: string;
}

export const AutomationControlEditor: FunctionComponent<AutomationControlEditorProps> = ({ goBackUrl }) => {
  useTitle(TITLES.AUTOMATION_CONTROL);
  const isMounted = useRef(null);
  // const automationControlEditorTableRef = useRef<TableEditorImperativeHandle>(null);
  const rollbar = useRollbar();

  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [{ defaultApiVersion, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const selectedSObjects = useRecoilValue(fromAutomationCtlState.selectedSObjectsState);
  const selectedAutomationTypes = useRecoilValue(fromAutomationCtlState.selectedAutomationTypes);

  // const [loading, setLoading] = useState(false);
  // const [isDirty, setIsDirty] = useState(false);
  const [dirtyRows, setDirtyRows] = useState<TableRowItem[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [quickFilterText, setQuickFilterText] = useState<string>(null);

  const [exportDataModalOpen, setExportDataModalOpen] = useState<boolean>(false);
  const [exportDataModalData, setExportDataModalData] = useState<any[]>([]);

  const {
    rows,
    hasError,
    errorMessage,
    loading,
    fetchData,
    refreshProcessBuilders,
    updateIsActiveFlag,
    toggleAll,
    resetChanges,
    restoreSnapshot,
    isDirty,
  } = useAutomationControlData({
    selectedOrg,
    defaultApiVersion,
    selectedSObjects,
    selectedAutomationTypes,
  });

  function handleResetChanges() {
    resetChanges();
  }

  function handleReviewChanges() {
    setDirtyRows(
      rows.filter((row) => {
        if (isTableRow(row) || isTableRowChild(row)) {
          return false;
        }
        return row.isActive !== row.isActiveInitialState || row.activeVersionNumber !== row.activeVersionNumberInitialState;
      }) as TableRowItem[]
    );
    setSaveModalOpen(true);
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

  // function handleRestoreSnapshot(snapshot: TableRowItemSnapshot[]) {
  //   restoreSnapshot(snapshot);
  // }

  function exportChanges() {
    const exportData = rows
      .filter((row) => isTableRowItem(row))
      .map((row: TableRowItem) => {
        return {
          Type: row.type,
          Object: row.sobject,
          Name: row.label,
          'Is Active': row.isActiveInitialState,
          'Active Version': row.activeVersionNumber,
          'Last Modified': row.lastModifiedBy,
          Description: row.description,
        };
      });
    setExportDataModalData(exportData);
    setExportDataModalOpen(true);
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
          header={['Type', 'Object', 'Name', 'Is Active', 'Active Version', 'Last Modified', 'Description']}
          fileNameParts={['automation']}
          onModalClose={() => setExportDataModalOpen(false)}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      <Toolbar>
        <ToolbarItemGroup>
          <Link
            className="slds-button slds-button_brand"
            to={{ pathname: goBackUrl }}
            // onClick={handleGoBack}
          >
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
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
          <button className="slds-button slds-button_neutral" onClick={handleResetChanges} disabled={loading || !isDirty}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
            Reset Changes
          </button>
          {/* TODO: EXPORT should allow downloading spreadsheet or metadata package (for future rollback) */}
          {/* We probably also want to allow saving the current state somehow and recalling it in the future (just dirty state) */}
          <button className="slds-button slds-button_neutral" disabled={loading} onClick={exportChanges}>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" />
            Export
          </button>
          <button className="slds-button slds-button_brand" disabled={loading || !isDirty} onClick={handleReviewChanges}>
            <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" />
            Review Changes
          </button>
        </ToolbarItemActions>
      </Toolbar>
      <div>
        <Grid>
          <Grid className="slds-grow slds-box_small slds-theme_default slds-is-relative" verticalAlign="center" wrap>
            {loading && <Spinner size="small"></Spinner>}
            {/* TODO: */}
            {/* <AutomationControlEditorSaveSnapshotModal selectedOrg={selectedOrg} rows={rows} /> */}
            {/* <AutomationControlEditorRestoreSnapshotModal selectedOrg={selectedOrg} onRestore={handleRestoreSnapshot} /> */}
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
            <div className="slds-col_bump-left">
              <DeployMetadataLastRefreshedPopover onRefresh={handleRefreshProcessBuilders} />
            </div>
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
                // ref={automationControlEditorTableRef}
                // defaultApiVersion={defaultApiVersion}
                // selectedOrg={selectedOrg}
                // selectedSObjects={selectedSObjects}
                // selectedAutomationTypes={selectedAutomationTypes}
                rows={rows}
                quickFilterText={quickFilterText}
                updateIsActiveFlag={updateIsActiveFlag}
                // onLoading={setLoading}
                // onDirtyChanged={setIsDirty}
              />
            </AutoFullHeightContainer>
          </Grid>
        )}
      </AutoFullHeightContainer>
    </div>
  );
};

export default AutomationControlEditor;

import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useNonInitialEffect, usePrimaryActionShortcut, useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import {
  AsyncJob,
  AsyncJobNew,
  DescribeGlobalSObjectResult,
  ListItem,
  PermissionExportAnalysisJob,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConnectedSobjectListMultiSelect,
  Icon,
  KeyboardShortcut,
  ListWithFilterMultiSelect,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ProfileOrPermSetPopover,
  ProfileOrPermSetRecordType,
  Tooltip,
  fireToast,
  getModifierKey,
} from '@jetstream/ui';
import { RequireMetadataApiBanner, fromJetstreamEvents, fromPermissionsState, jobsState } from '@jetstream/ui-core';
import { applicationCookieState, selectSkipFrontdoorAuth, selectedOrgState } from '@jetstream/ui/app-state';
import { recentHistoryItemsDb } from '@jetstream/ui/db';
import { useAtom, useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PermissionAnalysisHistoryModal } from './PermissionAnalysisHistoryModal';
import { filterPermissionsSobjects } from './utils/permission-manager-utils';

const HEIGHT_BUFFER = 170;

/**
 * Local mirror of `isAnalysisJobActive` from `@jetstream/feature/data-analysis`. Inlined to avoid
 * a circular dependency (data-analysis imports `PermissionAnalysisHistoryModal` from this lib).
 */
function isPermissionExportJobActive(jobs: Record<string, AsyncJob<unknown>>, orgUniqueId: string): boolean {
  return Object.values(jobs).some((job) => {
    if (!job || job.type !== 'PermissionExportAnalysis') {
      return false;
    }
    const inFlight = job.status === 'pending' || job.status === 'in-progress';
    if (!inFlight) {
      return false;
    }
    const meta = job.meta as { orgUniqueId?: string } | undefined;
    return meta?.orgUniqueId === orgUniqueId;
  });
}

export type ManagePermissionsSelectionMode = 'manage' | 'permission-analysis';

export interface ManagePermissionsSelectionProps {
  /** `permission-analysis` uses the same object picker to optionally narrow ObjectPermissions / FieldPermissions export rows (via job payload `objectApiNames`). */
  selectionMode?: ManagePermissionsSelectionMode;
}

export const ManagePermissionsSelection: FunctionComponent<ManagePermissionsSelectionProps> = ({ selectionMode = 'manage' }) => {
  const navigate = useNavigate();
  const selectedOrg = useAtomValue(selectedOrgState);
  const { serverUrl } = useAtomValue(applicationCookieState);
  const skipFrontDoorAuth = useAtomValue(selectSkipFrontdoorAuth);

  const renderPopoverTrigger = (recordType: ProfileOrPermSetRecordType) => (item: ListItem) => (
    <ProfileOrPermSetPopover
      org={selectedOrg}
      serverUrl={serverUrl}
      skipFrontDoorAuth={skipFrontDoorAuth}
      recordId={item.id}
      recordType={recordType}
      meta={item.meta as PermissionSetWithProfileRecord | PermissionSetNoProfileRecord | undefined}
    />
  );

  const [profiles, setProfiles] = useAtom(fromPermissionsState.profilesState);
  const [selectedProfiles, setSelectedProfiles] = useAtom(fromPermissionsState.selectedProfilesPermSetState);

  const [permissionSets, setPermissionSets] = useAtom(fromPermissionsState.permissionSetsState);
  const [selectedPermissionSets, setSelectedPermissionSets] = useAtom(fromPermissionsState.selectedPermissionSetsState);

  const [sobjects, setSobjects] = useAtom(fromPermissionsState.sObjectsState);
  const [selectedSObjects, setSelectedSObjects] = useAtom(fromPermissionsState.selectedSObjectsState);

  const resetFieldsByObject = useResetAtom(fromPermissionsState.fieldsByObject);
  const resetFieldsByKey = useResetAtom(fromPermissionsState.fieldsByKey);
  const resetObjectPermissionMap = useResetAtom(fromPermissionsState.objectPermissionMap);
  const resetFieldPermissionMap = useResetAtom(fromPermissionsState.fieldPermissionMap);
  const resetTabVisibilityPermissionMap = useResetAtom(fromPermissionsState.tabVisibilityPermissionMap);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const jobs = useAtomValue(jobsState);

  const profilesAndPermSetsData = useProfilesAndPermSets(selectedOrg, profiles, permissionSets);

  const hasSelectionsMade = useAtomValue(fromPermissionsState.hasSelectionsMade);

  const isAnalysis = selectionMode === 'permission-analysis';

  const canContinueAnalysis = useMemo(() => {
    return selectedProfiles.length > 0 || selectedPermissionSets.length > 0;
  }, [selectedProfiles.length, selectedPermissionSets.length]);

  const continueEnabled = isAnalysis ? canContinueAnalysis : hasSelectionsMade;

  // Run only on first render
  useEffect(() => {
    if (!profiles || !permissionSets) {
      profilesAndPermSetsData.fetchMetadata();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useNonInitialEffect(() => {
    setProfiles(profilesAndPermSetsData.profiles);
    setPermissionSets(profilesAndPermSetsData.permissionSets);
  }, [profilesAndPermSetsData.profiles, profilesAndPermSetsData.permissionSets]);

  useEffect(() => {
    resetFieldsByObject();
    resetFieldsByKey();
    resetObjectPermissionMap();
    resetFieldPermissionMap();
    resetTabVisibilityPermissionMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfiles, selectedPermissionSets, selectedSObjects]);

  function handleSobjectChange(sobjects: DescribeGlobalSObjectResult[] | null) {
    setSobjects(sobjects);
  }

  const handleContinueAnalysis = useCallback(() => {
    if (!canContinueAnalysis || !selectedOrg) {
      return;
    }
    if (isPermissionExportJobActive(jobs, selectedOrg.uniqueId)) {
      fireToast({
        message: 'A Permission Export job is already running for this org. Wait for it to finish before starting another.',
        type: 'warning',
      });
      return;
    }

    const jobHistoryKey = `aj_${crypto.randomUUID()}`;
    const meta: PermissionExportAnalysisJob = {
      jobHistoryKey,
      orgUniqueId: selectedOrg.uniqueId,
      profileIds: selectedProfiles,
      permissionSetIds: selectedPermissionSets,
      ...(selectedSObjects.length > 0 ? { objectApiNames: selectedSObjects } : {}),
    };
    const asyncJobNew: AsyncJobNew<PermissionExportAnalysisJob> = {
      type: 'PermissionExportAnalysis',
      title: `Permission Export (${selectedProfiles.length + selectedPermissionSets.length} selection${
        selectedProfiles.length + selectedPermissionSets.length === 1 ? '' : 's'
      })`,
      org: selectedOrg,
      meta,
      viewUrl: `${APP_ROUTES.PERMISSION_ANALYSIS.ROUTE}/analysis?job=${encodeURIComponent(jobHistoryKey)}`,
    };
    fromJetstreamEvents.emit({ type: 'newJob', payload: [asyncJobNew] });
    fireToast({ message: 'Permission Export job started. Loading results…', type: 'success' });
    navigate(`analysis?job=${encodeURIComponent(jobHistoryKey)}`);
  }, [canContinueAnalysis, jobs, navigate, selectedOrg, selectedPermissionSets, selectedProfiles, selectedSObjects]);

  function handleContinue() {
    if (!sobjects || !sobjects.length) {
      return;
    }
    recentHistoryItemsDb.addItemToRecentHistoryItems(
      selectedOrg.uniqueId,
      'sobject',
      sobjects.map((row: DescribeGlobalSObjectResult) => row.name),
    );
  }

  // Cmd/Ctrl+Enter triggers the primary "Continue" action for whichever mode is active.
  usePrimaryActionShortcut(
    () => {
      if (isAnalysis) {
        handleContinueAnalysis();
        return;
      }
      handleContinue();
      navigate('editor');
    },
    { disabled: !continueEnabled },
  );

  return (
    <Page testId="manage-permissions-page">
      <RequireMetadataApiBanner />
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'portal' }}
            label={isAnalysis ? 'Permission Analysis' : 'Manage Permissions'}
            docsPath={APP_ROUTES.PERMISSION_MANAGER.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            {isAnalysis && (
              <Tooltip ariaRole="label" content="View past permission export runs for this org">
                <button
                  type="button"
                  aria-label="Export history"
                  className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
                  css={css`
                    padding: 0.5rem;
                  `}
                  disabled={!selectedOrg?.uniqueId}
                  onClick={() => setIsHistoryOpen(true)}
                >
                  <Icon type="utility" icon="date_time" className="slds-button__icon" omitContainer title="Export history" />
                </button>
              </Tooltip>
            )}
            {!isAnalysis && (
              <Link className="slds-button slds-button_neutral" to={APP_ROUTES.PERMISSION_ANALYSIS.ROUTE}>
                Open in Permission Analysis
              </Link>
            )}
            {continueEnabled && !isAnalysis && (
              <Tooltip
                openDelay={500}
                content={
                  <div className="slds-p-bottom_small">
                    <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
                  </div>
                }
              >
                <Link className="slds-button slds-button_brand" to="editor" onClick={handleContinue}>
                  Continue
                  <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
                </Link>
              </Tooltip>
            )}
            {continueEnabled && isAnalysis && (
              <Tooltip
                openDelay={500}
                content={
                  <div className="slds-p-bottom_small">
                    <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
                  </div>
                }
              >
                <button type="button" className="slds-button slds-button_brand" onClick={handleContinueAnalysis}>
                  Continue
                  <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
                </button>
              </Tooltip>
            )}
            {!continueEnabled && (
              <button className="slds-button slds-button_brand" disabled>
                Continue
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </button>
            )}
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div
            className="slds-col_bump-left"
            css={css`
              min-height: 19px;
            `}
          >
            {isAnalysis && !continueEnabled && (
              <span>
                Select at least one profile or one permission set to continue. Objects are optional — use them only if you want to narrow
                object and field permission rows to specific types.
              </span>
            )}
            {!isAnalysis && !hasSelectionsMade && <span>Select one or more profiles or permission sets and one or more objects</span>}
            {isAnalysis && continueEnabled && selectedSObjects.length === 0 && (
              <span className="slds-text-color_weak">
                Ready to continue. Objects are optional: with none selected, the job loads all object and field permission rows for your
                chosen profiles and permission sets. Add objects in the right column to narrow that export.
              </span>
            )}
            {isAnalysis && continueEnabled && selectedSObjects.length > 0 && (
              <span className="slds-text-color_weak">
                Export limited to {selectedSObjects.length} object type{selectedSObjects.length === 1 ? '' : 's'} for object and field
                permissions.
              </span>
            )}
          </div>
        </PageHeaderRow>
      </PageHeader>
      {isHistoryOpen && selectedOrg && (
        <PermissionAnalysisHistoryModal
          selectedOrg={selectedOrg}
          analysisJobType="permission_export"
          currentJobId={null}
          onClose={() => setIsHistoryOpen(false)}
          onSelectJob={(nextJobId) => {
            setIsHistoryOpen(false);
            navigate(`analysis?job=${encodeURIComponent(nextJobId)}`);
          }}
        />
      )}
      <AutoFullHeightContainer
        bottomBuffer={10}
        className="slds-p-horizontal_x-small slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        <Split
          sizes={[33, 33, 33]}
          minSize={[300, 300, 300]}
          gutterSize={sobjects?.length ? 10 : 0}
          className="slds-gutters"
          css={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div className="slds-p-horizontal_x-small">
            <ListWithFilterMultiSelect
              labels={{
                listHeading: 'Profiles',
                filter: 'Filter Profiles',
                descriptorSingular: 'profile',
                descriptorPlural: 'profiles',
              }}
              items={profiles}
              selectedItems={selectedProfiles}
              allowRefresh
              lastRefreshed={profilesAndPermSetsData.lastRefreshed}
              loading={profilesAndPermSetsData.loading}
              itemTrailingRenderer={renderPopoverTrigger('Profile')}
              onSelected={setSelectedProfiles}
              errorReattempt={profilesAndPermSetsData.fetchMetadata}
              onRefresh={() => profilesAndPermSetsData.fetchMetadata(true)}
            />
          </div>
          <div className="slds-p-horizontal_x-small">
            <ListWithFilterMultiSelect
              labels={{
                listHeading: 'Permission Sets',
                filter: 'Filter Permission Sets',
                descriptorSingular: 'permission set',
                descriptorPlural: 'permission sets',
              }}
              items={permissionSets}
              allowRefresh
              lastRefreshed={profilesAndPermSetsData.lastRefreshed}
              selectedItems={selectedPermissionSets}
              loading={profilesAndPermSetsData.loading}
              itemTrailingRenderer={renderPopoverTrigger('PermissionSet')}
              onSelected={setSelectedPermissionSets}
              errorReattempt={profilesAndPermSetsData.fetchMetadata}
              onRefresh={() => profilesAndPermSetsData.fetchMetadata(true)}
            />
          </div>
          <div className="slds-p-horizontal_x-small">
            <ConnectedSobjectListMultiSelect
              selectedOrg={selectedOrg}
              sobjects={sobjects}
              selectedSObjects={selectedSObjects}
              recentItemsEnabled
              recentItemsKey="sobject"
              filterFn={filterPermissionsSobjects}
              onSobjects={handleSobjectChange}
              onSelectedSObjects={setSelectedSObjects}
            />
          </div>
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default ManagePermissionsSelection;

import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { createAnalysisJob } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useNonInitialEffect, useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { DescribeGlobalSObjectResult, ListItem, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConnectedSobjectListMultiSelect,
  Icon,
  ListWithFilterMultiSelect,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ProfileOrPermSetPopover,
  ProfileOrPermSetRecordType,
  fireToast,
} from '@jetstream/ui';
import { RequireMetadataApiBanner, fromPermissionsState } from '@jetstream/ui-core';
import { applicationCookieState, selectSkipFrontdoorAuth, selectedOrgState } from '@jetstream/ui/app-state';
import { recentHistoryItemsDb } from '@jetstream/ui/db';
import { useAtom, useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { filterPermissionsSobjects } from './utils/permission-manager-utils';

const HEIGHT_BUFFER = 170;

export type ManagePermissionsSelectionMode = 'manage' | 'permission-analysis';

export interface ManagePermissionsSelectionProps {
  /** `permission-analysis` disables object selection and only requires profiles / permission sets to continue. */
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

  const [analysisContinueLoading, setAnalysisContinueLoading] = useState(false);

  const profilesAndPermSetsData = useProfilesAndPermSets(selectedOrg, profiles, permissionSets);

  const hasSelectionsMade = useAtomValue(fromPermissionsState.hasSelectionsMade);

  const canContinueAnalysis = useMemo(() => {
    return selectedProfiles.length > 0 || selectedPermissionSets.length > 0;
  }, [selectedProfiles.length, selectedPermissionSets.length]);

  const continueEnabled = selectionMode === 'permission-analysis' ? canContinueAnalysis : hasSelectionsMade;

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

  const handleContinueAnalysis = useCallback(async () => {
    if (!canContinueAnalysis || !selectedOrg) {
      return;
    }
    setAnalysisContinueLoading(true);
    try {
      const { job } = await createAnalysisJob(selectedOrg, {
        jobType: 'permission_export',
        payload: {
          profileIds: selectedProfiles,
          permissionSetIds: selectedPermissionSets,
        },
      });
      const jobId = job && typeof job.id === 'string' ? job.id : null;
      if (!jobId) {
        throw new Error('Analysis job did not return an id.');
      }
      navigate(`analysis?job=${encodeURIComponent(jobId)}`);
    } catch (ex) {
      logger.error('Failed to start permission analysis job', ex);
      fireToast({
        type: 'error',
        message: `Could not start analysis job: ${getErrorMessage(ex)}`,
      });
    } finally {
      setAnalysisContinueLoading(false);
    }
  }, [canContinueAnalysis, navigate, selectedOrg, selectedPermissionSets, selectedProfiles]);

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

  const isAnalysis = selectionMode === 'permission-analysis';

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
            {!isAnalysis && (
              <Link className="slds-button slds-button_neutral" to={APP_ROUTES.PERMISSION_ANALYSIS.ROUTE}>
                Open in Permission Analysis
              </Link>
            )}
            {continueEnabled && !isAnalysis && (
              <Link className="slds-button slds-button_brand" to="editor" onClick={handleContinue}>
                Continue
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </Link>
            )}
            {continueEnabled && isAnalysis && (
              <button
                type="button"
                className="slds-button slds-button_brand"
                disabled={analysisContinueLoading}
                onClick={() => void handleContinueAnalysis()}
              >
                Continue
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </button>
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
              <span>Select one or more profiles or permission sets. Object scope is not used in Analysis v1.</span>
            )}
            {!isAnalysis && !hasSelectionsMade && <span>Select one or more profiles or permission sets and one or more objects</span>}
            {isAnalysis && continueEnabled && (
              <span className="slds-text-color_weak">
                Objects column is visible for context but disabled in v1. Continue to open the Analysis workspace.
              </span>
            )}
          </div>
        </PageHeaderRow>
      </PageHeader>
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
              disabled={isAnalysis}
            />
          </div>
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default ManagePermissionsSelection;

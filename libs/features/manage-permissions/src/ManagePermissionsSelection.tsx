import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useNonInitialEffect, useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { DescribeGlobalSObjectResult, SalesforceOrgUi } from '@jetstream/types';
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
} from '@jetstream/ui';
import { RequireMetadataApiBanner, fromPermissionsState } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { recentHistoryItemsDb } from '@jetstream/ui/db';
import { FunctionComponent, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAtom, useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { filterPermissionsSobjects } from './utils/permission-manager-utils';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagePermissionsSelectionProps {}

export const ManagePermissionsSelection: FunctionComponent<ManagePermissionsSelectionProps> = () => {
  const selectedOrg = useAtomValue<SalesforceOrgUi>(selectedOrgState);

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

  const profilesAndPermSetsData = useProfilesAndPermSets(selectedOrg, profiles, permissionSets);

  const hasSelectionsMade = useAtomValue(fromPermissionsState.hasSelectionsMade);

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

  function handleContinue() {
    if (!sobjects?.length) {
      return;
    }
    recentHistoryItemsDb.addItemToRecentHistoryItems(
      selectedOrg.uniqueId,
      'sobject',
      sobjects.map(({ name }) => name)
    );
  }

  return (
    <Page testId="manage-permissions-page">
      <RequireMetadataApiBanner />
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'portal' }}
            label="Manage Permissions"
            docsPath={APP_ROUTES.PERMISSION_MANAGER.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            {hasSelectionsMade && (
              <Link className="slds-button slds-button_brand" to="editor" onClick={handleContinue}>
                Continue
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </Link>
            )}
            {!hasSelectionsMade && (
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
            {!hasSelectionsMade && <span>Select one or more profiles or permission sets and one or more objects</span>}
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

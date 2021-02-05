/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
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
import { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent, useEffect } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import Split from 'react-split';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../app-state';
import * as fromPermissionsStateState from './manage-permissions.state';
import { useProfilesAndPermSets } from './useProfilesAndPermSets';
import { filterPermissionsSobjects } from './utils/permission-manager-utils';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagePermissionsSelectionProps {}

export const ManagePermissionsSelection: FunctionComponent<ManagePermissionsSelectionProps> = () => {
  const match = useRouteMatch();

  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  const [profiles, setProfiles] = useRecoilState(fromPermissionsStateState.profilesState);
  const [selectedProfiles, setSelectedProfiles] = useRecoilState(fromPermissionsStateState.selectedProfilesPermSetState);

  const [permissionSets, setPermissionSets] = useRecoilState(fromPermissionsStateState.permissionSetsState);
  const [selectedPermissionSets, setSelectedPermissionSets] = useRecoilState(fromPermissionsStateState.selectedPermissionSetsState);

  const [sobjects, setSobjects] = useRecoilState(fromPermissionsStateState.sObjectsState);
  const [selectedSObjects, setSelectedSObjects] = useRecoilState(fromPermissionsStateState.selectedSObjectsState);

  const resetFieldsByObject = useResetRecoilState(fromPermissionsStateState.fieldsByObject);
  const resetFieldsByKey = useResetRecoilState(fromPermissionsStateState.fieldsByKey);
  const resetObjectPermissionMap = useResetRecoilState(fromPermissionsStateState.objectPermissionMap);
  const resetFieldPermissionMap = useResetRecoilState(fromPermissionsStateState.fieldPermissionMap);

  // TODO: what about if we already have profiles and perm sets from state?
  // TODO: when loading, should we clear prior selections?
  const profilesAndPermSetsData = useProfilesAndPermSets(selectedOrg);

  const hasSelectionsMade = useRecoilValue(fromPermissionsStateState.hasSelectionsMade);

  useEffect(() => {
    setProfiles(profilesAndPermSetsData.profiles);
    setPermissionSets(profilesAndPermSetsData.permissionSets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesAndPermSetsData.profiles, profilesAndPermSetsData.permissionSets]);

  useEffect(() => {
    resetFieldsByObject();
    resetFieldsByKey();
    resetObjectPermissionMap();
    resetFieldPermissionMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfiles, selectedPermissionSets, selectedSObjects]);

  function handleSobjectChange(sobjects: DescribeGlobalSObjectResult[]) {
    setSobjects(sobjects);
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'portal' }} label="Manage Permissions" />
          <PageHeaderActions colType="actions" buttonType="separate">
            {hasSelectionsMade && (
              <Link
                className="slds-button slds-button_brand"
                to={{
                  pathname: `${match.url}/editor`,
                }}
              >
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

import { css } from '@emotion/react';
import { useNonInitialEffect, useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { DescribeGlobalSObjectResult, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConnectedSobjectListMultiSelect,
  ConnectedSobjectListMultiSelectRef,
  Icon,
  ListWithFilterMultiSelect,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
} from '@jetstream/ui';
import { RequireMetadataApiBanner, filterCreateFieldsSobjects, selectedOrgState } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import * as fromCreateFieldsState from './create-fields.state';
import CreateNewObject from './create-new-object/CreateNewObject';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CreateFieldsSelectionProps {}

export const CreateFieldsSelection: FunctionComponent<CreateFieldsSelectionProps> = () => {
  const sobjectListRef = useRef<ConnectedSobjectListMultiSelectRef>();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  const [profiles, setProfiles] = useRecoilState(fromCreateFieldsState.profilesState);
  const [selectedProfiles, setSelectedProfiles] = useRecoilState(fromCreateFieldsState.selectedProfilesPermSetState);

  const [permissionSets, setPermissionSets] = useRecoilState(fromCreateFieldsState.permissionSetsState);
  const [selectedPermissionSets, setSelectedPermissionSets] = useRecoilState(fromCreateFieldsState.selectedPermissionSetsState);

  const [sobjects, setSobjects] = useRecoilState(fromCreateFieldsState.sObjectsState);
  const [selectedSObjects, setSelectedSObjects] = useRecoilState(fromCreateFieldsState.selectedSObjectsState);

  const profilesAndPermSetsData = useProfilesAndPermSets(selectedOrg, profiles, permissionSets);

  const hasSelectionsMade = useRecoilValue(fromCreateFieldsState.hasSelectionsMade);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesAndPermSetsData.profiles, profilesAndPermSetsData.permissionSets]);

  function handleSobjectChange(sobjects: DescribeGlobalSObjectResult[] | null) {
    setSobjects(sobjects);
  }

  return (
    <Page testId="create-field-selection-page">
      <RequireMetadataApiBanner />
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'form' }} label="Create Fields" docsPath="/deploy-fields" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <CreateNewObject
              initialSelectedProfiles={selectedProfiles}
              initialSelectedPermissionSets={selectedPermissionSets}
              selectedOrg={selectedOrg}
              onClose={(createdNewObject) => {
                createdNewObject && sobjectListRef.current?.refresh();
              }}
            />
            {hasSelectionsMade && (
              <Link className="slds-button slds-button_brand" to="configurator">
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
            {!hasSelectionsMade && <span>Choose at least one object and optionally profiles and permission sets.</span>}
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
            <ConnectedSobjectListMultiSelect
              ref={sobjectListRef}
              label="Object(s) to create fields on"
              selectedOrg={selectedOrg}
              sobjects={sobjects}
              selectedSObjects={selectedSObjects}
              filterFn={filterCreateFieldsSobjects}
              onSobjects={handleSobjectChange}
              onSelectedSObjects={setSelectedSObjects}
            />
          </div>
          <div className="slds-p-horizontal_x-small">
            <ListWithFilterMultiSelect
              labels={{
                listHeading: 'Add FLS to Profiles',
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
                listHeading: 'Add FLS to Permission Sets',
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
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default CreateFieldsSelection;

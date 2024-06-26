import { useNonInitialEffect, useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Grid, ListWithFilterMultiSelect, Radio, RadioGroup } from '@jetstream/ui';
import { Fragment, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { CreateNewObjectPermissionsCheckboxes } from './CreateNewObjectPermissionsCheckboxes';
import * as fromCreateObjectState from './create-object-state';
import { CreateObjectPermissions } from './create-object-types';

function getDefaultPermissions() {
  return {
    allowCreate: true,
    allowDelete: true,
    allowEdit: true,
    allowRead: true,
    modifyAllRecords: true,
    viewAllRecords: true,
  };
}

export interface CreateNewObjectPermissionsProps {
  selectedOrg: SalesforceOrgUi;
  loading: boolean;
  portalRef?: Element;
}

export const CreateNewObjectPermissions = ({ selectedOrg, loading, portalRef }: CreateNewObjectPermissionsProps) => {
  const [profiles, setProfiles] = useRecoilState(fromCreateObjectState.profilesState);
  const [selectedProfiles, setSelectedProfiles] = useRecoilState(fromCreateObjectState.selectedProfilesState);

  const [permissionSets, setPermissionSets] = useRecoilState(fromCreateObjectState.permissionSetsState);
  const [selectedPermissionSets, setSelectedPermissionSets] = useRecoilState(fromCreateObjectState.selectedPermissionSetsState);

  const profilesAndPermSetsData = useProfilesAndPermSets(selectedOrg, profiles, permissionSets);

  const [permissionScope, setPermissionScope] = useState<'ALL' | 'GRANULAR'>('ALL');

  const [objectPermissions, setObjectPermissions] = useState<CreateObjectPermissions>(getDefaultPermissions);

  const [objectPermissionsGranular, setObjectPermissionsGranular] = useState<Record<string, CreateObjectPermissions>>({});

  const [permissionLabelMap, setPermissionLabelMap] = useState<Record<string, string>>({});

  const selectedProfilesPermSets = [...selectedProfiles, ...selectedPermissionSets];

  useEffect(() => {
    const profilesPermSetsById = [...(profiles || []), ...(permissionSets || [])].reduce((acc: Record<string, string>, item) => {
      acc[item.value] = item.label;
      return acc;
    }, {});
    setPermissionLabelMap(
      [...selectedProfiles, ...selectedPermissionSets].reduce((acc: Record<string, string>, id) => {
        acc[id] = profilesPermSetsById[id];
        return acc;
      }, {})
    );
  }, [selectedProfiles, selectedPermissionSets, profiles, permissionSets]);

  useEffect(() => {
    setObjectPermissionsGranular((prevValue) => {
      const newValue = { ...prevValue };
      [...selectedProfiles, ...selectedPermissionSets].forEach((profileOrPermSet) => {
        if (!newValue[profileOrPermSet]) {
          newValue[profileOrPermSet] = getDefaultPermissions();
        }
      });
      return newValue;
    });
  }, [selectedProfiles, selectedPermissionSets]);

  useNonInitialEffect(() => {
    setProfiles(profilesAndPermSetsData.profiles);
    setPermissionSets(profilesAndPermSetsData.permissionSets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesAndPermSetsData.profiles, profilesAndPermSetsData.permissionSets]);

  return (
    <Grid className="slds-scrollable_x">
      <div className="slds-p-horizontal_x-small">
        <ListWithFilterMultiSelect
          autoFillContainerProps={{ bottomBuffer: 200 }}
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
          portalRef={portalRef}
          disabled={loading}
          onSelected={setSelectedProfiles}
          errorReattempt={profilesAndPermSetsData.fetchMetadata}
          onRefresh={() => profilesAndPermSetsData.fetchMetadata(true)}
        />
      </div>
      <div className="slds-p-horizontal_x-small">
        <ListWithFilterMultiSelect
          autoFillContainerProps={{ bottomBuffer: 200 }}
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
          portalRef={portalRef}
          disabled={loading}
          onSelected={setSelectedPermissionSets}
          errorReattempt={profilesAndPermSetsData.fetchMetadata}
          onRefresh={() => profilesAndPermSetsData.fetchMetadata(true)}
        />
      </div>
      <div className="slds-p-left_large">
        <h2 className="slds-text-heading_medium slds-grow slds-text-align_center slds-m-bottom_xx-small">Object Permissions</h2>

        <RadioGroup label="Permission Scope" className="slds-m-bottom_x-small">
          <Radio
            id="all-permissions"
            name="permissions-group"
            label="Apply Same Permissions to All"
            value="ALL"
            checked={permissionScope === 'ALL'}
            onChange={(value) => setPermissionScope(value as 'ALL' | 'GRANULAR')}
            disabled={loading}
          />
          <Radio
            id="granular-permissions"
            name="permissions-group"
            label="Apply Granular Permissions"
            value="GRANULAR"
            checked={permissionScope === 'GRANULAR'}
            onChange={(value) => setPermissionScope(value as 'ALL' | 'GRANULAR')}
            disabled={loading}
          />
        </RadioGroup>

        <hr className="slds-m-vertical_xx-small" />

        {permissionScope === 'ALL' && (
          <CreateNewObjectPermissionsCheckboxes
            loading={loading}
            objectPermissions={objectPermissions}
            onChange={(value) => setObjectPermissions(value)}
          />
        )}

        {permissionScope === 'GRANULAR' &&
          selectedProfilesPermSets.map((profileOrPermSet) => (
            <Fragment key={profileOrPermSet}>
              <h3 className="slds-text-heading_small slds-m-top_medium slds-m-bottom_x-small">{permissionLabelMap[profileOrPermSet]}</h3>
              <CreateNewObjectPermissionsCheckboxes
                loading={loading}
                objectPermissions={objectPermissionsGranular[profileOrPermSet]}
                onChange={(value) => setObjectPermissionsGranular((prevValue) => ({ ...prevValue, [profileOrPermSet]: value }))}
              />
            </Fragment>
          ))}
      </div>
    </Grid>
  );
};

export default CreateNewObjectPermissions;

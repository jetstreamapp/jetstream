import { useNonInitialEffect, useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, Grid, ListWithFilterMultiSelect } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';
import { useRecoilState } from 'recoil';
import * as fromCreateObjectState from './create-object-state';
import { CreateObjectPermissions } from './create-object-types';

export interface CreateNewObjectPermissionsProps {
  selectedOrg: SalesforceOrgUi;
  loading: boolean;
  portalRef?: Element;
}

export const CreateNewObjectPermissions: FunctionComponent<CreateNewObjectPermissionsProps> = ({ selectedOrg, loading, portalRef }) => {
  const [profiles, setProfiles] = useRecoilState(fromCreateObjectState.profilesState);
  const [selectedProfiles, setSelectedProfiles] = useRecoilState(fromCreateObjectState.selectedProfilesState);

  const [permissionSets, setPermissionSets] = useRecoilState(fromCreateObjectState.permissionSetsState);
  const [selectedPermissionSets, setSelectedPermissionSets] = useRecoilState(fromCreateObjectState.selectedPermissionSetsState);

  const profilesAndPermSetsData = useProfilesAndPermSets(selectedOrg, profiles, permissionSets);

  const [objectPermissions, setObjectPermissions] = useState<CreateObjectPermissions>({
    allowCreate: true,
    allowDelete: true,
    allowEdit: true,
    allowRead: true,
    modifyAllRecords: true,
    viewAllRecords: true,
  });

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
        <Checkbox
          id="objectPermissions.allowCreate"
          label="Allow Create"
          checked={objectPermissions.allowCreate}
          onChange={(value) => setObjectPermissions((priorValue) => ({ ...priorValue, allowCreate: value }))}
          disabled={loading}
        />
        <Checkbox
          id="objectPermissions.allowDelete"
          label="Allow Delete"
          checked={objectPermissions.allowDelete}
          onChange={(value) => setObjectPermissions((priorValue) => ({ ...priorValue, allowDelete: value }))}
          disabled={loading}
        />
        <Checkbox
          id="objectPermissions.allowEdit"
          label="Allow Edit"
          checked={objectPermissions.allowEdit}
          onChange={(value) => setObjectPermissions((priorValue) => ({ ...priorValue, allowEdit: value }))}
          disabled={loading}
        />
        <Checkbox
          id="objectPermissions.allowRead"
          label="Allow Read"
          checked={objectPermissions.allowRead}
          onChange={(value) => setObjectPermissions((priorValue) => ({ ...priorValue, allowRead: value }))}
          disabled={loading}
        />
        <Checkbox
          id="objectPermissions.modifyAllRecords"
          label="Modify All Records"
          checked={objectPermissions.modifyAllRecords}
          onChange={(value) => setObjectPermissions((priorValue) => ({ ...priorValue, modifyAllRecords: value }))}
          disabled={loading}
        />
        <Checkbox
          id="objectPermissions.viewAllRecords"
          label="View All Records"
          checked={objectPermissions.viewAllRecords}
          onChange={(value) => setObjectPermissions((priorValue) => ({ ...priorValue, viewAllRecords: value }))}
          disabled={loading}
        />
      </div>
    </Grid>
  );
};

export default CreateNewObjectPermissions;

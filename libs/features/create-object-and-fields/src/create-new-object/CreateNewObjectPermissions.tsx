import { useNonInitialEffect, useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { EmptyState, Grid, GridCol, ListWithFilterMultiSelect, Radio, RadioGroup } from '@jetstream/ui';
import { Fragment, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { CreateNewObjectPermissionsCheckboxes } from './CreateNewObjectPermissionsCheckboxes';
import * as fromCreateObjectState from './create-object-state';
import { CreateObjectPermissions, ObjectPermissionGranularState } from './create-object-types';

function getDefaultPermissions(): CreateObjectPermissions {
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

  const [objectPermissionsState, setObjectPermissionsState] = useRecoilState(fromCreateObjectState.objectPermissionsState);

  const selectedProfilesPermSets = useRecoilValue(fromCreateObjectState.selectedProfileAndPermLesWithLabelSelector);

  const profilesAndPermSetsData = useProfilesAndPermSets(selectedOrg, profiles, permissionSets);

  // When profiles are selected or de-selected, keep the permissions in sync
  useEffect(() => {
    setObjectPermissionsState((prevValue) => {
      if (prevValue.scope === 'GRANULAR') {
        // If the scope is already 'ALL', we don't need to do anything
        const newValue: ObjectPermissionGranularState = { ...prevValue, permissions: {} };
        [...selectedProfiles, ...selectedPermissionSets].forEach((profileOrPermSet) => {
          if (!prevValue.permissions[profileOrPermSet]) {
            newValue.permissions[profileOrPermSet] = getDefaultPermissions();
          } else {
            newValue.permissions[profileOrPermSet] = { ...prevValue.permissions[profileOrPermSet] };
          }
        });
        return newValue;
      }
      return prevValue;
    });
  }, [selectedProfiles, selectedPermissionSets, setObjectPermissionsState]);

  useNonInitialEffect(() => {
    setProfiles(profilesAndPermSetsData.profiles);
    setPermissionSets(profilesAndPermSetsData.permissionSets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesAndPermSetsData.profiles, profilesAndPermSetsData.permissionSets]);

  function handlePermissionScopeChange(value: 'ALL' | 'GRANULAR') {
    setObjectPermissionsState((prevValue) => {
      if (prevValue.scope === value) {
        return prevValue;
      }

      if (value === 'ALL') {
        return {
          scope: 'ALL',
          permissions: getDefaultPermissions(),
        };
      }

      return {
        scope: 'GRANULAR',
        permissions: selectedProfilesPermSets.reduce((acc: ObjectPermissionGranularState['permissions'], { value }) => {
          acc[value] = getDefaultPermissions();
          return acc;
        }, {}),
      };
    });
  }

  function handlePermissionsAllChange(value: CreateObjectPermissions) {
    setObjectPermissionsState({
      scope: 'ALL',
      permissions: value,
    });
  }

  function handlePermissionsGranularChange(value: CreateObjectPermissions, profileOrPermSet: string) {
    setObjectPermissionsState((prevValue) => {
      if (prevValue.scope === 'ALL') {
        return {
          scope: 'GRANULAR',
          permissions: {
            [profileOrPermSet]: value,
          },
        };
      }
      return {
        scope: 'GRANULAR',
        permissions: {
          ...prevValue.permissions,
          [profileOrPermSet]: value,
        },
      };
    });
  }

  return (
    <Grid gutters>
      <GridCol size={4}>
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
      </GridCol>
      <GridCol size={4}>
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
      </GridCol>
      <GridCol size={4} className="slds-p-left_large">
        <h2 className="slds-text-heading_medium slds-grow slds-m-bottom_xx-small">Object Permissions</h2>

        <RadioGroup label="Permission Scope" className="slds-m-bottom_x-small">
          <Radio
            id="all-permissions"
            name="permissions-group"
            label="Apply Same Permissions to All"
            value="ALL"
            checked={objectPermissionsState.scope === 'ALL'}
            onChange={(value) => handlePermissionScopeChange(value as 'ALL' | 'GRANULAR')}
            disabled={loading}
          />
          <Radio
            id="granular-permissions"
            name="permissions-group"
            label="Apply Granular Permissions"
            value="GRANULAR"
            checked={objectPermissionsState.scope === 'GRANULAR'}
            onChange={(value) => handlePermissionScopeChange(value as 'ALL' | 'GRANULAR')}
            disabled={loading}
          />
        </RadioGroup>

        <hr className="slds-m-vertical_xx-small" />

        {objectPermissionsState.scope === 'ALL' && (
          <CreateNewObjectPermissionsCheckboxes
            label="All Profiles and Permission Sets"
            loading={loading}
            objectPermissions={objectPermissionsState.permissions}
            onChange={(value) => handlePermissionsAllChange(value)}
          />
        )}

        {objectPermissionsState.scope === 'GRANULAR' && (
          <>
            {selectedProfilesPermSets.length === 0 && <EmptyState headline="Choose at least one Profile or Permission Set" size="small" />}
            {selectedProfilesPermSets
              .filter(({ value }) => objectPermissionsState.permissions[value])
              .map((item) => (
                <Fragment key={item.value}>
                  <CreateNewObjectPermissionsCheckboxes
                    label={item.label}
                    loading={loading}
                    objectPermissions={objectPermissionsState.permissions[item.value]}
                    onChange={(value) => handlePermissionsGranularChange(value, item.value)}
                  />
                </Fragment>
              ))}
          </>
        )}
      </GridCol>
    </Grid>
  );
};

export default CreateNewObjectPermissions;

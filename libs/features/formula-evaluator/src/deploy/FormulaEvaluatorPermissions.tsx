import { useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { ListItem, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord, SalesforceOrgUi } from '@jetstream/types';
import {
  Grid,
  GridCol,
  ListWithFilterMultiSelect,
  ProfileOrPermSetPopover,
  ProfileOrPermSetRecordType,
  ScopedNotification,
} from '@jetstream/ui';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';

export interface FormulaEvaluatorPermissionsProps extends Omit<ReturnType<typeof useProfilesAndPermSets>, 'profilesAndPermSetsById'> {
  selectedOrg: SalesforceOrgUi;
  selectedProfiles: string[];
  selectedPermissionSets: string[];
  onSelectedProfileChange: (items: string[]) => void;
  onSelectedPermissionSetChange: (items: string[]) => void;
}

export function FormulaEvaluatorPermissions({
  selectedOrg,
  selectedProfiles,
  selectedPermissionSets,
  hasError,
  lastRefreshed,
  loading,
  permissionSets,
  profiles,
  fetchMetadata,
  onSelectedProfileChange,
  onSelectedPermissionSetChange,
}: FormulaEvaluatorPermissionsProps) {
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

  return (
    <Grid gutters wrap>
      {hasError && (
        <GridCol size={12} className="slds-m-around-medium">
          <ScopedNotification theme="error" className="slds-m-top_medium">
            <p>There was an error loading permission data.</p>
          </ScopedNotification>
        </GridCol>
      )}
      <GridCol size={6}>
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
          lastRefreshed={lastRefreshed}
          loading={loading}
          /** 8rem = modal outer padding, 90px=header height, 60px=footer height, 225px=all extra stuff above scroll area */
          autoFillContainerProps={{ maxHeight: 'calc(100vh - 8rem - 90px - 60px - 225px)', fillHeight: false }}
          itemTrailingRenderer={renderPopoverTrigger('Profile')}
          onSelected={onSelectedProfileChange}
          errorReattempt={fetchMetadata}
          onRefresh={() => fetchMetadata(true)}
        />
      </GridCol>

      <GridCol size={6}>
        <ListWithFilterMultiSelect
          labels={{
            listHeading: 'Add FLS to Permission Sets',
            filter: 'Filter Permission Sets',
            descriptorSingular: 'permission set',
            descriptorPlural: 'permission sets',
          }}
          items={permissionSets}
          allowRefresh
          lastRefreshed={lastRefreshed}
          selectedItems={selectedPermissionSets}
          loading={loading}
          autoFillContainerProps={{ maxHeight: 'calc(100vh - 8rem - 90px - 60px - 225px)', fillHeight: false }}
          itemTrailingRenderer={renderPopoverTrigger('PermissionSet')}
          onSelected={onSelectedPermissionSetChange}
          errorReattempt={fetchMetadata}
          onRefresh={() => fetchMetadata(true)}
        />
      </GridCol>
    </Grid>
  );
}

export default FormulaEvaluatorPermissions;

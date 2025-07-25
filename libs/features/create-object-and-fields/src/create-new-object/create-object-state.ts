import { REGEX } from '@jetstream/shared/utils';
import { ListItem, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
import { CreateObjectPayload, ObjectPermissionState } from './create-object-types';

export const labelState = atomWithReset('');
export const pluralLabelState = atomWithReset('');
export const startsWithState = atomWithReset<'Consonant' | 'Vowel' | 'Special'>('Consonant');
export const apiNameState = atomWithReset('');
export const descriptionState = atomWithReset('');
export const recordNameState = atomWithReset('');
export const dataTypeState = atomWithReset<'Text' | 'AutoNumber'>('Text');
export const displayFormatState = atomWithReset('');
export const startingNumberState = atomWithReset('1');
export const allowReportsState = atomWithReset(false);
export const allowActivitiesState = atomWithReset(false);
export const trackFieldHistoryState = atomWithReset(false);
export const allowInChatterGroupsState = atomWithReset(false);
export const allowSharingBulkStreamingState = atomWithReset(true);
export const allowSearchState = atomWithReset(true);

export const createTabState = atomWithReset(true);
export const selectedTabIconState = atomWithReset('Custom20: Airplane');

export const profilesState = atomWithReset<ListItem<string, PermissionSetWithProfileRecord>[] | null>(null);
export const permissionSetsState = atomWithReset<ListItem<string, PermissionSetNoProfileRecord>[] | null>(null);

export const selectedProfilesState = atomWithReset<string[]>([]);
export const selectedPermissionSetsState = atomWithReset<string[]>([]);

export const objectPermissionsState = atomWithReset<ObjectPermissionState>({
  scope: 'ALL',
  permissions: {
    allowCreate: true,
    allowDelete: true,
    allowEdit: true,
    allowRead: true,
    modifyAllRecords: true,
    viewAllRecords: true,
  },
});

export const selectedProfileAndPermLesWithLabelSelector = atom((get) => {
  const selectedProfiles = new Set(get(selectedProfilesState));
  const selectedPermissionSets = new Set(get(selectedPermissionSetsState));
  const profiles = get(profilesState);
  const permissionSets = get(permissionSetsState);
  return [
    ...(profiles || []).filter((profile) => selectedProfiles.has(profile.value)),
    ...(permissionSets || []).filter((permissionSet) => selectedPermissionSets.has(permissionSet.value)),
  ];
});

export const payloadSelector = atom<CreateObjectPayload>((get) => {
  const dataType = get(dataTypeState);

  const nameField: CreateObjectPayload['nameField'] = {
    label: get(labelState),
    trackHistory: get(trackFieldHistoryState),
    type: get(dataTypeState),
  };

  if (dataType === 'AutoNumber') {
    nameField.displayFormat = get(displayFormatState);
    nameField.startingNumber = get(startingNumberState);
  }

  const payload: CreateObjectPayload = {
    allowInChatterGroups: get(allowInChatterGroupsState),
    compactLayoutAssignment: 'SYSTEM',
    deploymentStatus: 'Deployed',
    description: get(descriptionState),
    enableActivities: get(allowActivitiesState),
    enableBulkApi: get(allowSharingBulkStreamingState),
    enableEnhancedLookup: false,
    enableFeeds: get(allowInChatterGroupsState),
    enableHistory: get(trackFieldHistoryState),
    enableLicensing: false,
    enableReports: get(allowReportsState),
    enableSearch: get(allowSearchState),
    enableSharing: get(allowSharingBulkStreamingState),
    enableStreamingApi: get(allowSharingBulkStreamingState),
    externalSharingModel: 'Private',
    label: get(labelState),
    nameField,
    pluralLabel: get(pluralLabelState),
    recordTypeTrackHistory: false,
    sharingModel: 'ReadWrite',
    startsWith: get(startsWithState),
    visibility: 'Public',
  };

  return payload;
});

export const isFormValidSelector = atom<{
  permissionsAreValid: boolean;
  objectConfigIsValid: boolean;
  allValid: boolean;
}>((get) => {
  const selectedProfiles = get(selectedProfilesState);
  const selectedPermissionSets = get(selectedPermissionSetsState);
  const payload = get(payloadSelector);
  const objectPermissions = get(objectPermissionsState);
  let permissionsAreValid = true;
  // Assigning permissions is optional - we only validate config if at least one profile or permission set is selected
  if (selectedProfiles.length || selectedPermissionSets.length) {
    permissionsAreValid = (
      objectPermissions.scope === 'ALL' ? [objectPermissions.permissions] : Object.values(objectPermissions.permissions)
    ).every(
      (permissions) =>
        permissions.allowCreate ||
        permissions.allowDelete ||
        permissions.allowEdit ||
        permissions.allowRead ||
        permissions.modifyAllRecords ||
        permissions.viewAllRecords
    );
  }

  let objectConfigIsValid = !!payload.label && !!payload.pluralLabel && !!get(apiNameState) && !!payload.nameField.label;
  if (payload.nameField.type === 'AutoNumber') {
    objectConfigIsValid =
      objectConfigIsValid && !!payload.nameField.displayFormat && REGEX.NUMERIC.test(payload.nameField.startingNumber || '');
  }
  return {
    permissionsAreValid,
    objectConfigIsValid,
    allValid: permissionsAreValid && objectConfigIsValid,
  };
});

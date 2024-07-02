import { REGEX } from '@jetstream/shared/utils';
import { ListItem, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
import { atom, selector } from 'recoil';
import { CreateObjectPayload, ObjectPermissionState } from './create-object-types';

export const labelState = atom({ key: 'create-object.labelState', default: '' });
export const pluralLabelState = atom({ key: 'create-object.pluralLabelState', default: '' });
export const startsWithState = atom<'Consonant' | 'Vowel' | 'Special'>({ key: 'create-object.startsWithState', default: 'Consonant' });
export const apiNameState = atom({ key: 'create-object.apiNameState', default: '' });
export const descriptionState = atom({ key: 'create-object.descriptionState', default: '' });
export const recordNameState = atom({ key: 'create-object.recordNameState', default: '' });
export const dataTypeState = atom<'Text' | 'AutoNumber'>({ key: 'create-object.dataTypeState', default: 'Text' });
export const displayFormatState = atom({ key: 'create-object.displayFormatState', default: '' });
export const startingNumberState = atom({ key: 'create-object.startingNumberState', default: '1' });
export const allowReportsState = atom({ key: 'create-object.allowReportsState', default: false });
export const allowActivitiesState = atom({ key: 'create-object.allowActivitiesState', default: false });
export const trackFieldHistoryState = atom({ key: 'create-object.trackFieldHistoryState', default: false });
export const allowInChatterGroupsState = atom({ key: 'create-object.allowInChatterGroupsState', default: false });
export const allowSharingBulkStreamingState = atom({ key: 'create-object.allowSharingBulkStreamingState', default: true });
export const allowSearchState = atom({ key: 'create-object.allowSearchState', default: true });

export const createTabState = atom({ key: 'create-object.createTabState', default: true });
export const selectedTabIconState = atom({ key: 'create-object.selectedTabIconState', default: 'Custom20: Airplane' });

export const profilesState = atom<ListItem<string, PermissionSetWithProfileRecord>[] | null>({
  key: 'create-object.profilesState',
  default: null,
});
export const permissionSetsState = atom<ListItem<string, PermissionSetNoProfileRecord>[] | null>({
  key: 'create-object.permissionSetsState',
  default: null,
});

export const selectedProfilesState = atom<string[]>({ key: 'create-object.selectedProfilesState', default: [] });
export const selectedPermissionSetsState = atom<string[]>({ key: 'create-object.selectedPermissionSetsState', default: [] });

export const objectPermissionsState = atom<ObjectPermissionState>({
  key: 'create-object.objectPermissionsState',
  default: {
    scope: 'ALL',
    permissions: {
      allowCreate: true,
      allowDelete: true,
      allowEdit: true,
      allowRead: true,
      modifyAllRecords: true,
      viewAllRecords: true,
    },
  },
});

export const selectedProfileAndPermLesWithLabelSelector = selector({
  key: 'create-object.selectedProfileAndPermLesWithLabelSelector',
  get: ({ get }) => {
    const selectedProfiles = new Set(get(selectedProfilesState));
    const selectedPermissionSets = new Set(get(selectedPermissionSetsState));
    const profiles = get(profilesState);
    const permissionSets = get(permissionSetsState);
    return [
      ...(profiles || []).filter((profile) => selectedProfiles.has(profile.value)),
      ...(permissionSets || []).filter((permissionSet) => selectedPermissionSets.has(permissionSet.value)),
    ];
  },
});

export const payloadSelector = selector<CreateObjectPayload>({
  key: 'create-object.payloadSelector',
  get: ({ get }) => {
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
  },
});

export const isFormValidSelector = selector<{
  permissionsAreValid: boolean;
  objectConfigIsValid: boolean;
  allValid: boolean;
}>({
  key: 'create-object.isFormValid',
  get: ({ get }) => {
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
  },
});

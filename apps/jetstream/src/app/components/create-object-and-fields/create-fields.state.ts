import { ListItem, MapOf, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
import type { DescribeGlobalSObjectResult } from 'jsforce';
import { atom, selector } from 'recoil';
import { FieldValues } from './create-fields-types';
import { getInitialValues } from './create-fields-utils';

let key = 0;

export function getNextKey() {
  return key++;
}

export const sObjectsState = atom<DescribeGlobalSObjectResult[] | null>({
  key: 'create-fields.sObjectsState',
  default: null,
});

export const selectedSObjectsState = atom<string[]>({
  key: 'create-fields.selectedSObjectsState',
  default: [],
});

export const profilesState = atom<ListItem<string, PermissionSetWithProfileRecord>[] | null>({
  key: 'create-fields.profilesState',
  default: null,
});

// permission set id of profile
export const selectedProfilesPermSetState = atom<string[]>({
  key: 'create-fields.selectedProfilesPermSetState',
  default: [],
});

export const permissionSetsState = atom<ListItem<string, PermissionSetNoProfileRecord>[] | null>({
  key: 'create-fields.permissionSetsState',
  default: null,
});

export const selectedPermissionSetsState = atom<string[]>({
  key: 'create-fields.selectedPermissionSetsState',
  default: [],
});

export const fieldRowsState = atom<FieldValues[]>({
  key: 'create-fields.fieldRowsState',
  default: [getInitialValues(getNextKey())],
});

/**
 * Returns true if all selections have been made
 */
export const hasSelectionsMade = selector({
  key: 'create-fields.hasSelectionsMade',
  get: ({ get }) => {
    if (!get(selectedSObjectsState)?.length) {
      return false;
    }
    return true;
  },
});

export const profilesByIdSelector = selector<MapOf<PermissionSetWithProfileRecord>>({
  key: 'create-fields.profilesByIdSelector',
  get: ({ get }) => {
    const profiles = get(profilesState);
    if (profiles) {
      return profiles.reduce((output, profile) => {
        output[profile.id] = profile.meta;
        return output;
      }, {});
    }
    return {};
  },
});

export const permissionSetsByIdSelector = selector<MapOf<PermissionSetNoProfileRecord>>({
  key: 'create-fields.permissionSetsByIdSelector',
  get: ({ get }) => {
    const permSets = get(permissionSetsState);
    if (permSets) {
      return permSets.reduce((output, permSet) => {
        output[permSet.id] = permSet.meta;
        return output;
      }, {});
    }
    return {};
  },
});

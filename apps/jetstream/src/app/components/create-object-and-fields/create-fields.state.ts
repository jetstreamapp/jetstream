import { DescribeGlobalSObjectResult, ListItem, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
import { FieldValues, getInitialValues } from '@jetstream/ui-core';
import { atom, selector } from 'recoil';

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

export const profilesAndPermSetsByIdSelector = selector<Record<string, PermissionSetWithProfileRecord | PermissionSetNoProfileRecord>>({
  key: 'create-fields.profilesAndPermSetsByIdSelector',
  get: ({ get }) => {
    const profiles = get(profilesState);
    const permSets = get(permissionSetsState);
    const output: Record<string, PermissionSetWithProfileRecord | PermissionSetNoProfileRecord> = {};
    if (profiles) {
      profiles.reduce((output, profile) => {
        if (profile.meta) {
          output[profile.id] = profile.meta;
        }
        return output;
      }, output);
    }
    if (permSets) {
      permSets.reduce((output, permSet) => {
        if (permSet.meta) {
          output[permSet.id] = permSet.meta;
        }
        return output;
      }, output);
    }
    return output;
  },
});

import { DescribeGlobalSObjectResult, ListItem, PermissionSetNoProfileRecord, PermissionSetWithProfileRecord } from '@jetstream/types';
import { FieldValues, getInitialValues } from '@jetstream/ui-core';
import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';

let key = 0;

export function getNextKey() {
  return key++;
}

export const sObjectsState = atomWithReset<DescribeGlobalSObjectResult[] | null>(null);

export const selectedSObjectsState = atomWithReset<string[]>([]);

export const profilesState = atomWithReset<ListItem<string, PermissionSetWithProfileRecord>[] | null>(null);

// permission set id of profile
export const selectedProfilesPermSetState = atomWithReset<string[]>([]);

export const permissionSetsState = atomWithReset<ListItem<string, PermissionSetNoProfileRecord>[] | null>(null);

export const selectedPermissionSetsState = atomWithReset<string[]>([]);

export const fieldRowsState = atomWithReset<FieldValues[]>([getInitialValues(getNextKey())]);

/**
 * Returns true if all selections have been made
 */
export const hasSelectionsMade = atom((get) => {
  if (!get(selectedSObjectsState)?.length) {
    return false;
  }
  return true;
});

export const profilesAndPermSetsByIdSelector = atom<Record<string, PermissionSetWithProfileRecord | PermissionSetNoProfileRecord>>(
  (get) => {
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
  }
);

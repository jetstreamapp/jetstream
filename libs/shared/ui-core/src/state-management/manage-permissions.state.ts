import {
  DescribeGlobalSObjectResult,
  EntityParticlePermissionsRecord,
  FieldPermissionDefinitionMap,
  ListItem,
  ObjectPermissionDefinitionMap,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
  TabVisibilityPermissionDefinitionMap,
} from '@jetstream/types';
import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
export const sObjectsState = atomWithReset<DescribeGlobalSObjectResult[] | null>(null);

export const selectedSObjectsState = atomWithReset<string[]>([]);

export const profilesState = atomWithReset<ListItem<string, PermissionSetWithProfileRecord>[] | null>(null);

// permission set id of profile
export const selectedProfilesPermSetState = atomWithReset<string[]>([]);

export const permissionSetsState = atomWithReset<ListItem<string, PermissionSetNoProfileRecord>[] | null>(null);

export const selectedPermissionSetsState = atomWithReset<string[]>([]);

export const fieldsByObject = atomWithReset<Record<string, string[]> | null>(null);

// KEY = {SObject.FieldName}, ex: `${record.EntityDefinition.QualifiedApiName}.${record.QualifiedApiName}`
export const fieldsByKey = atomWithReset<Record<string, EntityParticlePermissionsRecord> | null>(null);

export const objectPermissionMap = atomWithReset<Record<string, ObjectPermissionDefinitionMap> | null>(null);

export const fieldPermissionMap = atomWithReset<Record<string, FieldPermissionDefinitionMap> | null>(null);

export const tabVisibilityPermissionMap = atomWithReset<Record<string, TabVisibilityPermissionDefinitionMap> | null>(null);

/**
 * Returns true if all selections have been made
 */
export const hasSelectionsMade = atom((get) => {
  if (!get(selectedSObjectsState)?.length) {
    return false;
  }
  if (!get(selectedProfilesPermSetState)?.length && !get(selectedPermissionSetsState)?.length) {
    return false;
  }
  return true;
});

export const profilesByIdSelector = atom<Record<string, PermissionSetWithProfileRecord>>((get) => {
  const profiles = get(profilesState);
  if (profiles) {
    return profiles.reduce((output, profile) => {
      output[profile.id] = profile.meta;
      return output;
    }, {});
  }
  return {};
});

export const permissionSetsByIdSelector = atom<Record<string, PermissionSetNoProfileRecord>>((get) => {
  const permSets = get(permissionSetsState);
  if (permSets) {
    return permSets.reduce((output, permSet) => {
      output[permSet.id] = permSet.meta;
      return output;
    }, {});
  }
  return {};
});

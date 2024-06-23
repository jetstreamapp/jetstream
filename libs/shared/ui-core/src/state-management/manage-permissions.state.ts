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
import { atom, selector } from 'recoil';
export const sObjectsState = atom<DescribeGlobalSObjectResult[] | null>({
  key: 'permission-manager.sObjectsState',
  default: null,
});

export const selectedSObjectsState = atom<string[]>({
  key: 'permission-manager.selectedSObjectsState',
  default: [],
});

export const profilesState = atom<ListItem<string, PermissionSetWithProfileRecord>[] | null>({
  key: 'permission-manager.profilesState',
  default: null,
});

// permission set id of profile
export const selectedProfilesPermSetState = atom<string[]>({
  key: 'permission-manager.selectedProfilesPermSetState',
  default: [],
});

export const permissionSetsState = atom<ListItem<string, PermissionSetNoProfileRecord>[] | null>({
  key: 'permission-manager.permissionSetsState',
  default: null,
});

export const selectedPermissionSetsState = atom<string[]>({
  key: 'permission-manager.selectedPermissionSetsState',
  default: [],
});

export const fieldsByObject = atom<Record<string, string[]> | null>({
  key: 'permission-manager.fieldsByObject',
  default: null,
});

// KEY = {SObject.FieldName}, ex: `${record.EntityDefinition.QualifiedApiName}.${record.QualifiedApiName}`
export const fieldsByKey = atom<Record<string, EntityParticlePermissionsRecord> | null>({
  key: 'permission-manager.fieldsByKey',
  default: null,
});

export const objectPermissionMap = atom<Record<string, ObjectPermissionDefinitionMap> | null>({
  key: 'permission-manager.objectPermissionMap',
  default: null,
});

export const fieldPermissionMap = atom<Record<string, FieldPermissionDefinitionMap> | null>({
  key: 'permission-manager.fieldPermissionMap',
  default: null,
});

export const tabVisibilityPermissionMap = atom<Record<string, TabVisibilityPermissionDefinitionMap> | null>({
  key: 'permission-manager.tabVisibilityPermissionMap',
  default: null,
});

/**
 * Returns true if all selections have been made
 */
export const hasSelectionsMade = selector({
  key: 'permission-manager.hasSelectionsMade',
  get: ({ get }) => {
    if (!get(selectedSObjectsState)?.length) {
      return false;
    }
    if (!get(selectedProfilesPermSetState)?.length && !get(selectedPermissionSetsState)?.length) {
      return false;
    }
    return true;
  },
});

export const profilesByIdSelector = selector<Record<string, PermissionSetWithProfileRecord>>({
  key: 'permission-manager.profilesByIdSelector',
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

export const permissionSetsByIdSelector = selector<Record<string, PermissionSetNoProfileRecord>>({
  key: 'permission-manager.permissionSetsByIdSelector',
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

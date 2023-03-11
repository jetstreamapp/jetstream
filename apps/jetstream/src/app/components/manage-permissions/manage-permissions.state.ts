import {
  EntityParticlePermissionsRecord,
  ListItem,
  MapOf,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
} from '@jetstream/types';
import type { DescribeGlobalSObjectResult } from 'jsforce';
import { atom, selector } from 'recoil';
import { FieldPermissionDefinitionMap, ObjectPermissionDefinitionMap } from './utils/permission-manager-types';

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

export const fieldsByObject = atom<MapOf<string[]> | null>({
  key: 'permission-manager.fieldsByObject',
  default: null,
});

// KEY = {SObject.FieldName}, ex: `${record.EntityDefinition.QualifiedApiName}.${record.QualifiedApiName}`
export const fieldsByKey = atom<MapOf<EntityParticlePermissionsRecord> | null>({
  key: 'permission-manager.fieldsByKey',
  default: null,
});

// // key = either Sobject name or field name with object prefix
// export const permissionsByObjectAndField = atom<MapOf<string[]>>({
//   key: 'permission-manager.permissionsByObjectAndField',
//   default: null,
// });

// //KEY = {Id-SObjectName} ex: `${record.ParentId}-${record.Field}`
// export const objectPermissionsByKey = atom<MapOf<ObjectPermissionRecord>>({
//   key: 'permission-manager.objectPermissionsByKey',
//   default: null,
// });

// //KEY = {Id-FieldName} ex: `${record.ParentId}-${record.Field}`
// export const fieldPermissionsByKey = atom<MapOf<FieldPermissionRecord>>({
//   key: 'permission-manager.fieldPermissionsByKey',
//   default: null,
// });

export const objectPermissionMap = atom<MapOf<ObjectPermissionDefinitionMap> | null>({
  key: 'permission-manager.objectPermissionMap',
  default: null,
});

export const fieldPermissionMap = atom<MapOf<FieldPermissionDefinitionMap> | null>({
  key: 'permission-manager.fieldPermissionMap',
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

export const profilesByIdSelector = selector<MapOf<PermissionSetWithProfileRecord>>({
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

export const permissionSetsByIdSelector = selector<MapOf<PermissionSetNoProfileRecord>>({
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

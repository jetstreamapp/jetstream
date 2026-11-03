import {
  DescribeGlobalSObjectResult,
  EntityParticlePermissionsRecord,
  FieldPermissionDefinitionMap,
  ListItem,
  ObjectPermissionDefinitionMap,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
  SetupEntityAccessDefinitionMap,
  SetupEntityAccessType,
  SystemPermissionDefinitionMap,
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

/**
 * Managed-package and Salesforce standard permission sets (read-only). Kept apart from `permissionSetsState`
 * because that atom seeds the editable list on remount - mixing the two would make managed sets look editable.
 */
export const managedPermissionSetsState = atomWithReset<ListItem<string, PermissionSetNoProfileRecord>[] | null>(null);

export const selectedPermissionSetsState = atomWithReset<string[]>([]);

export const fieldsByObject = atomWithReset<Record<string, string[]> | null>(null);

// KEY = {SObject.FieldName}, ex: `${record.EntityDefinition.QualifiedApiName}.${record.QualifiedApiName}`
export const fieldsByKey = atomWithReset<Record<string, EntityParticlePermissionsRecord> | null>(null);

export const objectPermissionMap = atomWithReset<Record<string, ObjectPermissionDefinitionMap> | null>(null);

export const fieldPermissionMap = atomWithReset<Record<string, FieldPermissionDefinitionMap> | null>(null);

export const tabVisibilityPermissionMap = atomWithReset<Record<string, TabVisibilityPermissionDefinitionMap> | null>(null);

// KEY = `Permissions*` field API name on the PermissionSet object, ex: `PermissionsApiEnabled`
export const systemPermissionMap = atomWithReset<Record<string, SystemPermissionDefinitionMap> | null>(null);

/**
 * One map per setup entity type (custom permissions, ...), each keyed by the setup entity id.
 * `null` until loaded; a type whose load failed is present with an empty map.
 */
export const setupEntityAccessPermissionMap = atomWithReset<Record<
  SetupEntityAccessType,
  Record<string, SetupEntityAccessDefinitionMap>
> | null>(null);

/**
 * Returns true if enough has been selected to open the editor: at least one profile or permission set.
 * Objects are optional - without them the object, field and tab visibility tabs are empty, but system permissions
 * and custom permissions do not depend on objects and can still be managed.
 */
export const hasSelectionsMade = atom((get) => {
  if (!get(selectedProfilesPermSetState)?.length && !get(selectedPermissionSetsState)?.length) {
    return false;
  }
  return true;
});

/**
 * The lists are cleared while a refresh is in flight (or after it fails). The editor learns which permission sets are
 * read-only from the managed list, so it must not open without them - managed permission sets would become editable.
 */
export const permissionListsLoaded = atom((get) => {
  return !!get(profilesState) && !!get(permissionSetsState) && !!get(managedPermissionSetsState);
});

export const profilesByIdSelector = atom<Record<string, PermissionSetWithProfileRecord>>((get) => {
  const profiles = get(profilesState);
  if (profiles) {
    return profiles.reduce<Record<string, PermissionSetWithProfileRecord>>((output, profile) => {
      output[profile.id] = profile.meta as PermissionSetWithProfileRecord;
      return output;
    }, {});
  }
  return {};
});

// Includes managed permission sets - the editor needs their records to render the read-only columns.
export const permissionSetsByIdSelector = atom<Record<string, PermissionSetNoProfileRecord>>((get) => {
  const permSets = (get(permissionSetsState) || []).concat(get(managedPermissionSetsState) || []);
  return permSets.reduce<Record<string, PermissionSetNoProfileRecord>>((output, permSet) => {
    output[permSet.id] = permSet.meta as PermissionSetNoProfileRecord;
    return output;
  }, {});
});

export const managedPermissionSetIdsSelector = atom<ReadonlySet<string>>((get) => {
  return new Set((get(managedPermissionSetsState) || []).map(({ id }) => id));
});

import { FieldValues, READ_ONLY_FIELD_TYPES, SalesforceFieldType } from '@jetstream/ui-core';
import isString from 'lodash/isString';
import { useCallback, useMemo, useState } from 'react';

interface UseFieldPermissionsProps {
  fields: FieldValues[];
  sobjects: string[];
  profiles: string[];
  permissionSets: string[];
}

/**
 * * One set of permissions for everything
 * * Apply different permissions per field
 * * If 2+ objects are selected - option to apply different permissions to each object
 * * Ability to apply different permissions for each profile/permission set
 */

type Granularity = 'ALL' | 'GRANULAR';
type GranularityType = 'object' | 'field' | 'profilePermSet';
type GranularityScope = Record<GranularityType, Granularity>;

interface PermissionConfiguration {
  edit: boolean;
  read: boolean;
  isRequiredOrMasterDetail: boolean;
  isReadOnly: boolean;
}

// {
//   AdminProfile: {
//     AccountObj: {
//       TestField: {
//         PermissionsEdit: true,
//         PermissionsRead: true,
//         isRequiredOrMasterDetail: false,
//         isReadOnly: false,
//       }
//     },
//   },
// }
type ProfileOrPermSetId = string;
type SObjectName = string;
type fieldFullName = string;
type PermissionConfigurationMap = Record<ProfileOrPermSetId, Record<SObjectName, Record<fieldFullName, PermissionConfiguration>>>;

export function useFieldPermissions({ sobjects, fields, profiles, permissionSets }: UseFieldPermissionsProps) {
  const allowGranularField = fields.length > 1;
  const allowGranularObject = sobjects.length > 1;
  const allowGranularProfilePermSet = profiles.length + permissionSets.length > 1;

  const [scopes, setScopes] = useState<GranularityScope>({
    object: 'ALL',
    field: 'ALL',
    profilePermSet: 'ALL',
  });

  const [permissionsMap, setPermissionsMap] = useState<PermissionConfigurationMap>(() => {
    const fieldPermissionsMap = fields.reduce((acc: Record<string, PermissionConfiguration>, field) => {
      if (isString(field.fullName.value) && isString(field.type.value)) {
        const isReadOnly = READ_ONLY_FIELD_TYPES.has(field.type.value as SalesforceFieldType);
        acc[field.fullName.value] = {
          read: true,
          edit: !isReadOnly,
          isRequiredOrMasterDetail: !!field.required.value || field.type.value === 'MasterDetail',
          isReadOnly,
        };
      }
      return acc;
    }, {});

    const objectPermissionsMap = sobjects.reduce((acc: Record<string, Record<string, PermissionConfiguration>>, sobject) => {
      acc[sobject] = { ...fieldPermissionsMap };
      return acc;
    }, {});

    return [...profiles, ...permissionSets].reduce(
      (acc: Record<string, Record<string, Record<string, PermissionConfiguration>>>, profileOrPermSet) => {
        acc[profileOrPermSet] = { ...objectPermissionsMap };
        return acc;
      },
      {}
    );
  });

  const permissions = useMemo(() => {
    const { object, field, profilePermSet } = scopes;

    if (object === 'ALL' && field === 'ALL' && profilePermSet === 'ALL') {
      // Object.values(Object.values(Object.values(permissionsMap))).forEach((objectPermissions) => {});
      const permissions = Object.values(permissionsMap).flatMap(Object.values).flatMap(Object.values);
      return permissions[0];
    }
    if (object === 'ALL' && field === 'ALL' && profilePermSet === 'ALL') {
      // Object.values(Object.values(Object.values(permissionsMap))).forEach((objectPermissions) => {});
      const permissions = Object.values(permissionsMap).flatMap(Object.values).flatMap(Object.values);
      return permissions;
    }

    //
  }, []);

  const handleObjectScopeChange = useCallback((type: GranularityType, granularity: Granularity) => {
    setScopes((prev) => ({
      ...prev,
      [type]: granularity,
    }));
  }, []);

  return {
    allowGranularField,
    allowGranularObject,
    allowGranularProfilePermSet,
    scopes,
    handleObjectScopeChange,
  };
}

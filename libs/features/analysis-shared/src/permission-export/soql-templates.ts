import { HIGH_RISK_SYSTEM_PERMISSIONS } from '@jetstream/shared/constants';
import { composeQuery, getField, WhereClause } from '@jetstreamapp/soql-parser-js';

function whereSobjectTypeIn(objectTypes?: string[]): WhereClause | undefined {
  if (!objectTypes || objectTypes.length === 0) {
    return undefined;
  }
  return {
    left: {
      field: 'SobjectType',
      operator: 'IN',
      value: objectTypes,
      literalType: 'STRING',
    },
  };
}

/**
 * @param systemPermissionFields `PermissionSet.Permissions*` columns to SELECT. Defaults to the full
 *   {@link HIGH_RISK_SYSTEM_PERMISSIONS} catalog; callers should pass the subset that actually exists in
 *   the target org (many `Permissions*` columns are edition/license/feature dependent and selecting a
 *   missing one fails the whole query with INVALID_FIELD).
 */
export function buildPermissionSetByIdSoql(ids: string[], systemPermissionFields?: readonly string[]): string {
  const permissionFields = systemPermissionFields ?? HIGH_RISK_SYSTEM_PERMISSIONS.map((perm) => perm.field);
  return composeQuery({
    fields: [
      getField('Id'),
      getField('Name'),
      getField('Label'),
      getField('Description'),
      getField('IsOwnedByProfile'),
      getField('ProfileId'),
      getField('Profile.Name'),
      getField('CreatedDate'),
      getField('LastModifiedDate'),
      getField('CreatedBy.Name'),
      getField('LastModifiedBy.Name'),
      // High-risk system permissions, surfaced as findings (Modify All Data, View All Data, etc.).
      ...permissionFields.map((field) => getField(field)),
    ],
    sObject: 'PermissionSet',
    where: {
      left: {
        field: 'Id',
        operator: 'IN',
        value: ids,
        literalType: 'STRING',
      },
    },
  });
}

export function buildObjectPermissionsByParentSoql(parentIds: string[], objectTypes?: string[]): string {
  const objectTypeWhere = whereSobjectTypeIn(objectTypes);
  return composeQuery({
    fields: [
      getField('Id'),
      getField('ParentId'),
      getField('SobjectType'),
      getField('PermissionsRead'),
      getField('PermissionsCreate'),
      getField('PermissionsEdit'),
      getField('PermissionsDelete'),
      getField('PermissionsViewAllRecords'),
      getField('PermissionsModifyAllRecords'),
      getField('PermissionsViewAllFields'),
    ],
    sObject: 'ObjectPermissions',
    where: {
      left: {
        field: 'ParentId',
        operator: 'IN',
        value: parentIds,
        literalType: 'STRING',
      },
      ...(objectTypeWhere
        ? {
            operator: 'AND',
            right: objectTypeWhere,
          }
        : {}),
    },
  });
}

export function buildFieldPermissionsByParentSoql(parentIds: string[], objectTypes?: string[]): string {
  const objectTypeWhere = whereSobjectTypeIn(objectTypes);
  return composeQuery({
    fields: [
      getField('Id'),
      getField('ParentId'),
      getField('SobjectType'),
      getField('Field'),
      getField('PermissionsRead'),
      getField('PermissionsEdit'),
    ],
    sObject: 'FieldPermissions',
    where: {
      left: {
        field: 'ParentId',
        operator: 'IN',
        value: parentIds,
        literalType: 'STRING',
      },
      ...(objectTypeWhere
        ? {
            operator: 'AND',
            right: objectTypeWhere,
          }
        : {}),
    },
  });
}

export function buildTabSettingsByParentSoql(parentIds: string[]): string {
  return composeQuery({
    fields: [getField('Id'), getField('ParentId'), getField('Name'), getField('Visibility')],
    sObject: 'PermissionSetTabSetting',
    where: {
      left: {
        field: 'ParentId',
        operator: 'IN',
        value: parentIds,
        literalType: 'STRING',
      },
    },
  });
}

export function buildPermissionSetAssignmentsByPermissionSetSoql(permissionSetIds: string[]): string {
  return composeQuery({
    fields: [getField('Id'), getField('PermissionSetId'), getField('AssigneeId')],
    sObject: 'PermissionSetAssignment',
    where: {
      left: {
        field: 'PermissionSetId',
        operator: 'IN',
        value: permissionSetIds,
        literalType: 'STRING',
      },
    },
  });
}

export function buildPermissionSetGroupComponentsByPermissionSetSoql(permissionSetIds: string[]): string {
  return composeQuery({
    fields: [getField('Id'), getField('PermissionSetGroupId'), getField('PermissionSetId')],
    sObject: 'PermissionSetGroupComponent',
    where: {
      left: {
        field: 'PermissionSetId',
        operator: 'IN',
        value: permissionSetIds,
        literalType: 'STRING',
      },
    },
  });
}

export function buildPermissionSetGroupByIdSoql(groupIds: string[]): string {
  return composeQuery({
    fields: [getField('Id'), getField('DeveloperName'), getField('MasterLabel')],
    sObject: 'PermissionSetGroup',
    where: {
      left: {
        field: 'Id',
        operator: 'IN',
        value: groupIds,
        literalType: 'STRING',
      },
    },
  });
}

export function buildMutingPermissionSetsByGroupSoql(groupIds: string[]): string {
  return composeQuery({
    fields: [getField('Id'), getField('PermissionSetGroupId'), getField('DeveloperName'), getField('MasterLabel')],
    sObject: 'MutingPermissionSet',
    where: {
      left: {
        field: 'PermissionSetGroupId',
        operator: 'IN',
        value: groupIds,
        literalType: 'STRING',
      },
    },
  });
}

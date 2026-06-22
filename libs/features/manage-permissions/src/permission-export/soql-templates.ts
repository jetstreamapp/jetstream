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

export function buildPermissionSetByIdSoql(ids: string[]): string {
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

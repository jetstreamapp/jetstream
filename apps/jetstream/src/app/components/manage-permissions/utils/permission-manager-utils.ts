import { DescribeGlobalSObjectResult } from 'jsforce';
import { composeQuery, getField, Query, WhereClause } from 'soql-parser-js';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import { logger } from '@jetstream/shared/client-logger';
import {
  EntityParticlePermissionsRecord,
  FieldPermissionRecord,
  MapOf,
  ObjectPermissionRecord,
  RecordResult,
  SalesforceOrgUi,
} from '@jetstream/types';
import { PermissionTableFieldCell, PermissionTableFieldCellPermission } from './permission-manager-table-utils';
import { FieldPermissionRecordForSave, PermissionSaveResults } from './permission-manager-types';
import { sobjectOperation } from '@jetstream/shared/data';
import { isErrorResponse } from '@jetstream/shared/ui-utils';
import { ColDef, ColGroupDef } from '@ag-grid-community/core';

const MAX_OBJ_IN_QUERY = 100;

export interface ObjectPermissionDefinitionMap {
  apiName: string;
  label: string; // TODO: ;(
  metadata: string; // FIXME: this should probably be Describe metadata
  // used to retain order of permissions
  permissionKeys: string[]; // this is permission set ids, which could apply to profile or perm set
  permissions: MapOf<ObjectPermissionItem>;
}

export interface ObjectPermissionItem {
  create: boolean;
  read: boolean;
  edit: boolean;
  delete: boolean;
  viewAllRecords: boolean;
  modifyAllRecords: boolean;
  record?: ObjectPermissionRecord;
}

export interface FieldPermissionDefinitionMap {
  apiName: string;
  label: string;
  metadata: EntityParticlePermissionsRecord;
  // used to retain order of permissions
  permissionKeys: string[]; // this is permission set ids, which could apply to profile or perm set
  permissions: MapOf<FieldPermissionItem>;
}

export interface FieldPermissionItem {
  read: boolean;
  edit: boolean;
  record?: FieldPermissionRecord;
  errorMessage?: string;
}

export function filterPermissionsSobjects(sobject: DescribeGlobalSObjectResult) {
  return (
    sobject.createable &&
    sobject.updateable &&
    !sobject.name.endsWith('__History') &&
    !sobject.name.endsWith('__Tag') &&
    !sobject.name.endsWith('__Share')
  );
}

export function getFieldDefinitionKey(record: EntityParticlePermissionsRecord) {
  return `${record.EntityDefinition.QualifiedApiName}.${record.QualifiedApiName}`;
}

export function getObjectPermissionKey(record: ObjectPermissionRecord) {
  return `${record.ParentId}-${record.SobjectType}`;
}

export function getFieldPermissionKey(record: FieldPermissionRecord) {
  return `${record.ParentId}-${record.Field}`;
}

export function preparePermissionSaveData(
  dirtyPermissions: PermissionTableFieldCellPermission[]
): {
  permissionSaveResults: PermissionSaveResults[];
  recordsToInsert: FieldPermissionRecordForSave[];
  recordsToUpdate: FieldPermissionRecordForSave[];
} {
  return dirtyPermissions.reduce(
    (
      output: {
        // used to easily keep track of the input data with the actual results
        permissionSaveResults: PermissionSaveResults[];
        recordsToInsert: FieldPermissionRecordForSave[];
        recordsToUpdate: FieldPermissionRecordForSave[];
      },
      perm,
      i
    ) => {
      const newRecord: FieldPermissionRecordForSave = {
        attributes: { type: 'FieldPermissions' },
        SobjectType: perm.sobject,
        Field: `${perm.sobject}.${perm.field}`,
        PermissionsRead: perm.read,
        PermissionsEdit: perm.edit,
        ParentId: perm.parentId,
      };
      let recordIdx: number;
      if (perm.record.record) {
        newRecord.Id = perm.record.record.Id;
        output.recordsToUpdate.push(newRecord);
        recordIdx = output.recordsToUpdate.length - 1;
      } else {
        output.recordsToInsert.push(newRecord);
        recordIdx = output.recordsToInsert.length - 1;
      }

      output.permissionSaveResults.push({
        dirtyPermission: perm,
        dirtyPermissionIdx: i,
        operation: newRecord.Id ? 'update' : 'insert',
        record: newRecord,
        recordIdx,
      });

      return output;
    },
    { permissionSaveResults: [], recordsToInsert: [], recordsToUpdate: [] }
  );
}

export async function savePermissionRecords(
  org: SalesforceOrgUi,
  preparedData: {
    permissionSaveResults: PermissionSaveResults[];
    recordsToInsert: FieldPermissionRecordForSave[];
    recordsToUpdate: FieldPermissionRecordForSave[];
  }
): Promise<PermissionSaveResults[]> {
  const { permissionSaveResults, recordsToInsert, recordsToUpdate } = preparedData;
  let recordInsertResults: RecordResult[] = [];
  let recordUpdateResults: RecordResult[] = [];
  if (recordsToInsert.length) {
    recordInsertResults = (
      await Promise.all(
        splitArrayToMaxSize(recordsToInsert, 200).map((records) =>
          sobjectOperation(org, 'FieldPermissions', 'create', { records }, { allOrNone: false })
        )
      )
    ).flat();
  }
  if (recordsToUpdate.length) {
    recordUpdateResults = (
      await Promise.all(
        splitArrayToMaxSize(recordsToUpdate, 200).map((records) =>
          sobjectOperation(org, 'FieldPermissions', 'update', { records }, { allOrNone: false })
        )
      )
    ).flat();
  }

  permissionSaveResults.forEach((saveResults) => {
    if (saveResults.operation === 'insert') {
      saveResults.response = recordInsertResults[saveResults.recordIdx];
    } else {
      saveResults.response = recordUpdateResults[saveResults.recordIdx];
    }
  });

  return permissionSaveResults;
}

export function getUpdatedFieldPermissions(
  fieldPermissionMap: MapOf<FieldPermissionDefinitionMap>,
  permissionSaveResults: PermissionSaveResults[]
) {
  const output: MapOf<FieldPermissionDefinitionMap> = { ...fieldPermissionMap };
  permissionSaveResults.forEach(({ dirtyPermission, operation, response }) => {
    const fieldKey = `${dirtyPermission.sobject}.${dirtyPermission.field}`;
    if (!isErrorResponse(response)) {
      const fieldPermission: Partial<FieldPermissionRecord> = {
        Id: response.id,
        Field: fieldKey,
        ParentId: dirtyPermission.parentId,
        PermissionsRead: dirtyPermission.read,
        PermissionsEdit: dirtyPermission.edit,
        SobjectType: dirtyPermission.sobject,
        // missing Parent related lookup, as we do not have data for it
      };
      if (operation === 'insert') {
        output[fieldKey] = {
          ...output[fieldKey],
          permissions: {
            ...output[fieldKey].permissions,
            [dirtyPermission.parentId]: {
              read: dirtyPermission.read,
              edit: dirtyPermission.edit,
              record: fieldPermission as FieldPermissionRecord,
            },
          },
        };
      } else {
        const isDelete = !dirtyPermission.read && !dirtyPermission.edit;
        output[fieldKey] = {
          ...output[fieldKey],
          permissions: {
            ...output[fieldKey].permissions,
            [dirtyPermission.parentId]: {
              read: dirtyPermission.read,
              edit: dirtyPermission.edit,
              record: isDelete ? null : (fieldPermission as FieldPermissionRecord),
            },
          },
        };
      }
    } else {
      // ERROR - TODO:
      logger.warn('[SAVE ERROR]', { dirtyPermission, response });
      output[fieldKey] = {
        ...output[fieldKey],
        permissions: {
          ...output[fieldKey].permissions,
          [dirtyPermission.parentId]: {
            ...output[fieldKey].permissions[dirtyPermission.parentId],
            errorMessage: response.errors
              .map((err) =>
                // (field not detectable in advance): Field Name: bad value for restricted picklist field: X.X
                err.statusCode === 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST'
                  ? 'Salesforce does not allow modification of permissions for this field.'
                  : err.message
              )
              .join('\n'),
          },
        },
      };
    }
  });
  return output;
}

export function getQueryForPermissionSetsWithProfiles(includeManaged = false): string {
  const query: Query = {
    fields: [
      getField('Id'),
      getField('Name'),
      getField('Label'),
      getField('Type'), // this field does not support filtering by
      getField('IsCustom'),
      getField('IsOwnedByProfile'),
      getField('NamespacePrefix'),
      getField('ProfileId'),
      getField('Profile.Id'),
      getField('Profile.Name'),
      getField('Profile.UserType'),
    ],
    sObject: 'PermissionSet',
    orderBy: [
      {
        field: 'IsOwnedByProfile',
        order: 'DESC',
      },
      {
        field: 'Profile.Name',
        order: 'ASC',
      },
      {
        field: 'Name',
        order: 'ASC',
      },
    ],
  };
  // TODO: we should omit profiles that do not allow editing (not sure how to identify)
  // maybe user access query?
  if (!includeManaged) {
    query.where = {
      left: {
        field: 'NamespacePrefix',
        operator: '=',
        value: 'null',
        literalType: 'NULL',
      },
    };
  }
  const soql = composeQuery(query);
  logger.log('getQueryForPermissionSetsWithProfiles()', soql);
  return soql;
}

/**
 * Gets query for all permissionable fields
 * EntityParticle
 * @param allSobjects
 * @returns query for all permissionable fields
 */
export function getQueryForAllPermissionableFields(allSobjects: string[]): string[] {
  const queries = splitArrayToMaxSize(allSobjects, MAX_OBJ_IN_QUERY).map((sobjects) => {
    return composeQuery({
      fields: [
        getField('QualifiedApiName'),
        getField('Label'),
        getField('DataType'),
        getField('DurableId'),
        getField('EntityDefinition.QualifiedApiName'),
        getField('FieldDefinitionId'),
        getField('NamespacePrefix'),
        getField('IsCompound'),
        getField('isCreatable'),
        getField('IsPermissionable'),
      ],
      sObject: 'EntityParticle',
      where: {
        left: {
          field: 'EntityDefinition.QualifiedApiName',
          operator: 'IN',
          value: sobjects,
          literalType: 'STRING',
        },
        operator: 'AND',
        right: {
          left: {
            field: 'IsPermissionable',
            operator: '=',
            value: 'TRUE',
            literalType: 'BOOLEAN',
          },
          operator: 'AND',
          right: {
            left: {
              field: 'IsComponent',
              operator: '=',
              value: 'FALSE',
              literalType: 'BOOLEAN',
            },
          },
        },
      },
      orderBy: [
        {
          // EntityDefinition.QualifiedApiName is not supported in order by
          field: 'EntityDefinitionId',
          order: 'ASC',
        },
        {
          field: 'QualifiedApiName',
          order: 'ASC',
        },
      ],
    });
  });
  logger.log('getFieldPermissionQueries()', queries);
  return queries;
}

/**
 * Gets query object permissions
 * @param allSobjects
 * @param permSetIds
 * @param profilePermSetIds
 * @returns query object permissions
 */
export function getQueryObjectPermissions(allSobjects: string[], permSetIds: string[], profilePermSetIds: string[]): string[] {
  const queries = splitArrayToMaxSize(allSobjects, MAX_OBJ_IN_QUERY).map((sobjects) => {
    const query: Query = {
      fields: [
        getField('Id'),
        getField('SobjectType'),
        getField('PermissionsRead'),
        getField('PermissionsCreate'),
        getField('PermissionsEdit'),
        getField('PermissionsDelete'),
        getField('PermissionsModifyAllRecords'),
        getField('PermissionsViewAllRecords'),
        getField('ParentId'),
        getField('Parent.Id'),
        getField('Parent.Name'),
        getField('Parent.IsOwnedByProfile'),
        getField('Parent.ProfileId'),
      ],
      sObject: 'ObjectPermissions',
      where: getWhereClauseForPermissionQuery(sobjects, permSetIds, profilePermSetIds),
      orderBy: {
        field: 'SobjectType',
        order: 'ASC',
      },
    };

    return composeQuery(query);
  });
  logger.log('getQueryObjectPermissions()', queries);
  return queries;
}

/**
 * Gets query for field permissions
 * @param allSobjects
 * @param permSetIds
 * @param profilePermSetIds
 * @returns query for field permissions
 */
export function getQueryForFieldPermissions(allSobjects: string[], profilePermSetIds: string[], permSetIds: string[]): string[] {
  const queries = splitArrayToMaxSize(allSobjects, MAX_OBJ_IN_QUERY).map((sobjects) => {
    const query: Query = {
      fields: [
        getField('Id'),
        getField('SobjectType'),
        getField('Field'),
        getField('PermissionsRead'),
        getField('PermissionsEdit'),
        getField('ParentId'),
        getField('Parent.Id'),
        getField('Parent.Name'),
        getField('Parent.IsOwnedByProfile'),
        getField('Parent.ProfileId'),
      ],
      sObject: 'FieldPermissions',
      where: getWhereClauseForPermissionQuery(sobjects, profilePermSetIds, permSetIds),
      orderBy: {
        field: 'SobjectType',
        order: 'ASC',
      },
    };

    return composeQuery(query);
  });
  logger.log('getQueryForFieldPermissions()', queries);
  return queries;
}

/**
 * Build WHERE clause for object/field permissions
 * Assumptions:
 * 1. sobjects will always have at least one entry
 * 2. Either one or both of permSetIds or profileIds will have at least one entry
 * 3. an array will always be provided for all three parameters, null/undefined checks are not made
 * @param sobjects
 * @param permSetIds
 * @param profilePermSetIds
 */
function getWhereClauseForPermissionQuery(sobjects: string[], profilePermSetIds: string[], permSetIds: string[]): WhereClause {
  if (!sobjects.length || (!permSetIds.length && !profilePermSetIds.length)) {
    return undefined;
  }
  return {
    left: {
      field: 'SobjectType',
      operator: 'IN',
      value: sobjects,
      literalType: 'STRING',
    },
    operator: 'AND',
    right: {
      left: {
        field: 'ParentId',
        operator: 'IN',
        value: [].concat(permSetIds).concat(profilePermSetIds),
        literalType: 'STRING',
      },
    },
  };
}

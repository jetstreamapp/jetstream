import { logger } from '@jetstream/shared/client-logger';
import { sobjectOperation } from '@jetstream/shared/data';
import { isErrorResponse } from '@jetstream/shared/ui-utils';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  DescribeGlobalSObjectResult,
  EntityParticlePermissionsRecord,
  FieldPermissionDefinitionMap,
  FieldPermissionRecord,
  FieldPermissionRecordForSave,
  ObjectPermissionDefinitionMap,
  ObjectPermissionRecord,
  ObjectPermissionRecordForSave,
  PermissionDefinitionMap,
  PermissionFieldSaveData,
  PermissionObjectSaveData,
  PermissionSaveResults,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
  PermissionTabVisibilitySaveData,
  PermissionTableCellPermission,
  PermissionTableFieldCellPermission,
  PermissionTableObjectCellPermission,
  PermissionTableTabVisibilityCellPermission,
  RecordResult,
  SalesforceOrgUi,
  TabVisibilityPermissionDefinitionMap,
  TabVisibilityPermissionRecord,
  TabVisibilityPermissionRecordForSave,
} from '@jetstream/types';
import { Query, WhereClause, composeQuery, getField } from '@jetstreamapp/soql-parser-js';

const MAX_OBJ_IN_QUERY = 100;

export function filterPermissionsSobjects(sobject: DescribeGlobalSObjectResult | null) {
  return (
    !!sobject &&
    (sobject.name.endsWith('__e') ||
      (sobject.createable &&
        sobject.updateable &&
        !sobject.name.endsWith('__History') &&
        !sobject.name.endsWith('__Tag') &&
        !sobject.name.endsWith('__Share')))
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

export function prepareObjectPermissionSaveData(dirtyPermissions: PermissionTableObjectCellPermission[]): PermissionObjectSaveData {
  return dirtyPermissions.reduce(
    (
      output: {
        // used to easily keep track of the input data with the actual results
        permissionSaveResults: PermissionSaveResults<ObjectPermissionRecordForSave, PermissionTableObjectCellPermission>[];
        recordsToInsert: ObjectPermissionRecordForSave[];
        recordsToUpdate: ObjectPermissionRecordForSave[];
        recordsToDelete: string[];
      },
      perm,
      i
    ) => {
      const newRecord: ObjectPermissionRecordForSave = {
        attributes: { type: 'ObjectPermissions' },
        SobjectType: perm.sobject,
        PermissionsCreate: perm.create,
        PermissionsRead: perm.read,
        PermissionsEdit: perm.edit,
        PermissionsDelete: perm.delete,
        PermissionsViewAllRecords: perm.viewAll,
        PermissionsModifyAllRecords: perm.modifyAll,
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
    { permissionSaveResults: [], recordsToInsert: [], recordsToUpdate: [], recordsToDelete: [] }
  );
}

export function prepareFieldPermissionSaveData(dirtyPermissions: PermissionTableFieldCellPermission[]): PermissionFieldSaveData {
  return dirtyPermissions.reduce(
    (
      output: {
        // used to easily keep track of the input data with the actual results
        permissionSaveResults: PermissionSaveResults<FieldPermissionRecordForSave, PermissionTableFieldCellPermission>[];
        recordsToInsert: FieldPermissionRecordForSave[];
        recordsToUpdate: FieldPermissionRecordForSave[];
        recordsToDelete: string[];
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
    { permissionSaveResults: [], recordsToInsert: [], recordsToUpdate: [], recordsToDelete: [] }
  );
}

export function prepareTabVisibilityPermissionSaveData(
  dirtyPermissions: PermissionTableTabVisibilityCellPermission[]
): PermissionTabVisibilitySaveData {
  return dirtyPermissions.reduce(
    (
      output: {
        // used to easily keep track of the input data with the actual results
        permissionSaveResults: PermissionSaveResults<TabVisibilityPermissionRecordForSave, PermissionTableTabVisibilityCellPermission>[];
        recordsToInsert: TabVisibilityPermissionRecordForSave[];
        recordsToUpdate: TabVisibilityPermissionRecordForSave[];
        recordsToDelete: string[];
      },
      perm,
      i
    ) => {
      let newRecord: TabVisibilityPermissionRecordForSave | undefined = undefined;
      let recordIdx: number;
      let operation: 'insert' | 'update' | 'delete' = 'insert';
      if (perm.record.record && !perm.available) {
        output.recordsToDelete.push(perm.record.record.Id);
        recordIdx = output.recordsToDelete.length - 1;
        operation = 'delete';
      } else if (perm.record.record) {
        newRecord = {
          attributes: { type: 'PermissionSetTabSetting' },
          Id: perm.record.record.Id,
          Visibility: perm.visible ? 'DefaultOn' : 'DefaultOff',
        };
        output.recordsToUpdate.push(newRecord);
        recordIdx = output.recordsToUpdate.length - 1;
        operation = 'update';
      } else {
        newRecord = {
          attributes: { type: 'PermissionSetTabSetting' },
          Name: perm.sobject.endsWith('__c') ? perm.sobject : `standard-${perm.sobject}`,
          Visibility: perm.visible ? 'DefaultOn' : 'DefaultOff',
          ParentId: perm.parentId,
        };
        output.recordsToInsert.push(newRecord);
        recordIdx = output.recordsToInsert.length - 1;
      }

      output.permissionSaveResults.push({
        dirtyPermission: perm,
        dirtyPermissionIdx: i,
        operation,
        record: newRecord,
        recordIdx,
      });

      return output;
    },
    { permissionSaveResults: [], recordsToInsert: [], recordsToUpdate: [], recordsToDelete: [] }
  );
}

export async function savePermissionRecords<RecordType, DirtyPermType>(
  org: SalesforceOrgUi,
  type: 'ObjectPermissions' | 'FieldPermissions' | 'PermissionSetTabSetting',
  preparedData: {
    permissionSaveResults: PermissionSaveResults<RecordType, DirtyPermType>[];
    recordsToInsert: RecordType[];
    recordsToUpdate: RecordType[];
    recordsToDelete: string[];
  }
): Promise<PermissionSaveResults<RecordType, DirtyPermType>[]> {
  const { permissionSaveResults, recordsToInsert, recordsToUpdate, recordsToDelete } = preparedData;
  let recordInsertResults: RecordResult[] = [];
  let recordUpdateResults: RecordResult[] = [];
  let recordDeleteResults: RecordResult[] = [];
  if (recordsToInsert.length) {
    recordInsertResults = (
      await Promise.all(
        splitArrayToMaxSize(recordsToInsert, 200).map((records) => sobjectOperation(org, type, 'create', { records }, { allOrNone: false }))
      )
    ).flat();
  }
  if (recordsToUpdate.length) {
    recordUpdateResults = (
      await Promise.all(
        splitArrayToMaxSize(recordsToUpdate, 200).map((records) => sobjectOperation(org, type, 'update', { records }, { allOrNone: false }))
      )
    ).flat();
  }
  if (recordsToDelete.length) {
    recordDeleteResults = (
      await Promise.all(
        splitArrayToMaxSize(recordsToDelete, 200).map((ids) => sobjectOperation(org, type, 'delete', { ids }, { allOrNone: false }))
      )
    ).flat();
  }

  permissionSaveResults.forEach((saveResults) => {
    if (saveResults.operation === 'insert') {
      saveResults.response = recordInsertResults[saveResults.recordIdx];
    } else if (saveResults.operation === 'update') {
      saveResults.response = recordUpdateResults[saveResults.recordIdx];
    } else if (saveResults.operation === 'delete') {
      saveResults.response = recordDeleteResults[saveResults.recordIdx];
    }
  });

  return permissionSaveResults;
}

/**
 * Update profile and permission set records - this just marks the record as updated without changing anything
 * used to ensure sfdx knows that a change was made to the record
 *
 * @param org
 * @param recordIds
 */
export async function updatePermissionSetRecords(
  org: SalesforceOrgUi,
  { profileIds, permissionSetIds }: { profileIds: string[]; permissionSetIds: string[] }
) {
  await Promise.all([
    ...splitArrayToMaxSize(
      profileIds.map((id) => ({
        attributes: { type: 'Profile' },
        Id: id,
      })),
      200
    ).map((records) => {
      if (records.length === 0) {
        return Promise.resolve();
      }
      return sobjectOperation(org, 'Profile', 'update', { records }, { allOrNone: false });
    }),
    ...splitArrayToMaxSize(
      permissionSetIds.map((id) => ({
        attributes: { type: 'PermissionSet' },
        Id: id,
      })),
      200
    ).map((records) => {
      if (records.length === 0) {
        return Promise.resolve();
      }
      return sobjectOperation(org, 'PermissionSet', 'update', { records }, { allOrNone: false });
    }),
  ]);
}

export function collectProfileAndPermissionIds(
  dirtyPermissions: PermissionTableCellPermission[],
  profilesById: Record<string, PermissionSetWithProfileRecord>,
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>
) {
  const profileIds = new Set<string>();
  const permissionSetIds = new Set<string>();
  dirtyPermissions.forEach((item) => {
    if (profilesById[item.parentId]) {
      profileIds.add(profilesById[item.parentId].ProfileId);
    } else if (permissionSetsById[item.parentId]) {
      permissionSetIds.add(permissionSetsById[item.parentId].Id);
    }
  });
  return { profileIds, permissionSetIds };
}

/**
 * Refresh data after save based on results
 * Object Permissions
 */
export function getUpdatedObjectPermissions(
  objectPermissionMap: Record<string, ObjectPermissionDefinitionMap>,
  permissionSaveResults: PermissionSaveResults<ObjectPermissionRecordForSave, PermissionTableObjectCellPermission>[]
) {
  const output: Record<string, ObjectPermissionDefinitionMap> = { ...objectPermissionMap };
  // remove all error messages across all objects
  Object.keys(output).forEach((key) => {
    output[key] = { ...output[key] };
    output[key].permissionKeys.forEach((permKey) => {
      output[key].permissions = {
        ...output[key].permissions,
        [permKey]: {
          ...output[key].permissions[permKey],
          errorMessage: undefined,
        },
      };
    });
  });

  permissionSaveResults.forEach(({ dirtyPermission, operation, response }) => {
    const fieldKey = dirtyPermission.sobject;
    if (!isErrorResponse(response)) {
      const fieldPermission: Partial<ObjectPermissionRecord> = {
        Id: response?.id,
        ParentId: dirtyPermission.parentId,
        PermissionsCreate: dirtyPermission.create,
        PermissionsRead: dirtyPermission.read,
        PermissionsEdit: dirtyPermission.edit,
        PermissionsDelete: dirtyPermission.delete,
        PermissionsViewAllRecords: dirtyPermission.viewAllIsDirty,
        PermissionsModifyAllRecords: dirtyPermission.modifyAll,
        SobjectType: dirtyPermission.sobject,
        // missing Parent related lookup, as we do not have data for it
      };
      if (operation === 'insert') {
        output[fieldKey] = {
          ...output[fieldKey],
          permissions: {
            ...output[fieldKey].permissions,
            [dirtyPermission.parentId]: {
              create: dirtyPermission.create,
              read: dirtyPermission.read,
              edit: dirtyPermission.edit,
              delete: dirtyPermission.delete,
              viewAll: dirtyPermission.viewAll,
              modifyAll: dirtyPermission.modifyAll,
              record: fieldPermission as ObjectPermissionRecord,
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
              create: dirtyPermission.create,
              read: dirtyPermission.read,
              edit: dirtyPermission.edit,
              delete: dirtyPermission.delete,
              viewAll: dirtyPermission.viewAll,
              modifyAll: dirtyPermission.modifyAll,
              record: isDelete ? null : (fieldPermission as ObjectPermissionRecord),
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

/**
 * Refresh data after save based on results
 * Field Permissions
 */
export function getUpdatedFieldPermissions(
  fieldPermissionMap: Record<string, FieldPermissionDefinitionMap>,
  permissionSaveResults: PermissionSaveResults<FieldPermissionRecordForSave, PermissionTableFieldCellPermission>[]
) {
  const output: Record<string, FieldPermissionDefinitionMap> = { ...fieldPermissionMap };
  // remove all error messages across all objects
  Object.keys(output).forEach((key) => {
    output[key] = { ...output[key] };
    output[key].permissionKeys.forEach((permKey) => {
      output[key].permissions = {
        ...output[key].permissions,
        [permKey]: {
          ...output[key].permissions[permKey],
          errorMessage: undefined,
        },
      };
    });
  });

  permissionSaveResults.forEach(({ dirtyPermission, operation, response }) => {
    const fieldKey = `${dirtyPermission.sobject}.${dirtyPermission.field}`;
    if (!isErrorResponse(response)) {
      const fieldPermission: Partial<FieldPermissionRecord> = {
        Id: response?.id,
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

export function getUpdatedTabVisibilityPermissions(
  objectPermissionMap: Record<string, TabVisibilityPermissionDefinitionMap>,
  permissionSaveResults: PermissionSaveResults<TabVisibilityPermissionRecordForSave, PermissionTableTabVisibilityCellPermission>[]
) {
  const output: Record<string, TabVisibilityPermissionDefinitionMap> = { ...objectPermissionMap };
  // remove all error messages across all objects
  Object.keys(output).forEach((key) => {
    output[key] = { ...output[key] };
    output[key].permissionKeys.forEach((permKey) => {
      output[key].permissions = {
        ...output[key].permissions,
        [permKey]: {
          ...output[key].permissions[permKey],
          errorMessage: undefined,
        },
      };
    });
  });

  permissionSaveResults.forEach(({ dirtyPermission, operation, response }) => {
    const fieldKey = dirtyPermission.sobject;
    if (!isErrorResponse(response)) {
      const fieldPermission: Partial<TabVisibilityPermissionRecord> = {
        Id: response?.id,
        ParentId: dirtyPermission.parentId,
        Visibility: dirtyPermission.visible ? 'DefaultOn' : 'DefaultOff',
        Name: dirtyPermission.sobject,
        // missing Parent related lookup, as we do not have data for it
      };
      if (operation === 'insert') {
        output[fieldKey] = {
          ...output[fieldKey],
          permissions: {
            ...output[fieldKey].permissions,
            [dirtyPermission.parentId]: {
              ...output[fieldKey].permissions[dirtyPermission.parentId],
              available: dirtyPermission.available,
              visible: dirtyPermission.visible,
              record: fieldPermission as TabVisibilityPermissionRecord,
            },
          },
        };
      } else {
        const isDelete = !dirtyPermission.available;
        output[fieldKey] = {
          ...output[fieldKey],
          permissions: {
            ...output[fieldKey].permissions,
            [dirtyPermission.parentId]: {
              ...output[fieldKey].permissions[dirtyPermission.parentId],
              available: dirtyPermission.available,
              visible: dirtyPermission.visible,
              record: isDelete ? null : (fieldPermission as TabVisibilityPermissionRecord),
            },
          },
        };
      }
    } else {
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

export function clearPermissionErrorMessage<T extends PermissionDefinitionMap>(permissionMap: Record<string, T>): Record<string, T> {
  return Object.keys(permissionMap).reduce((output: Record<string, T>, key) => {
    output[key] = { ...permissionMap[key] };
    output[key].permissions = { ...output[key].permissions };
    output[key].permissionKeys.forEach((permissionKey) => {
      output[key].permissions[permissionKey] = { ...output[key].permissions[permissionKey], errorMessage: undefined };
    });
    return output;
  }, {});
}

export function permissionsHaveError<T extends PermissionDefinitionMap>(permissionMap: Record<string, T>): boolean {
  return Object.values(permissionMap).some((item) => Object.values(item.permissions).some((permission) => permission.errorMessage));
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
 * Gets query object permissions
 * @param allSobjects
 * @param permSetIds
 * @param profilePermSetIds
 * @returns query object permissions
 */
export function getQueryTabVisibilityPermissions(allSobjects: string[], permSetIds: string[], profilePermSetIds: string[]): string[] {
  const queries = splitArrayToMaxSize(allSobjects, MAX_OBJ_IN_QUERY).map((sobjects) => {
    const query: Query = {
      fields: [
        getField('Id'),
        getField('Name'),
        getField('Visibility'),
        getField('ParentId'),
        getField('Parent.Id'),
        getField('Parent.Name'),
        getField('Parent.IsOwnedByProfile'),
        getField('Parent.ProfileId'),
      ],
      sObject: 'PermissionSetTabSetting',
      where: getWhereClauseForPermissionQuery(
        sobjects.map((sobject) => (sobject.endsWith('__c') ? sobject : `standard-${sobject}`)),
        permSetIds,
        profilePermSetIds,
        'Name'
      ),
      orderBy: {
        field: 'Name',
        order: 'ASC',
      },
    };

    return composeQuery(query);
  });
  logger.log('getQueryTabVisibilityPermissions()', queries);
  return queries;
}

export function getQueryTabDefinition(allSobjects: string[]): string[] {
  const queries = splitArrayToMaxSize(allSobjects, MAX_OBJ_IN_QUERY).map((sobjects) => {
    const query: Query = {
      fields: [getField('Id'), getField('Name'), getField('Label'), getField('SobjectName')],
      sObject: 'TabDefinition',
      where: {
        left: {
          field: 'SobjectName',
          operator: 'IN',
          value: sobjects,
          literalType: 'STRING',
        },
      },
      orderBy: {
        field: 'SobjectName',
        order: 'ASC',
      },
    };

    return composeQuery(query);
  });
  logger.log('getQueryTabDefinition()', queries);
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
function getWhereClauseForPermissionQuery(
  sobjects: string[],
  profilePermSetIds: string[],
  permSetIds: string[],
  sobjectNameField: 'SobjectType' | 'Name' = 'SobjectType'
): WhereClause | undefined {
  if (!sobjects.length || (!permSetIds.length && !profilePermSetIds.length)) {
    return undefined;
  }
  return {
    left: {
      field: sobjectNameField,
      operator: 'IN',
      value: sobjects,
      literalType: 'STRING',
    },
    operator: 'AND',
    right: {
      left: {
        field: 'ParentId',
        operator: 'IN',
        value: [...permSetIds, ...profilePermSetIds],
        literalType: 'STRING',
      },
    },
  };
}

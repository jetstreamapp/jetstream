import { logger } from '@jetstream/shared/client-logger';
import { sobjectOperation, updatePermissionSetRecords } from '@jetstream/shared/data';
import { isErrorResponse } from '@jetstream/shared/ui-utils';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  DescribeGlobalSObjectResult,
  EntityParticlePermissionsRecord,
  Field,
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
  PermissionSystemSaveData,
  PermissionTabVisibilitySaveData,
  PermissionTableCellPermission,
  PermissionTableFieldCellPermission,
  PermissionTableObjectCellPermission,
  PermissionTableSystemPermissionCellPermission,
  PermissionTableTabVisibilityCellPermission,
  RecordResult,
  SalesforceOrgUi,
  SystemPermissionDefinitionMap,
  SystemPermissionRecordForSave,
  SystemPermissionSaveRecord,
  TabVisibilityPermissionDefinitionMap,
  TabVisibilityPermissionRecord,
  TabVisibilityPermissionRecordForSave,
} from '@jetstream/types';
import { Query, WhereClause, composeQuery, getField } from '@jetstreamapp/soql-parser-js';

const MAX_OBJ_IN_QUERY = 100;

/**
 * EntityParticle does not support queryMore, so we page it using OFFSET, which Salesforce caps at 2000 for this object.
 * Keep the objects really small to avoid hitting the 2000 limit
 */
const MAX_OBJ_IN_PERMISSIONABLE_FIELDS_QUERY = 2;

export function filterPermissionsSobjects(sobject: DescribeGlobalSObjectResult | null) {
  if (!sobject) {
    return false;
  }
  if (sobject.name.endsWith('History') || sobject.name.endsWith('Tag') || sobject.name.endsWith('Share')) {
    return false;
  }
  return sobject.createable || sobject.updateable || sobject.name.endsWith('__e');
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
      i,
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
        PermissionsViewAllFields: perm.viewAllFields,
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
    { permissionSaveResults: [], recordsToInsert: [], recordsToUpdate: [], recordsToDelete: [] },
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
      i,
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
    { permissionSaveResults: [], recordsToInsert: [], recordsToUpdate: [], recordsToDelete: [] },
  );
}

export function prepareTabVisibilityPermissionSaveData(
  dirtyPermissions: PermissionTableTabVisibilityCellPermission[],
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
      i,
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
    { permissionSaveResults: [], recordsToInsert: [], recordsToUpdate: [], recordsToDelete: [] },
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
  },
): Promise<PermissionSaveResults<RecordType, DirtyPermType>[]> {
  const { permissionSaveResults, recordsToInsert, recordsToUpdate, recordsToDelete } = preparedData;
  let recordInsertResults: RecordResult[] = [];
  let recordUpdateResults: RecordResult[] = [];
  let recordDeleteResults: RecordResult[] = [];
  if (recordsToInsert.length) {
    recordInsertResults = (
      await Promise.all(
        splitArrayToMaxSize(recordsToInsert, 200).map((records) =>
          sobjectOperation(org, type, 'create', { records }, { allOrNone: false }),
        ),
      )
    ).flat();
  }
  if (recordsToUpdate.length) {
    recordUpdateResults = (
      await Promise.all(
        splitArrayToMaxSize(recordsToUpdate, 200).map((records) =>
          sobjectOperation(org, type, 'update', { records }, { allOrNone: false }),
        ),
      )
    ).flat();
  }
  if (recordsToDelete.length) {
    recordDeleteResults = (
      await Promise.all(
        splitArrayToMaxSize(recordsToDelete, 200).map((ids) => sobjectOperation(org, type, 'delete', { ids }, { allOrNone: false })),
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
 * Group dirty system permissions into one update record per parent, carrying just the changed
 * `Permissions*` fields + Id. System permissions are columns on the parent record itself, so each
 * parent collapses to a single update. Profile-owned permission sets cannot be updated directly, so
 * those are written to the `Profile` record (by its ProfileId); standalone permission sets are written
 * to the `PermissionSet` record.
 */
export function prepareSystemPermissionSaveData(
  dirtyPermissions: PermissionTableSystemPermissionCellPermission[],
  profilesById: Record<string, PermissionSetWithProfileRecord>,
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>,
): PermissionSystemSaveData {
  const byParentId = new Map<string, SystemPermissionSaveRecord>();
  dirtyPermissions.forEach((permission) => {
    let saveRecord = byParentId.get(permission.parentId);
    if (!saveRecord) {
      const profile = profilesById[permission.parentId];
      const sobjectType: 'Profile' | 'PermissionSet' = profile ? 'Profile' : 'PermissionSet';
      const recordId = profile ? profile.ProfileId : permissionSetsById[permission.parentId]?.Id || permission.parentId;
      const record: SystemPermissionRecordForSave = { attributes: { type: sobjectType }, Id: recordId };
      saveRecord = { parentId: permission.parentId, sobjectType, record, dirtyPermissions: [] };
      byParentId.set(permission.parentId, saveRecord);
    }
    saveRecord.record[permission.field] = permission.enabled;
    saveRecord.dirtyPermissions.push(permission);
  });
  return { recordsToUpdate: Array.from(byParentId.values()) };
}

export async function saveSystemPermissionRecords(
  org: SalesforceOrgUi,
  preparedData: PermissionSystemSaveData,
): Promise<SystemPermissionSaveRecord[]> {
  const { recordsToUpdate } = preparedData;
  if (!recordsToUpdate.length) {
    return [];
  }

  // Profile permissions and permission set permissions are written to different sobjects
  async function runUpdates(saveRecords: SystemPermissionSaveRecord[], sobjectType: 'Profile' | 'PermissionSet') {
    if (!saveRecords.length) {
      return;
    }
    const results: RecordResult[] = (
      await Promise.all(
        splitArrayToMaxSize(saveRecords, 200).map((chunk) =>
          sobjectOperation(org, sobjectType, 'update', { records: chunk.map(({ record }) => record) }, { allOrNone: false }),
        ),
      )
    ).flat();
    // results are concatenated in chunk order, which matches saveRecords order
    saveRecords.forEach((saveRecord, index) => {
      saveRecord.response = results[index];
    });
  }

  await Promise.all([
    runUpdates(
      recordsToUpdate.filter(({ sobjectType }) => sobjectType === 'Profile'),
      'Profile',
    ),
    runUpdates(
      recordsToUpdate.filter(({ sobjectType }) => sobjectType === 'PermissionSet'),
      'PermissionSet',
    ),
  ]);
  return recordsToUpdate;
}

/**
 * Refresh data after save based on results
 * System Permissions
 */
export function getUpdatedSystemPermissions(
  systemPermissionMap: Record<string, SystemPermissionDefinitionMap>,
  savedRecords: SystemPermissionSaveRecord[],
): Record<string, SystemPermissionDefinitionMap> {
  const output: Record<string, SystemPermissionDefinitionMap> = { ...systemPermissionMap };
  // remove all prior error messages across all permissions
  Object.keys(output).forEach((key) => {
    output[key] = { ...output[key], permissions: { ...output[key].permissions } };
    output[key].permissionKeys.forEach((permKey) => {
      output[key].permissions[permKey] = { ...output[key].permissions[permKey], errorMessage: undefined };
    });
  });

  savedRecords.forEach(({ dirtyPermissions, response }) => {
    dirtyPermissions.forEach((dirtyPermission) => {
      const fieldKey = dirtyPermission.field;
      const currentMap = output[fieldKey];
      if (!currentMap) {
        return;
      }
      if (!isErrorResponse(response)) {
        output[fieldKey] = {
          ...currentMap,
          permissions: {
            ...currentMap.permissions,
            [dirtyPermission.parentId]: { enabled: dirtyPermission.enabled },
          },
        };
      } else {
        logger.warn('[SAVE ERROR]', { dirtyPermission, response });
        output[fieldKey] = {
          ...currentMap,
          permissions: {
            ...currentMap.permissions,
            [dirtyPermission.parentId]: {
              ...currentMap.permissions[dirtyPermission.parentId],
              errorMessage: response.errors.map((err) => err.message).join('\n'),
            },
          },
        };
      }
    });
  });
  return output;
}

export { updatePermissionSetRecords };

export function collectProfileAndPermissionIds(
  dirtyPermissions: PermissionTableCellPermission[],
  profilesById: Record<string, PermissionSetWithProfileRecord>,
  permissionSetsById: Record<string, PermissionSetNoProfileRecord>,
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
  permissionSaveResults: PermissionSaveResults<ObjectPermissionRecordForSave, PermissionTableObjectCellPermission>[],
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
        PermissionsViewAllRecords: dirtyPermission.viewAll,
        PermissionsModifyAllRecords: dirtyPermission.modifyAll,
        PermissionsViewAllFields: dirtyPermission.viewAllFields,
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
              viewAllFields: dirtyPermission.viewAllFields,
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
              viewAllFields: dirtyPermission.viewAllFields,
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
                  : err.message,
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
  permissionSaveResults: PermissionSaveResults<FieldPermissionRecordForSave, PermissionTableFieldCellPermission>[],
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
              .map((err) => {
                // (field not detectable in advance): Field Name: bad value for restricted picklist field: X.X
                if (err.statusCode === 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST') {
                  return 'Salesforce does not allow modification of permissions for this field.';
                }
                if (err.statusCode === 'FIELD_INTEGRITY_EXCEPTION' && err.message.startsWith('Read permission is required')) {
                  return `${err.message}. "View All Fields" Object Permissions must be disabled before field-level read permission can be removed.`;
                }
                return err.message;
              })
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
  permissionSaveResults: PermissionSaveResults<TabVisibilityPermissionRecordForSave, PermissionTableTabVisibilityCellPermission>[],
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
                  : err.message,
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
  const queries = splitArrayToMaxSize(allSobjects, MAX_OBJ_IN_PERMISSIONABLE_FIELDS_QUERY).map((sobjects) => {
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
        getField('IsCreatable'),
        getField('IsUpdatable'),
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
        getField('PermissionsViewAllFields'),
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
        'Name',
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
 * The settable system permissions available in the org. `Permissions*` boolean fields on the
 * PermissionSet object are edition/license/feature dependent, so we derive the list from the describe
 * (rather than a hardcoded catalog) and only include the ones that can actually be updated. The
 * describe `label` becomes the row label (e.x. `PermissionsApiEnabled` -> "API Enabled").
 */
export function getSystemPermissionFieldsFromDescribe(fields: Field[]): { name: string; label: string }[] {
  return (
    fields
      .filter((field) => field.type === 'boolean' && field.updateable && field.name.startsWith('Permissions'))
      // Salesforce field labels for system permissions can carry trailing whitespace/newlines
      .map(({ name, label }) => ({ name, label: label.trim() }))
      .sort((a, b) => a.label.localeCompare(b.label))
  );
}

/**
 * Query the current value of each system permission for the selected profiles/permission sets. Unlike
 * the object/field/tab queries, system permissions are columns on the PermissionSet record itself, so
 * this selects the `Permissions*` fields directly, keyed by the PermissionSet Id (which is the same id
 * stored for each selected profile/permission set).
 */
export function getQuerySystemPermissions(parentIds: string[], systemPermissionFields: string[]): string[] {
  if (!parentIds.length || !systemPermissionFields.length) {
    return [];
  }
  const queries = splitArrayToMaxSize(parentIds, MAX_OBJ_IN_QUERY).map((ids) => {
    const query: Query = {
      fields: [getField('Id'), ...systemPermissionFields.map((field) => getField(field))],
      sObject: 'PermissionSet',
      where: {
        left: {
          field: 'Id',
          operator: 'IN',
          value: ids,
          literalType: 'STRING',
        },
      },
      orderBy: {
        field: 'Id',
        order: 'ASC',
      },
    };
    return composeQuery(query);
  });
  logger.log('getQuerySystemPermissions()', queries);
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
  sobjectNameField: 'SobjectType' | 'Name' = 'SobjectType',
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

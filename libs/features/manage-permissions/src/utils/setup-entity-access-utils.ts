import { logger } from '@jetstream/shared/client-logger';
import { isErrorResponse } from '@jetstream/shared/ui-utils';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  CustomPermissionRecord,
  Maybe,
  PermissionSaveResults,
  PermissionSetupEntityAccessSaveData,
  PermissionTableSetupEntityAccessCellPermission,
  SetupEntityAccessDefinitionMap,
  SetupEntityAccessRecord,
  SetupEntityAccessRecordForSave,
  SetupEntityAccessType,
} from '@jetstream/types';
import { composeQuery, getField, Query } from '@jetstreamapp/soql-parser-js';

const MAX_PARENT_IDS_IN_QUERY = 100;

/**
 * Salesforce creates placeholder records in some cases with an invalid id prefix. They cannot be modified, so they are
 * treated as absent - a new record supersedes them if the user grants access.
 */
const INVALID_ID_PREFIX = '000';

/** A setup entity that access can be granted to, independent of the sObject it came from */
export interface SetupEntityCatalogItem {
  setupEntityId: string;
  /** Fully qualified API name, including the namespace prefix when the entity comes from a package */
  apiName: string;
  label: string;
  namespacePrefix?: Maybe<string>;
  description?: Maybe<string>;
}

/**
 * Everything that differs between setup entity types. The table, save and export code is shared, so adding a new
 * type (Apex classes, Visualforce pages, apps, ...) is a matter of adding a catalog entry and a tab.
 */
export interface SetupEntityAccessCatalog {
  type: SetupEntityAccessType;
  /** Used for the tab id, export sheet name and csv file name, e.g. `custom-permissions` */
  key: string;
  label: { singular: string; plural: string };
  /** Query that lists every entity of this type in the org */
  getCatalogQuery: () => string;
  isTooling: boolean;
  toCatalogItem: (record: any) => SetupEntityCatalogItem;
}

export function getQualifiedApiName(developerName: string, namespacePrefix?: Maybe<string>): string {
  return namespacePrefix ? `${namespacePrefix}__${developerName}` : developerName;
}

export function customPermissionToCatalogItem(record: CustomPermissionRecord): SetupEntityCatalogItem {
  return {
    setupEntityId: record.Id,
    apiName: getQualifiedApiName(record.DeveloperName, record.NamespacePrefix),
    label: record.MasterLabel,
    namespacePrefix: record.NamespacePrefix,
    description: record.Description,
  };
}

export const CUSTOM_PERMISSION_CATALOG: SetupEntityAccessCatalog = {
  type: 'CustomPermission',
  key: 'custom-permissions',
  label: { singular: 'custom permission', plural: 'custom permissions' },
  getCatalogQuery: () =>
    composeQuery({
      fields: ['Id', 'DeveloperName', 'MasterLabel', 'NamespacePrefix', 'Description', 'IsLicensed', 'IsProtected'].map((field) =>
        getField(field),
      ),
      sObject: 'CustomPermission',
      orderBy: [
        { field: 'NamespacePrefix', order: 'ASC', nulls: 'FIRST' },
        { field: 'MasterLabel', order: 'ASC' },
      ],
    }),
  isTooling: false,
  toCatalogItem: customPermissionToCatalogItem,
};

export const SETUP_ENTITY_ACCESS_CATALOGS: Record<SetupEntityAccessType, SetupEntityAccessCatalog> = {
  CustomPermission: CUSTOM_PERMISSION_CATALOG,
};

/** The setup entity types that have a tab in the editor, in tab order */
export const SETUP_ENTITY_ACCESS_TYPES: SetupEntityAccessType[] = ['CustomPermission'];

/**
 * Query the access rows of one setup entity type for the selected profiles and permission sets. Access to entities
 * of other types is never loaded, so a type that has not been wired up has no cost.
 */
export function getQuerySetupEntityAccess(
  setupEntityType: SetupEntityAccessType,
  profilePermSetIds: string[],
  permSetIds: string[],
): string[] {
  const parentIds = [...profilePermSetIds, ...permSetIds];
  if (!parentIds.length) {
    return [];
  }
  const queries = splitArrayToMaxSize(parentIds, MAX_PARENT_IDS_IN_QUERY).map((ids) => {
    const query: Query = {
      fields: [getField('Id'), getField('ParentId'), getField('SetupEntityId'), getField('SetupEntityType')],
      sObject: 'SetupEntityAccess',
      where: {
        left: {
          field: 'SetupEntityType',
          operator: '=',
          value: setupEntityType,
          literalType: 'STRING',
        },
        operator: 'AND',
        right: {
          left: {
            field: 'ParentId',
            operator: 'IN',
            value: ids,
            literalType: 'STRING',
          },
        },
      },
    };
    return composeQuery(query);
  });
  logger.log('getQuerySetupEntityAccess()', queries);
  return queries;
}

/**
 * Join the catalog (every entity in the org) with the access rows (which parents can use each one) into one map
 * entry per entity, keyed by the setup entity id. Parents without a row get `enabled: false`.
 */
export function getSetupEntityAccessMap(
  setupEntityType: SetupEntityAccessType,
  catalogItems: SetupEntityCatalogItem[],
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  accessRecords: SetupEntityAccessRecord[],
  readOnlyPermissionSetIds: ReadonlySet<string>,
): Record<string, SetupEntityAccessDefinitionMap> {
  const recordsBySetupEntityIdByParentId = accessRecords.reduce(
    (output: Record<string, Record<string, SetupEntityAccessRecord>>, record) => {
      output[record.SetupEntityId] = output[record.SetupEntityId] || {};
      output[record.SetupEntityId][record.ParentId] = record;
      return output;
    },
    {},
  );

  return catalogItems.reduce((output: Record<string, SetupEntityAccessDefinitionMap>, item) => {
    output[item.setupEntityId] = getSetupEntityAccessDefinition(
      setupEntityType,
      item,
      selectedProfiles,
      selectedPermissionSets,
      recordsBySetupEntityIdByParentId[item.setupEntityId] || {},
      readOnlyPermissionSetIds,
    );
    return output;
  }, {});
}

/**
 * Build the map entry for one entity. Also used to add a freshly created custom permission to a loaded map
 * without reloading everything (which would discard unsaved changes on the other tabs).
 */
export function getSetupEntityAccessDefinition(
  setupEntityType: SetupEntityAccessType,
  item: SetupEntityCatalogItem,
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  accessRecordsByParentId: Record<string, SetupEntityAccessRecord>,
  readOnlyPermissionSetIds: ReadonlySet<string>,
): SetupEntityAccessDefinitionMap {
  const definition: SetupEntityAccessDefinitionMap = {
    setupEntityType,
    setupEntityId: item.setupEntityId,
    apiName: item.apiName,
    label: item.label,
    namespacePrefix: item.namespacePrefix,
    description: item.description,
    permissions: {},
    permissionKeys: [],
  };

  function processProfileAndPermSet(id: string) {
    const record = accessRecordsByParentId[id];
    const usableRecord = record && !record.Id.startsWith(INVALID_ID_PREFIX) ? record : null;
    definition.permissionKeys.push(id);
    definition.permissions[id] = {
      enabled: !!record,
      record: usableRecord,
      isReadOnly: readOnlyPermissionSetIds.has(id),
    };
  }

  selectedProfiles.forEach(processProfileAndPermSet);
  selectedPermissionSets.forEach(processProfileAndPermSet);

  return definition;
}

/**
 * Access is a row that either exists or does not, so a change is always an insert or a delete.
 * A cell that is dirty but already matches the stored row (e.g. granted, then revoked, then granted again before
 * saving) is impossible because the dirty flag compares against the loaded value, so no no-op cases are produced.
 */
export function prepareSetupEntityAccessSaveData(
  dirtyPermissions: PermissionTableSetupEntityAccessCellPermission[],
): PermissionSetupEntityAccessSaveData {
  return dirtyPermissions.reduce(
    (output: PermissionSetupEntityAccessSaveData, permission, i) => {
      let newRecord: SetupEntityAccessRecordForSave | undefined = undefined;
      let recordIdx: number;
      let operation: 'insert' | 'delete';
      if (!permission.enabled && permission.record.record) {
        output.recordsToDelete.push(permission.record.record.Id);
        recordIdx = output.recordsToDelete.length - 1;
        operation = 'delete';
      } else if (permission.enabled) {
        newRecord = {
          attributes: { type: 'SetupEntityAccess' },
          ParentId: permission.parentId,
          SetupEntityId: permission.setupEntityId,
        };
        output.recordsToInsert.push(newRecord);
        recordIdx = output.recordsToInsert.length - 1;
        operation = 'insert';
      } else {
        // Revoking access that was never granted (no row to delete) - nothing to send to Salesforce
        return output;
      }

      output.permissionSaveResults.push({
        dirtyPermission: permission,
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

/**
 * Refresh data after save based on results
 * Setup Entity Access (custom permissions, ...)
 */
export function getUpdatedSetupEntityAccessPermissions(
  permissionMap: Record<string, SetupEntityAccessDefinitionMap>,
  permissionSaveResults: PermissionSaveResults<SetupEntityAccessRecordForSave, PermissionTableSetupEntityAccessCellPermission>[],
): Record<string, SetupEntityAccessDefinitionMap> {
  const output: Record<string, SetupEntityAccessDefinitionMap> = { ...permissionMap };
  // remove all prior error messages across all entities
  Object.keys(output).forEach((key) => {
    output[key] = { ...output[key], permissions: { ...output[key].permissions } };
    output[key].permissionKeys.forEach((permKey) => {
      output[key].permissions[permKey] = { ...output[key].permissions[permKey], errorMessage: undefined };
    });
  });

  permissionSaveResults.forEach(({ dirtyPermission, operation, response }) => {
    const currentMap = output[dirtyPermission.setupEntityId];
    if (!currentMap) {
      return;
    }
    if (!isErrorResponse(response)) {
      const record: SetupEntityAccessRecord | null =
        operation === 'insert'
          ? {
              Id: response?.id || '',
              ParentId: dirtyPermission.parentId,
              SetupEntityId: dirtyPermission.setupEntityId,
              SetupEntityType: dirtyPermission.setupEntityType,
            }
          : null;
      output[dirtyPermission.setupEntityId] = {
        ...currentMap,
        permissions: {
          ...currentMap.permissions,
          [dirtyPermission.parentId]: {
            ...currentMap.permissions[dirtyPermission.parentId],
            enabled: dirtyPermission.enabled,
            record,
          },
        },
      };
    } else {
      logger.warn('[SAVE ERROR]', { dirtyPermission, response });
      output[dirtyPermission.setupEntityId] = {
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
  return output;
}

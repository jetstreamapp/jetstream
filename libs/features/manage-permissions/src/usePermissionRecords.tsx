import { logger } from '@jetstream/shared/client-logger';
import { queryAll, queryAllUsingOffset } from '@jetstream/shared/data';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj, groupByFlat } from '@jetstream/shared/utils';
import {
  EntityParticlePermissionsRecord,
  FieldPermissionDefinitionMap,
  FieldPermissionRecord,
  ObjectPermissionDefinitionMap,
  ObjectPermissionRecord,
  SalesforceOrgUi,
  TabDefinitionRecord,
  TabVisibilityPermissionDefinitionMap,
  TabVisibilityPermissionRecord,
} from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getFieldDefinitionKey,
  getQueryForAllPermissionableFields,
  getQueryForFieldPermissions,
  getQueryObjectPermissions,
  getQueryTabDefinition,
  getQueryTabVisibilityPermissions,
} from './utils/permission-manager-utils';

export function usePermissionRecords(selectedOrg: SalesforceOrgUi, sobjects: string[], profilePermSetIds: string[], permSetIds: string[]) {
  const isMounted = useRef(true);
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [fieldsByObject, setFieldsByObject] = useState<Record<string, string[]> | null>(null);
  const [fieldsByKey, setFieldsByKey] = useState<Record<string, EntityParticlePermissionsRecord> | null>(null);

  const [objectPermissionMap, setObjectPermissionMap] = useState<Record<string, ObjectPermissionDefinitionMap> | null>(null);
  const [fieldPermissionMap, setFieldPermissionMap] = useState<Record<string, FieldPermissionDefinitionMap> | null>(null);
  const [tabVisibilityPermissionMap, setTabVisibilityPermissionMap] = useState<Record<string, TabVisibilityPermissionDefinitionMap> | null>(
    null
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    // LOAD PROFILES/PERM SETS
    if (selectedOrg) {
      fetchMetadata();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, sobjects, permSetIds, profilePermSetIds]);

  const fetchMetadata = useCallback(async () => {
    try {
      // init and reset in case of prior
      setLoading(true);
      if (hasError) {
        setHasError(false);
      }
      // query all data and transform into state maps
      const output = await Promise.all([
        queryAndCombineResults<EntityParticlePermissionsRecord>(selectedOrg, getQueryForAllPermissionableFields(sobjects), true, true),
        queryAndCombineResults<ObjectPermissionRecord>(selectedOrg, getQueryObjectPermissions(sobjects, permSetIds, profilePermSetIds)),
        queryAndCombineResults<FieldPermissionRecord>(selectedOrg, getQueryForFieldPermissions(sobjects, permSetIds, profilePermSetIds)),
        queryAndCombineResults<TabVisibilityPermissionRecord>(
          selectedOrg,
          getQueryTabVisibilityPermissions(sobjects, permSetIds, profilePermSetIds)
        ).then((record) => record.map((item) => ({ ...item, Name: item.Name.replace('standard-', '') }))),
        queryAndCombineResults<TabDefinitionRecord>(selectedOrg, getQueryTabDefinition(sobjects), false, true).then((tabs) =>
          groupByFlat(tabs, 'SobjectName')
        ),
      ]).then(([fieldDefinition, objectPermissions, fieldPermissions, tabVisibilityPermissions, tabDefinitions]) => {
        return {
          fieldsByObject: getAllFieldsByObject(fieldDefinition),
          fieldsByKey: groupFields(fieldDefinition),
          objectPermissionMap: getObjectPermissionMap(sobjects, profilePermSetIds, permSetIds, objectPermissions),
          fieldPermissionMap: getFieldPermissionMap(fieldDefinition, profilePermSetIds, permSetIds, fieldPermissions),
          tabVisibilityPermissionMap: getTabVisibilityPermissionMap(
            sobjects,
            profilePermSetIds,
            permSetIds,
            tabVisibilityPermissions,
            tabDefinitions
          ),
        };
      });
      if (isMounted.current) {
        setFieldsByObject(output.fieldsByObject);
        setFieldsByKey(output.fieldsByKey);
        setObjectPermissionMap(output.objectPermissionMap);
        setFieldPermissionMap(output.fieldPermissionMap);
        setTabVisibilityPermissionMap(output.tabVisibilityPermissionMap);
      }
    } catch (ex) {
      logger.warn('[useProfilesAndPermSets][ERROR]', getErrorMessage(ex));
      rollbar.error('[useProfilesAndPermSets][ERROR]', getErrorMessageAndStackObj(ex));
      if (isMounted.current) {
        setHasError(true);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  return {
    loading,
    fieldsByObject,
    fieldsByKey,
    /** permissionsByObjectAndField, objectPermissionsByKey, fieldPermissionsByKey, */
    objectPermissionMap,
    fieldPermissionMap,
    tabVisibilityPermissionMap,
    hasError,
  };
}

// This could be eligible to pull into generic method for expanded use
async function queryAndCombineResults<T>(
  selectedOrg: SalesforceOrgUi,
  queries: string[],
  useOffset = false,
  isTooling = false
): Promise<T[]> {
  let output: T[] = [];
  for (const currQuery of queries) {
    if (useOffset) {
      const { queryResults } = await queryAllUsingOffset<T>(selectedOrg, currQuery, isTooling);
      output = output.concat(queryResults.records);
    } else {
      const { queryResults } = await queryAll<T>(selectedOrg, currQuery, isTooling);
      output = output.concat(queryResults.records);
    }
  }
  return output;
}

function getAllFieldsByObject(fields: EntityParticlePermissionsRecord[]): Record<string, string[]> {
  return fields.reduce((output: Record<string, string[]>, { QualifiedApiName, EntityDefinition }) => {
    output[EntityDefinition.QualifiedApiName] = output[EntityDefinition.QualifiedApiName] || [];
    output[EntityDefinition.QualifiedApiName].push(`${EntityDefinition.QualifiedApiName}.${QualifiedApiName}`);
    return output;
  }, {});
}

function groupFields(fields: EntityParticlePermissionsRecord[]): Record<string, EntityParticlePermissionsRecord> {
  return fields.reduce((output: Record<string, EntityParticlePermissionsRecord>, record) => {
    output[getFieldDefinitionKey(record)] = record;
    return output;
  }, {});
}

function getObjectPermissionMap(
  sobjects: string[],
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  permissions: ObjectPermissionRecord[]
): Record<string, ObjectPermissionDefinitionMap> {
  const objectPermissionsByFieldByParentId = permissions.reduce((output: Record<string, Record<string, ObjectPermissionRecord>>, item) => {
    output[item.SobjectType] = output[item.SobjectType] || {};
    output[item.SobjectType][item.ParentId] = item;
    return output;
  }, {});

  return sobjects.reduce((output: Record<string, ObjectPermissionDefinitionMap>, item) => {
    const currItem: ObjectPermissionDefinitionMap = {
      apiName: item,
      label: item, // FIXME:
      metadata: item,
      permissions: {},
      permissionKeys: [],
    };

    function processProfileAndPermSet(id: string) {
      const permissionRecord = objectPermissionsByFieldByParentId[item]?.[id];
      currItem.permissionKeys.push(id);
      if (permissionRecord) {
        currItem.permissions[id] = {
          create: permissionRecord.PermissionsCreate,
          read: permissionRecord.PermissionsRead,
          edit: permissionRecord.PermissionsEdit,
          delete: permissionRecord.PermissionsDelete,
          viewAll: permissionRecord.PermissionsViewAllRecords,
          modifyAll: permissionRecord.PermissionsModifyAllRecords,
          record: permissionRecord,
        };
      } else {
        currItem.permissions[id] = {
          create: false,
          read: false,
          edit: false,
          delete: false,
          viewAll: false,
          modifyAll: false,
          record: null,
        };
      }
    }

    selectedProfiles.forEach(processProfileAndPermSet);
    selectedPermissionSets.forEach(processProfileAndPermSet);

    output[item] = currItem;
    return output;
  }, {});
}

function getFieldPermissionMap(
  fields: EntityParticlePermissionsRecord[],
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  permissions: FieldPermissionRecord[]
): Record<string, FieldPermissionDefinitionMap> {
  const fieldPermissionsByFieldByParentId = permissions.reduce((output: Record<string, Record<string, FieldPermissionRecord>>, field) => {
    output[field.Field] = output[field.Field] || {};
    output[field.Field][field.ParentId] = field;
    return output;
  }, {});

  return fields.reduce((output: Record<string, FieldPermissionDefinitionMap>, field) => {
    const fieldKey = `${field.EntityDefinition.QualifiedApiName}.${field.QualifiedApiName}`;
    const currItem: FieldPermissionDefinitionMap = {
      apiName: field.QualifiedApiName,
      label: field.Label,
      metadata: field,
      permissions: {},
      permissionKeys: [],
    };

    function processProfileAndPermSet(id: string) {
      const fieldPermissionRecord = fieldPermissionsByFieldByParentId[fieldKey]?.[id];
      currItem.permissionKeys.push(id);
      if (fieldPermissionRecord) {
        currItem.permissions[id] = {
          read: fieldPermissionRecord.PermissionsRead,
          edit: fieldPermissionRecord.PermissionsEdit,
          record: fieldPermissionRecord,
        };
      } else {
        currItem.permissions[id] = {
          read: false,
          edit: false,
          record: null,
        };
      }
    }

    selectedProfiles.forEach(processProfileAndPermSet);
    selectedPermissionSets.forEach(processProfileAndPermSet);

    output[fieldKey] = currItem;
    return output;
  }, {});
}

function getTabVisibilityPermissionMap(
  sobjects: string[],
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  permissions: TabVisibilityPermissionRecord[],
  tabDefinitions: Record<string, TabDefinitionRecord>
): Record<string, TabVisibilityPermissionDefinitionMap> {
  const objectPermissionsByFieldByParentId = permissions.reduce(
    (output: Record<string, Record<string, TabVisibilityPermissionRecord>>, item) => {
      output[item.Name] = output[item.Name] || {};
      output[item.Name][item.ParentId] = item;
      return output;
    },
    {}
  );

  return sobjects.reduce((output: Record<string, TabVisibilityPermissionDefinitionMap>, item) => {
    const currItem: TabVisibilityPermissionDefinitionMap = {
      apiName: item,
      label: item,
      metadata: item,
      permissions: {},
      permissionKeys: [],
      canSetPermission: !!tabDefinitions[item],
    };

    function processProfileAndPermSet(id: string) {
      const permissionRecord = objectPermissionsByFieldByParentId[item]?.[id];
      currItem.permissionKeys.push(id);
      if (permissionRecord) {
        currItem.permissions[id] = {
          available: true,
          visible: permissionRecord.Visibility === 'DefaultOn' ? true : false,
          record: permissionRecord,
          canSetPermission: true,
        };
      } else {
        currItem.permissions[id] = {
          available: false,
          visible: false,
          record: null,
          canSetPermission: !!tabDefinitions[item],
        };
      }
    }

    selectedProfiles.forEach(processProfileAndPermSet);
    selectedPermissionSets.forEach(processProfileAndPermSet);

    output[item] = currItem;
    return output;
  }, {});
}

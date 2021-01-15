/** @jsx jsx */
import { query, queryAll, queryAllUsingOffset } from '@jetstream/shared/data';
import { EntityParticlePermissionsRecord, FieldPermissionRecord, MapOf, ObjectPermissionRecord, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@jetstream/shared/client-logger';
import {
  getFieldDefinitionKey,
  getQueryForAllPermissionableFields,
  getQueryForFieldPermissions,
  getQueryObjectPermissions,
} from './utils/permission-manager-utils';
import { FieldPermissionDefinitionMap, ObjectPermissionDefinitionMap } from './utils/permission-manager-types';
import { useRollbar } from '@jetstream/shared/ui-utils';

export function usePermissionRecords(selectedOrg: SalesforceOrgUi, sobjects: string[], profilePermSetIds: string[], permSetIds: string[]) {
  const isMounted = useRef(null);
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [fieldsByObject, setFieldsByObject] = useState<MapOf<string[]>>(null);
  const [fieldsByKey, setFieldsByKey] = useState<MapOf<EntityParticlePermissionsRecord>>(null);

  const [objectPermissionMap, setObjectPermissionMap] = useState<MapOf<ObjectPermissionDefinitionMap>>(null);
  const [fieldPermissionMap, setFieldPermissionMap] = useState<MapOf<FieldPermissionDefinitionMap>>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
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
        queryAndCombineResults<EntityParticlePermissionsRecord>(selectedOrg, getQueryForAllPermissionableFields(sobjects), true),
        queryAndCombineResults<ObjectPermissionRecord>(selectedOrg, getQueryObjectPermissions(sobjects, permSetIds, profilePermSetIds)),
        queryAndCombineResults<FieldPermissionRecord>(selectedOrg, getQueryForFieldPermissions(sobjects, permSetIds, profilePermSetIds)),
      ]).then(([fieldDefinition, objectPermissions, fieldPermissions]) => {
        return {
          fieldsByObject: getAllFieldsByObject(fieldDefinition),
          fieldsByKey: groupFields(fieldDefinition),
          objectPermissionMap: getObjectPermissionMap(sobjects, profilePermSetIds, permSetIds, objectPermissions),
          fieldPermissionMap: getFieldPermissionMap(fieldDefinition, profilePermSetIds, permSetIds, fieldPermissions),
        };
      });
      if (isMounted.current) {
        setFieldsByObject(output.fieldsByObject);
        setFieldsByKey(output.fieldsByKey);
        setObjectPermissionMap(output.objectPermissionMap);
        setFieldPermissionMap(output.fieldPermissionMap);
      }
    } catch (ex) {
      logger.warn('[useProfilesAndPermSets][ERROR]', ex.message);
      rollbar.error('[useProfilesAndPermSets][ERROR]', ex);
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
    hasError,
  };
}

// This could be eligible to pull into generic method for expanded use
async function queryAndCombineResults<T>(selectedOrg: SalesforceOrgUi, queries: string[], useOffset = false): Promise<T[]> {
  let output: T[] = [];
  for (const currQuery of queries) {
    if (useOffset) {
      const { queryResults } = await queryAllUsingOffset<T>(selectedOrg, currQuery);
      output = output.concat(queryResults.records);
    } else {
      const { queryResults } = await queryAll<T>(selectedOrg, currQuery);
      output = output.concat(queryResults.records);
    }
  }
  return output;
}

function getAllFieldsByObject(fields: EntityParticlePermissionsRecord[]): MapOf<string[]> {
  return fields.reduce((output: MapOf<string[]>, { QualifiedApiName, EntityDefinition }) => {
    output[EntityDefinition.QualifiedApiName] = output[EntityDefinition.QualifiedApiName] || [];
    output[EntityDefinition.QualifiedApiName].push(`${EntityDefinition.QualifiedApiName}.${QualifiedApiName}`);
    return output;
  }, {});
}

function groupFields(fields: EntityParticlePermissionsRecord[]): MapOf<EntityParticlePermissionsRecord> {
  return fields.reduce((output: MapOf<EntityParticlePermissionsRecord>, record) => {
    output[getFieldDefinitionKey(record)] = record;
    return output;
  }, {});
}

function getObjectPermissionMap(
  sobjects: string[],
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  permissions: ObjectPermissionRecord[]
): MapOf<ObjectPermissionDefinitionMap> {
  const objectPermissionsByFieldByParentId = permissions.reduce((output: MapOf<MapOf<ObjectPermissionRecord>>, item) => {
    output[item.SobjectType] = output[item.SobjectType] || {};
    output[item.SobjectType][item.ParentId] = item;
    return output;
  }, {});

  return sobjects.reduce((output: MapOf<ObjectPermissionDefinitionMap>, item) => {
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
): MapOf<FieldPermissionDefinitionMap> {
  const fieldPermissionsByFieldByParentId = permissions.reduce((output: MapOf<MapOf<FieldPermissionRecord>>, field) => {
    output[field.Field] = output[field.Field] || {};
    output[field.Field][field.ParentId] = field;
    return output;
  }, {});

  return fields.reduce((output: MapOf<FieldPermissionDefinitionMap>, field) => {
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

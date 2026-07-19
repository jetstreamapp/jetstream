import { logger } from '@jetstream/shared/client-logger';
import { describeSObject, queryAll, queryAllUsingOffset } from '@jetstream/shared/data';
import { tracker } from '@jetstream/shared/ui-utils';
import { getErrorMessage, groupByFlat, splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  EntityParticlePermissionsRecord,
  FieldPermissionDefinitionMap,
  FieldPermissionRecord,
  ObjectPermissionDefinitionMap,
  ObjectPermissionRecord,
  SalesforceOrgUi,
  SystemPermissionDefinitionMap,
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
  getQuerySystemPermissions,
  getQueryTabDefinition,
  getQueryTabVisibilityPermissions,
  getSystemPermissionFieldsFromDescribe,
} from './utils/permission-manager-utils';

/** PermissionSet query result carrying the dynamic `Permissions*` boolean columns. */
type SystemPermissionSetRecord = { Id: string } & Record<string, boolean | string>;

const INVALID_ID_PREFIX = '000';

export function usePermissionRecords(selectedOrg: SalesforceOrgUi, sobjects: string[], profilePermSetIds: string[], permSetIds: string[]) {
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [fieldsByObject, setFieldsByObject] = useState<Record<string, string[]> | null>(null);
  const [fieldsByKey, setFieldsByKey] = useState<Record<string, EntityParticlePermissionsRecord> | null>(null);

  const [objectPermissionMap, setObjectPermissionMap] = useState<Record<string, ObjectPermissionDefinitionMap> | null>(null);
  const [fieldPermissionMap, setFieldPermissionMap] = useState<Record<string, FieldPermissionDefinitionMap> | null>(null);
  const [tabVisibilityPermissionMap, setTabVisibilityPermissionMap] = useState<Record<string, TabVisibilityPermissionDefinitionMap> | null>(
    null,
  );
  const [systemPermissionMap, setSystemPermissionMap] = useState<Record<string, SystemPermissionDefinitionMap> | null>(null);

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
        describeSObject(selectedOrg, 'FieldPermissions'),
        queryAndCombineResults<EntityParticlePermissionsRecord>(selectedOrg, getQueryForAllPermissionableFields(sobjects), true, true),
        queryAndCombineResults<ObjectPermissionRecord>(selectedOrg, getQueryObjectPermissions(sobjects, permSetIds, profilePermSetIds)),
        queryAndCombineResults<FieldPermissionRecord>(selectedOrg, getQueryForFieldPermissions(sobjects, permSetIds, profilePermSetIds)),
        queryAndCombineResults<TabVisibilityPermissionRecord>(
          selectedOrg,
          getQueryTabVisibilityPermissions(sobjects, permSetIds, profilePermSetIds),
        ).then((record) => record.map((item) => ({ ...item, Name: item.Name.replace('standard-', '') }))),
        queryAndCombineResults<TabDefinitionRecord>(selectedOrg, getQueryTabDefinition(sobjects), false, true).then((tabs) =>
          groupByFlat(tabs, 'SobjectName'),
        ),
        // System permissions are `Permissions*` columns on the PermissionSet record itself; describe to
        // learn which are settable in this org, then query their current values by permission set id.
        describeSObject(selectedOrg, 'PermissionSet').then((describeResult) => {
          const systemPermissionFields = getSystemPermissionFieldsFromDescribe(describeResult.data.fields);
          return queryAndCombineResults<SystemPermissionSetRecord>(
            selectedOrg,
            getQuerySystemPermissions(
              [...permSetIds, ...profilePermSetIds],
              systemPermissionFields.map(({ name }) => name),
            ),
          ).then((permissionSetRecords) =>
            getSystemPermissionMap(systemPermissionFields, profilePermSetIds, permSetIds, permissionSetRecords),
          );
        }),
      ]).then(
        ([
          fieldPermissionMetadata,
          fieldDefinition,
          objectPermissions,
          fieldPermissions,
          tabVisibilityPermissions,
          tabDefinitions,
          systemPermissions,
        ]) => {
          // Exclude any fields which are not available in the FieldPermissions.Field picklist (meaning that permissions cannot be set on them)
          // They show up as "permissionable" but are not supported for permissioning :shrug:
          const availableFields = new Set<string>(
            fieldPermissionMetadata.data.fields.find((field) => field.name === 'Field')?.picklistValues?.map((value) => value.value),
          );
          fieldDefinition = availableFields.size
            ? fieldDefinition.filter((field) => availableFields.has(`${field.EntityDefinition.QualifiedApiName}.${field.QualifiedApiName}`))
            : fieldDefinition;
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
              tabDefinitions,
            ),
            systemPermissionMap: systemPermissions,
          };
        },
      );
      if (isMounted.current) {
        setFieldsByObject(output.fieldsByObject);
        setFieldsByKey(output.fieldsByKey);
        setObjectPermissionMap(output.objectPermissionMap);
        setFieldPermissionMap(output.fieldPermissionMap);
        setTabVisibilityPermissionMap(output.tabVisibilityPermissionMap);
        setSystemPermissionMap(output.systemPermissionMap);
      }
    } catch (ex) {
      logger.warn('[useProfilesAndPermSets][ERROR]', getErrorMessage(ex));
      tracker.error('[useProfilesAndPermSets][ERROR]', ex);
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
    refetchMetadata: fetchMetadata,
    fieldsByObject,
    fieldsByKey,
    /** permissionsByObjectAndField, objectPermissionsByKey, fieldPermissionsByKey, */
    objectPermissionMap,
    fieldPermissionMap,
    tabVisibilityPermissionMap,
    systemPermissionMap,
    hasError,
  };
}

function getSystemPermissionMap(
  systemPermissionFields: { name: string; label: string }[],
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  permissionSetRecords: SystemPermissionSetRecord[],
): Record<string, SystemPermissionDefinitionMap> {
  const recordsById = groupByFlat(permissionSetRecords, 'Id');

  return systemPermissionFields.reduce((output: Record<string, SystemPermissionDefinitionMap>, { name, label }) => {
    const currItem: SystemPermissionDefinitionMap = {
      apiName: name,
      label,
      permissions: {},
      permissionKeys: [],
    };

    function processProfileAndPermSet(id: string) {
      currItem.permissionKeys.push(id);
      const record = recordsById[id];
      currItem.permissions[id] = {
        enabled: record ? !!record[name] : false,
      };
    }

    selectedProfiles.forEach(processProfileAndPermSet);
    selectedPermissionSets.forEach(processProfileAndPermSet);

    output[name] = currItem;
    return output;
  }, {});
}

/**
 * Number of queries to run concurrently. Offset-paged queries (EntityParticle) are split into many small batches to stay
 * under Salesforce's OFFSET cap, so we run them in bounded waves rather than sequentially to keep large selections fast.
 */
const QUERY_CONCURRENCY = 5;

// This could be eligible to pull into generic method for expanded use
async function queryAndCombineResults<T>(
  selectedOrg: SalesforceOrgUi,
  queries: string[],
  useOffset = false,
  isTooling = false,
): Promise<T[]> {
  const runQuery = (currQuery: string) =>
    useOffset ? queryAllUsingOffset<T>(selectedOrg, currQuery, isTooling) : queryAll<T>(selectedOrg, currQuery, isTooling);

  const output: T[] = [];
  // Results are keyed/grouped downstream, so ordering does not matter - run each wave concurrently
  for (const wave of splitArrayToMaxSize(queries, QUERY_CONCURRENCY)) {
    const waveResults = await Promise.all(wave.map(runQuery));
    for (const { queryResults } of waveResults) {
      output.push(...queryResults.records);
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
  permissions: ObjectPermissionRecord[],
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
          viewAllFields: permissionRecord.PermissionsViewAllFields,
          // Salesforce creates placeholder records in some cases, but the record is invalid and cannot be modified
          // we will create a new record which will supersede this one if the user modifies permissions
          record: permissionRecord.Id.startsWith(INVALID_ID_PREFIX) ? null : permissionRecord,
        };
      } else {
        currItem.permissions[id] = {
          create: false,
          read: false,
          edit: false,
          delete: false,
          viewAll: false,
          modifyAll: false,
          viewAllFields: false,
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
  permissions: FieldPermissionRecord[],
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
          // Salesforce creates placeholder records in some cases, but the record is invalid and cannot be modified
          // we will create a new record which will supersede this one if the user modifies permissions
          record: fieldPermissionRecord.Id.startsWith(INVALID_ID_PREFIX) ? null : fieldPermissionRecord,
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
  tabDefinitions: Record<string, TabDefinitionRecord>,
): Record<string, TabVisibilityPermissionDefinitionMap> {
  const objectPermissionsByFieldByParentId = permissions.reduce(
    (output: Record<string, Record<string, TabVisibilityPermissionRecord>>, item) => {
      output[item.Name] = output[item.Name] || {};
      output[item.Name][item.ParentId] = item;
      return output;
    },
    {},
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

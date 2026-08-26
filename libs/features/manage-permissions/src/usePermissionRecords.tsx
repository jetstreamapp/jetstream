import { logger } from '@jetstream/shared/client-logger';
import { describeSObject, queryAll, queryAllUsingCursor } from '@jetstream/shared/data';
import { tracker } from '@jetstream/shared/ui-utils';
import { ConcurrencyLimiter, createConcurrencyLimiter, getErrorMessage, groupByFlat } from '@jetstream/shared/utils';
import {
  CustomFieldAuditRecord,
  EntityParticlePermissionsRecord,
  FieldAuditMetadata,
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
  getFieldDefinitionKeyFromCustomField,
  getPermissionableFieldObjectChunks,
  getQueryForAllPermissionableFields,
  getQueryForCustomFieldAudit,
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
  const [systemPermissionsUnavailable, setSystemPermissionsUnavailable] = useState(false);
  const [fieldAuditUnavailable, setFieldAuditUnavailable] = useState(false);

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
      // init and reset in case of prior. These are set unconditionally because this callback is memoized on
      // `selectedOrg`, so reading the current flags to decide whether to clear them would read a stale closure.
      setLoading(true);
      setHasError(false);
      setSystemPermissionsUnavailable(false);
      setFieldAuditUnavailable(false);
      // Every request below shares this limiter so that a large selection cannot flood Salesforce
      const limit = createConcurrencyLimiter(QUERY_CONCURRENCY);
      // query all data and transform into state maps
      const output = await Promise.all([
        limit(() => describeSObject(selectedOrg, 'FieldPermissions')),
        // Cached from the object picker - identifies objects with no ObjectPermissions record (PricebookEntry, Task, ...)
        limit(() => describeSObject(selectedOrg, 'ObjectPermissions')),
        queryPermissionableFields(limit, selectedOrg, sobjects),
        queryAndCombineResults<ObjectPermissionRecord>(
          limit,
          selectedOrg,
          getQueryObjectPermissions(sobjects, permSetIds, profilePermSetIds),
        ),
        queryAndCombineResults<FieldPermissionRecord>(
          limit,
          selectedOrg,
          getQueryForFieldPermissions(sobjects, permSetIds, profilePermSetIds),
        ),
        queryAndCombineResults<TabVisibilityPermissionRecord>(
          limit,
          selectedOrg,
          getQueryTabVisibilityPermissions(sobjects, permSetIds, profilePermSetIds),
        ).then((record) => record.map((item) => ({ ...item, Name: item.Name.replace('standard-', '') }))),
        queryAndCombineResults<TabDefinitionRecord>(limit, selectedOrg, getQueryTabDefinition(sobjects), true).then((tabs) =>
          groupByFlat(tabs, 'SobjectName'),
        ),
        querySystemPermissions(limit, selectedOrg, profilePermSetIds, permSetIds),
        queryFieldAuditMetadata(limit, selectedOrg, sobjects),
      ]).then(
        ([
          fieldPermissionMetadata,
          objectPermissionMetadata,
          fieldDefinition,
          objectPermissions,
          fieldPermissions,
          tabVisibilityPermissions,
          tabDefinitions,
          systemPermissions,
          fieldAudit,
        ]) => {
          // Exclude any fields which are not available in the FieldPermissions.Field picklist (meaning that permissions cannot be set on them)
          // They show up as "permissionable" but are not supported for permissioning :shrug:
          const availableFields = new Set<string>(
            fieldPermissionMetadata.data.fields.find((field) => field.name === 'Field')?.picklistValues?.map((value) => value.value),
          );
          fieldDefinition = availableFields.size
            ? fieldDefinition.filter((field) => availableFields.has(`${field.EntityDefinition.QualifiedApiName}.${field.QualifiedApiName}`))
            : fieldDefinition;
          // `active` is omitted on some describe responses - only drop values explicitly marked inactive
          const objectPermissionableSobjects = new Set<string>(
            objectPermissionMetadata.data.fields
              .find((field) => field.name === 'SobjectType')
              ?.picklistValues?.filter(({ active }) => active !== false)
              .map(({ value }) => value),
          );
          return {
            fieldsByObject: getAllFieldsByObject(fieldDefinition),
            fieldsByKey: groupFields(fieldDefinition),
            objectPermissionMap: getObjectPermissionMap(
              sobjects,
              profilePermSetIds,
              permSetIds,
              objectPermissions,
              objectPermissionableSobjects,
            ),
            fieldPermissionMap: getFieldPermissionMap(
              fieldDefinition,
              profilePermSetIds,
              permSetIds,
              fieldPermissions,
              fieldAudit.auditByFieldDefinitionId,
            ),
            tabVisibilityPermissionMap: getTabVisibilityPermissionMap(
              sobjects,
              profilePermSetIds,
              permSetIds,
              tabVisibilityPermissions,
              tabDefinitions,
            ),
            systemPermissionMap: systemPermissions.permissionMap,
            systemPermissionsUnavailable: systemPermissions.loadFailed,
            fieldAuditUnavailable: fieldAudit.loadFailed,
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
        setSystemPermissionsUnavailable(output.systemPermissionsUnavailable);
        setFieldAuditUnavailable(output.fieldAuditUnavailable);
      }
    } catch (ex) {
      logger.warn('[usePermissionRecords][ERROR]', getErrorMessage(ex));
      tracker.error('[usePermissionRecords][ERROR]', ex);
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
    /** Every other tab loaded, but system permissions could not be read from Salesforce */
    systemPermissionsUnavailable,
    /** Everything else loaded, but the field audit columns have no data because the query failed */
    fieldAuditUnavailable,
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
 * Maximum requests in flight at once for a single load. Every query group shares one limiter, since limiting each
 * group on its own would still let the groups fan out in parallel and multiply into a request flood.
 */
const QUERY_CONCURRENCY = 5;

/** Runs each item through `runItem` under the shared limiter and flattens the records they return. */
async function queryChunks<TItem, TRecord>(
  limit: ConcurrencyLimiter,
  items: TItem[],
  runItem: (item: TItem) => Promise<TRecord[]>,
): Promise<TRecord[]> {
  // Results are keyed/grouped downstream, so ordering across items does not matter
  const results = await Promise.all(items.map((item) => limit(() => runItem(item))));
  return results.flat();
}

/**
 * Salesforce rejects a query against a field the object does not have. Depending on which API returned it, that
 * surfaces as the error-code form (INVALID_FIELD) or the message form ("No such column 'x' on entity 'y'"), so
 * both must be matched.
 */
const INVALID_FIELD_REGEX = /INVALID_FIELD|No such column/i;

/**
 * Users without View Setup access cannot query the Tooling `CustomField` object. Depending on which
 * path returned it, that surfaces as the error-code form (INVALID_TYPE) or the message form
 * ("sObject type 'CustomField' is not supported"), so both must be matched.
 */
const CUSTOM_FIELD_NOT_SUPPORTED_REGEX = /INVALID_TYPE|sObject type 'CustomField' is not supported/i;

const MAX_TRACKED_ERROR_LENGTH = 500;

/**
 * Salesforce echoes the entire rejected query back in its error message, which buries the part that says what
 * actually went wrong. The error tracker still receives the full error (its ignore rules and grouping rely on the
 * complete message) - this trimmed tail rides alongside it purely to make the failure readable at a glance.
 */
function getTrackableErrorDetail(ex: unknown): string {
  const message = getErrorMessage(ex);
  return message.length > MAX_TRACKED_ERROR_LENGTH ? `...${message.slice(-MAX_TRACKED_ERROR_LENGTH)}` : message;
}

/** System permissions load independently of the other tabs, so report whether they made it rather than throwing. */
interface SystemPermissionResult {
  permissionMap: Record<string, SystemPermissionDefinitionMap>;
  loadFailed: boolean;
}

/**
 * System permissions are `Permissions*` columns on the PermissionSet record itself; describe to learn which are
 * settable in this org, then query their current values by permission set id.
 *
 * The describe is cached for a few days, so an org whose schema changed since it was cached (a license or feature
 * change, or a different API version) can produce a query against columns that no longer exist. Salesforce rejects
 * the entire query in that case, so re-describe without the cache and try once more. Bypassing the cache also
 * replaces the stale entry, which keeps later loads from hitting the same failure.
 *
 * Object, field and tab permissions do not depend on any of this, so a failure here degrades the System Permissions
 * tab on its own instead of taking down the whole editor.
 */
async function querySystemPermissions(
  limit: ConcurrencyLimiter,
  selectedOrg: SalesforceOrgUi,
  profilePermSetIds: string[],
  permSetIds: string[],
): Promise<SystemPermissionResult> {
  const fetchUsingDescribe = async (skipDescribeCache: boolean) => {
    const describeResult = await limit(() => describeSObject(selectedOrg, 'PermissionSet', false, skipDescribeCache));
    const systemPermissionFields = getSystemPermissionFieldsFromDescribe(describeResult.data.fields);
    const permissionSetRecords = await queryAndCombineResults<SystemPermissionSetRecord>(
      limit,
      selectedOrg,
      getQuerySystemPermissions(
        [...permSetIds, ...profilePermSetIds],
        systemPermissionFields.map(({ name }) => name),
      ),
    );
    return getSystemPermissionMap(systemPermissionFields, profilePermSetIds, permSetIds, permissionSetRecords);
  };

  const fetchRetryingStaleDescribe = async () => {
    try {
      return await fetchUsingDescribe(false);
    } catch (ex) {
      if (!INVALID_FIELD_REGEX.test(getErrorMessage(ex))) {
        throw ex;
      }
      logger.warn('[usePermissionRecords] Cached PermissionSet describe is stale, retrying with a fresh describe');
      return await fetchUsingDescribe(true);
    }
  };

  try {
    return { permissionMap: await fetchRetryingStaleDescribe(), loadFailed: false };
  } catch (ex) {
    // Nothing else fails when this does, so this is the only chance to report it
    logger.warn('[usePermissionRecords][SYSTEM PERMISSIONS][ERROR]', getErrorMessage(ex));
    tracker.error('[usePermissionRecords][SYSTEM PERMISSIONS][ERROR]', ex, { errorDetail: getTrackableErrorDetail(ex) });
    return { permissionMap: {}, loadFailed: true };
  }
}

/** Audit data is supplemental, so report whether it made it rather than failing the whole load. */
interface FieldAuditResult {
  /** Keyed by `EntityParticle.FieldDefinitionId` so it can be joined onto the field list directly */
  auditByFieldDefinitionId: Record<string, FieldAuditMetadata>;
  loadFailed: boolean;
}

/**
 * Created/modified dates and users for every custom field on the selected objects.
 *
 * EntityParticle carries no audit fields, so this comes from the Tooling `CustomField` object and is joined back
 * on the FieldDefinitionId the field list already provides. Standard fields have no CustomField record, so they
 * are absent here and their audit columns stay blank - Salesforce tracks no audit data for them.
 *
 * These columns are opt-in and purely informational, so a failure (CustomField can be denied where EntityParticle
 * is allowed) leaves the columns empty rather than taking down the editor.
 */
async function queryFieldAuditMetadata(
  limit: ConcurrencyLimiter,
  selectedOrg: SalesforceOrgUi,
  sobjects: string[],
): Promise<FieldAuditResult> {
  try {
    const records = await queryAndCombineResults<CustomFieldAuditRecord>(limit, selectedOrg, getQueryForCustomFieldAudit(sobjects), true);
    const auditByFieldDefinitionId = records.reduce((output: Record<string, FieldAuditMetadata>, record) => {
      output[getFieldDefinitionKeyFromCustomField(record)] = {
        createdDate: record.CreatedDate,
        createdBy: record.CreatedBy?.Name,
        lastModifiedDate: record.LastModifiedDate,
        lastModifiedBy: record.LastModifiedBy?.Name,
      };
      return output;
    }, {});
    return { auditByFieldDefinitionId, loadFailed: false };
  } catch (ex) {
    const errorMessage = getErrorMessage(ex);
    // Nothing else fails when this does, so this is the only chance to report it
    logger.warn('[usePermissionRecords][FIELD AUDIT][ERROR]', errorMessage);
    // Missing View Setup access is the expected degradation this catch exists for, not an application
    // error worth reporting
    if (!CUSTOM_FIELD_NOT_SUPPORTED_REGEX.test(errorMessage)) {
      tracker.error('[usePermissionRecords][FIELD AUDIT][ERROR]', ex, { errorDetail: getTrackableErrorDetail(ex) });
    }
    return { auditByFieldDefinitionId: {}, loadFailed: true };
  }
}

// This could be eligible to pull into generic method for expanded use
async function queryAndCombineResults<T>(
  limit: ConcurrencyLimiter,
  selectedOrg: SalesforceOrgUi,
  queries: string[],
  isTooling = false,
): Promise<T[]> {
  return queryChunks(limit, queries, (currQuery) =>
    queryAll<T>(selectedOrg, currQuery, isTooling).then(({ queryResults }) => queryResults.records),
  );
}

/**
 * EntityParticle neither supports queryMore nor an OFFSET beyond 2000, so each chunk of objects is paged using a
 * DurableId cursor. That removes the depth ceiling, letting one query cover many objects instead of a handful.
 *
 * Each chunk holds a single concurrency slot for all of its pages, since those pages must run in sequence.
 */
async function queryPermissionableFields(
  limit: ConcurrencyLimiter,
  selectedOrg: SalesforceOrgUi,
  sobjects: string[],
): Promise<EntityParticlePermissionsRecord[]> {
  return queryChunks(limit, getPermissionableFieldObjectChunks(sobjects), (chunk) =>
    queryAllUsingCursor<EntityParticlePermissionsRecord>(
      selectedOrg,
      (afterDurableId) => getQueryForAllPermissionableFields(chunk, afterDurableId),
      ({ DurableId }) => DurableId,
      true,
    ).then(({ queryResults }) => queryResults.records),
  );
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

/**
 * @param objectPermissionableSobjects `ObjectPermissions.SobjectType` allow-list. An empty set means the
 * describe gave us nothing to filter on, so every object is treated as supported rather than none.
 */
function getObjectPermissionMap(
  sobjects: string[],
  selectedProfiles: string[],
  selectedPermissionSets: string[],
  permissions: ObjectPermissionRecord[],
  objectPermissionableSobjects: Set<string>,
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
      supportsObjectPermissions: !objectPermissionableSobjects.size || objectPermissionableSobjects.has(item),
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
  auditByFieldDefinitionId: Record<string, FieldAuditMetadata>,
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
      auditMetadata: auditByFieldDefinitionId[field.FieldDefinitionId],
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

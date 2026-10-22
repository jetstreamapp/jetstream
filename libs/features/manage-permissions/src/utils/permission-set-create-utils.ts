import { logger } from '@jetstream/shared/client-logger';
import { describeSObject, queryAll, sobjectOperation } from '@jetstream/shared/data';
import { isSalesforceProvidedPermissionSet } from '@jetstream/shared/ui-utils';
import { REGEX, splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  ErrorResult,
  ListItem,
  ListItemGroup,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
  RecordResult,
  SalesforceOrgUi,
} from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import { getQuerySystemPermissions, getSystemPermissionFieldsFromDescribe } from './permission-manager-utils';

const MAX_RECORDS_PER_REQUEST = 200;
/** Permissions that fail on the first attempt are usually waiting on another object in the same batch */
const MAX_OBJECT_PERMISSION_ATTEMPTS = 3;
const PERMISSION_SET_NAME_MAX_LENGTH = 80;

export interface PermissionSetLicenseOption {
  id: string;
  label: string;
  /** `UserLicense` licenses are what profiles are tied to, `PermissionSetLicense` are add-on licenses */
  type: 'UserLicense' | 'PermissionSetLicense';
}

export interface PermissionSetCloneSourceDetails {
  id: string;
  licenseId: string | null;
  hasActivationRequired: boolean;
  description: string | null;
}

export interface PermissionSetCreateInput {
  label: string;
  name: string;
  description: string;
  licenseId: string | null;
  hasActivationRequired: boolean;
}

export type PermissionSetCloneStepKey =
  | 'objectPermissions'
  | 'fieldPermissions'
  | 'setupEntityAccess'
  | 'tabSettings'
  | 'systemPermissions';

export interface PermissionSetCloneStepResult {
  key: PermissionSetCloneStepKey;
  label: string;
  total: number;
  failed: number;
  /** Unique error messages, so a thousand failures for the same reason are reported once */
  errors: { message: string; count: number }[];
}

export interface PermissionSetCreateResult {
  id: string;
  /** Empty when the permission set was created from scratch */
  cloneSteps: PermissionSetCloneStepResult[];
}

type CloneRecord = Record<string, unknown>;

interface CloneSourceRecords {
  enabledSystemPermissions: Record<string, true>;
  objectPermissions: CloneRecord[];
  fieldPermissions: CloneRecord[];
  setupEntityAccess: CloneRecord[];
  tabSettings: CloneRecord[];
}

const CLONE_STEP_LABELS: Record<PermissionSetCloneStepKey, string> = {
  objectPermissions: 'Object Permissions',
  fieldPermissions: 'Field Permissions',
  setupEntityAccess: 'Apex Classes, Visualforce Pages, Apps and Custom Permissions',
  tabSettings: 'Tab Settings',
  systemPermissions: 'System Permissions',
};

const OBJECT_PERMISSION_FIELDS = [
  'SobjectType',
  'PermissionsCreate',
  'PermissionsRead',
  'PermissionsEdit',
  'PermissionsDelete',
  'PermissionsViewAllRecords',
  'PermissionsModifyAllRecords',
  'PermissionsViewAllFields',
];
const FIELD_PERMISSION_FIELDS = ['SobjectType', 'Field', 'PermissionsRead', 'PermissionsEdit'];
const SETUP_ENTITY_ACCESS_FIELDS = ['SetupEntityId'];
const TAB_SETTING_FIELDS = ['Name', 'Visibility'];

/**
 * Options for the clone source picker, grouped and sorted by label. Unlike the selection lists, the API Name gets its own
 * line and a managed permission set's source goes on a third line, so neither is crammed beside the label.
 */
export function getCloneSourceGroups(
  profiles: ListItem<string, PermissionSetWithProfileRecord>[],
  permissionSets: ListItem<string, PermissionSetNoProfileRecord>[],
  managedPermissionSets: ListItem<string, PermissionSetNoProfileRecord>[],
): ListItemGroup[] {
  const sortByLabel = (items: ListItem[]) => [...items].sort((a, b) => a.label.localeCompare(b.label));
  const toPermissionSetItem = ({ id, label, value, meta }: ListItem<string, PermissionSetNoProfileRecord>): ListItem => ({
    id,
    label,
    value,
    meta,
    secondaryLabel: meta?.Name,
    secondaryLabelOnNewLine: true,
  });
  return [
    { id: 'PermissionSet', label: 'Permission Sets', items: sortByLabel(permissionSets.map(toPermissionSetItem)) },
    {
      id: 'ManagedPermissionSet',
      label: 'Managed Permission Sets',
      items: sortByLabel(
        managedPermissionSets.map((item) => ({
          ...toPermissionSetItem(item),
          tertiaryLabel: isSalesforceProvidedPermissionSet(item.meta)
            ? 'Provided by Salesforce'
            : `Managed package: ${item.meta?.NamespacePrefix}`,
        })),
      ),
    },
    {
      id: 'Profile',
      label: 'Profiles',
      items: sortByLabel(profiles.map((item) => ({ ...item, secondaryLabelOnNewLine: true }))),
    },
  ].filter(({ items }) => items.length > 0);
}

/**
 * Same rules Salesforce applies to the API Name it suggests in Setup, without the `__c` suffix custom objects use
 */
export function generatePermissionSetApiName(label: string): string {
  if (!label) {
    return '';
  }
  let apiName = label
    .replace(REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE, '_')
    .replace(REGEX.STARTS_WITH_UNDERSCORE, '')
    .replace(REGEX.CONSECUTIVE_UNDERSCORES, '_')
    .replace(REGEX.ENDS_WITH_NON_ALPHANUMERIC, '');
  if (REGEX.STARTS_WITH_NUMBER.test(apiName)) {
    apiName = `X${apiName}`;
  }
  return apiName.substring(0, PERMISSION_SET_NAME_MAX_LENGTH).replace(REGEX.ENDS_WITH_NON_ALPHANUMERIC, '');
}

/**
 * Salesforce requires the API Name to begin with a letter, contain only letters, numbers and single underscores,
 * and not end with an underscore.
 */
export function isValidPermissionSetApiName(name: string): boolean {
  return /^[A-Za-z](?!.*__)[A-Za-z0-9_]*$/.test(name) && !name.endsWith('_') && name.length <= PERMISSION_SET_NAME_MAX_LENGTH;
}

export async function fetchPermissionSetLicenses(org: SalesforceOrgUi): Promise<PermissionSetLicenseOption[]> {
  const [userLicenses, permissionSetLicenses] = await Promise.all([
    queryAll<{ Id: string; Name: string }>(org, `SELECT Id, Name FROM UserLicense WHERE Status = 'Active' ORDER BY Name`),
    queryAll<{ Id: string; MasterLabel: string }>(
      org,
      `SELECT Id, MasterLabel FROM PermissionSetLicense WHERE Status = 'Active' ORDER BY MasterLabel`,
    ),
  ]);
  return [
    ...userLicenses.queryResults.records.map(({ Id, Name }): PermissionSetLicenseOption => ({ id: Id, label: Name, type: 'UserLicense' })),
    ...permissionSetLicenses.queryResults.records.map(({ Id, MasterLabel }): PermissionSetLicenseOption => ({
      id: Id,
      label: MasterLabel,
      type: 'PermissionSetLicense',
    })),
  ];
}

export async function fetchCloneSourceDetails(org: SalesforceOrgUi, permissionSetId: string): Promise<PermissionSetCloneSourceDetails> {
  const results = await queryAll<{ Id: string; LicenseId: string | null; HasActivationRequired: boolean; Description: string | null }>(
    org,
    composeQuery({
      fields: [getField('Id'), getField('LicenseId'), getField('HasActivationRequired'), getField('Description')],
      sObject: 'PermissionSet',
      where: { left: { field: 'Id', operator: '=', value: permissionSetId, literalType: 'STRING' } },
    }),
  );
  const [record] = results.queryResults.records;
  if (!record) {
    throw new Error('The selected profile or permission set could not be found');
  }
  return {
    id: record.Id,
    licenseId: record.LicenseId,
    hasActivationRequired: !!record.HasActivationRequired,
    description: record.Description,
  };
}

/**
 * Create a permission set, optionally copying every permission from an existing profile or permission set.
 *
 * Throws if the permission set itself cannot be created. Once it exists, failures copying individual permissions
 * are reported in `cloneSteps` instead of thrown so the user can see exactly what did not carry over.
 */
export async function createPermissionSet(
  org: SalesforceOrgUi,
  input: PermissionSetCreateInput,
  cloneFromPermissionSetId?: string | null,
  onProgress?: (message: string) => void,
): Promise<PermissionSetCreateResult> {
  let sourceRecords: CloneSourceRecords | null = null;
  if (cloneFromPermissionSetId) {
    onProgress?.('Reading permissions to clone');
    sourceRecords = await fetchCloneSourceRecords(org, cloneFromPermissionSetId);
  }

  onProgress?.('Creating permission set');
  // System permissions are applied last - many depend on object permissions that do not exist yet
  const [createResult] = (await sobjectOperation(
    org,
    'PermissionSet',
    'create',
    {
      records: [
        {
          attributes: { type: 'PermissionSet' },
          Label: input.label,
          Name: input.name,
          Description: input.description || null,
          LicenseId: input.licenseId || null,
          HasActivationRequired: input.hasActivationRequired,
        },
      ],
    },
    { allOrNone: true },
  )) as RecordResult[];

  if (!createResult?.success) {
    throw new Error(getUniqueErrorMessages([createResult]).join(' ') || 'The permission set could not be created');
  }

  const permissionSetId = createResult.id;
  if (!sourceRecords) {
    return { id: permissionSetId, cloneSteps: [] };
  }

  const cloneSteps = await clonePermissions(org, permissionSetId, sourceRecords, onProgress);
  return { id: permissionSetId, cloneSteps };
}

async function fetchCloneSourceRecords(org: SalesforceOrgUi, sourceId: string): Promise<CloneSourceRecords> {
  // Bypass the describe cache - a stale cache would select columns that no longer exist and fail the whole query
  const describeResult = await describeSObject(org, 'PermissionSet', false, true);
  const systemPermissionFields = getSystemPermissionFieldsFromDescribe(describeResult.data.fields).map(({ name }) => name);

  const queryChildren = (sObject: string, fields: string[]) =>
    queryAll<CloneRecord>(
      org,
      composeQuery({
        fields: fields.map((field) => getField(field)),
        sObject,
        where: { left: { field: 'ParentId', operator: '=', value: sourceId, literalType: 'STRING' } },
      }),
    ).then(({ queryResults }) => queryResults.records.map((record) => pickFields(record, fields)));

  const [systemPermissionRecords, objectPermissions, fieldPermissions, setupEntityAccess, tabSettings] = await Promise.all([
    Promise.all(getQuerySystemPermissions([sourceId], systemPermissionFields).map((soql) => queryAll<CloneRecord>(org, soql))),
    queryChildren('ObjectPermissions', OBJECT_PERMISSION_FIELDS),
    queryChildren('FieldPermissions', FIELD_PERMISSION_FIELDS),
    queryChildren('SetupEntityAccess', SETUP_ENTITY_ACCESS_FIELDS),
    queryChildren('PermissionSetTabSetting', TAB_SETTING_FIELDS),
  ]);

  const sourceRecord = systemPermissionRecords.flatMap(({ queryResults }) => queryResults.records)[0] || {};
  const enabledSystemPermissions = systemPermissionFields.reduce((output: Record<string, true>, field) => {
    if (sourceRecord[field] === true) {
      output[field] = true;
    }
    return output;
  }, {});

  return { enabledSystemPermissions, objectPermissions, fieldPermissions, setupEntityAccess, tabSettings };
}

async function clonePermissions(
  org: SalesforceOrgUi,
  permissionSetId: string,
  source: CloneSourceRecords,
  onProgress?: (message: string) => void,
): Promise<PermissionSetCloneStepResult[]> {
  const withParent = (records: CloneRecord[]) => records.map((record) => ({ ...record, ParentId: permissionSetId }));

  // Field permissions require read access on the object, so object permissions must exist first
  onProgress?.('Copying object permissions');
  const objectPermissions = await insertObjectPermissions(org, withParent(source.objectPermissions));

  onProgress?.('Copying field, tab, app, Apex and Visualforce permissions');
  const [fieldPermissions, setupEntityAccess, tabSettings] = await Promise.all([
    insertRecords(org, 'FieldPermissions', withParent(source.fieldPermissions)),
    insertRecords(org, 'SetupEntityAccess', withParent(source.setupEntityAccess)),
    insertRecords(org, 'PermissionSetTabSetting', withParent(source.tabSettings)),
  ]);

  onProgress?.('Copying system permissions');
  const systemPermissions = await updateSystemPermissions(org, permissionSetId, source.enabledSystemPermissions);

  return [
    getStepResult('objectPermissions', source.objectPermissions.length, objectPermissions),
    getStepResult('fieldPermissions', source.fieldPermissions.length, fieldPermissions),
    getStepResult('setupEntityAccess', source.setupEntityAccess.length, setupEntityAccess),
    getStepResult('tabSettings', source.tabSettings.length, tabSettings),
    getStepResult('systemPermissions', Object.keys(source.enabledSystemPermissions).length, systemPermissions),
  ];
}

/**
 * Some object permissions depend on read access to another object (e.g. DevopsPipeline requires SourceCodeRepository).
 * Records are inserted in parallel batches, so the dependency may not exist yet - retry failures while progress is made.
 */
async function insertObjectPermissions(org: SalesforceOrgUi, records: CloneRecord[]): Promise<ErrorResult[]> {
  let pending = records;
  let failures: ErrorResult[] = [];
  for (let attempt = 0; attempt < MAX_OBJECT_PERMISSION_ATTEMPTS && pending.length; attempt++) {
    const results = await insertRecordsWithResults(org, 'ObjectPermissions', pending);
    const failedIndexes = results.flatMap((result, i) => (result.success ? [] : [i]));
    const madeProgress = failedIndexes.length < pending.length;
    failures = failedIndexes.map((i) => results[i] as ErrorResult);
    pending = failedIndexes.map((i) => pending[i]);
    if (!madeProgress) {
      break;
    }
  }
  return failures;
}

async function insertRecords(org: SalesforceOrgUi, sobject: string, records: CloneRecord[]): Promise<ErrorResult[]> {
  const results = await insertRecordsWithResults(org, sobject, records);
  return results.filter((result): result is ErrorResult => !result.success && !isDuplicateError(result));
}

async function insertRecordsWithResults(org: SalesforceOrgUi, sobject: string, records: CloneRecord[]): Promise<RecordResult[]> {
  if (!records.length) {
    return [];
  }
  const results = await Promise.all(
    splitArrayToMaxSize(records, MAX_RECORDS_PER_REQUEST).map((chunk) =>
      sobjectOperation(
        org,
        sobject,
        'create',
        { records: chunk.map((record) => ({ attributes: { type: sobject }, ...record })) },
        { allOrNone: false },
      ).catch((ex): RecordResult[] =>
        // a failed request should not lose the results of the other batches
        chunk.map(() => getRequestFailedResult(ex)),
      ),
    ),
  );
  return (results as RecordResult[][]).flat();
}

/**
 * Activity fields (e.g. Task.Description) are shared with Event, so Salesforce creates both when one is inserted
 * and rejects the second as a duplicate - the permission was still copied.
 */
function isDuplicateError(result: ErrorResult): boolean {
  return result.errors.every(({ statusCode }) => statusCode === 'DUPLICATE_VALUE');
}

/**
 * System permissions are written in one update, which Salesforce rejects entirely if any single permission is not
 * allowed (e.g. a profile-only permission, or one the chosen license does not include). When that happens, split the
 * fields in half until only the rejected permissions are left so everything else still carries over.
 */
async function updateSystemPermissions(
  org: SalesforceOrgUi,
  permissionSetId: string,
  enabledSystemPermissions: Record<string, true>,
): Promise<ErrorResult[]> {
  const applyPermissions = async (fields: string[]): Promise<{ field: string; error: ErrorResult }[]> => {
    if (!fields.length) {
      return [];
    }
    const result = await updatePermissionSet(org, permissionSetId, fields);
    if (result.success) {
      return [];
    }
    if (fields.length === 1) {
      return [{ field: fields[0], error: result }];
    }
    const midpoint = Math.ceil(fields.length / 2);
    const firstHalfFailures = await applyPermissions(fields.slice(0, midpoint));
    const secondHalfFailures = await applyPermissions(fields.slice(midpoint));
    return [...firstHalfFailures, ...secondHalfFailures];
  };

  const allFields = Object.keys(enabledSystemPermissions);
  let failures = await applyPermissions(allFields);
  // A permission can depend on another that was in the half applied after it, so give the rejected ones one more try
  if (failures.length && failures.length < allFields.length) {
    failures = await applyPermissions(failures.map(({ field }) => field));
  }
  return failures.map(({ error }) => error);
}

async function updatePermissionSet(org: SalesforceOrgUi, permissionSetId: string, fields: string[]): Promise<RecordResult> {
  try {
    const record: CloneRecord = { attributes: { type: 'PermissionSet' }, Id: permissionSetId };
    fields.forEach((field) => (record[field] = true));
    const [result] = (await sobjectOperation(
      org,
      'PermissionSet',
      'update',
      { records: [record] },
      { allOrNone: false },
    )) as RecordResult[];
    return result || getRequestFailedResult(new Error('No response from Salesforce'));
  } catch (ex) {
    logger.warn('[createPermissionSet] system permission update failed', ex);
    return getRequestFailedResult(ex);
  }
}

function getRequestFailedResult(ex: unknown): ErrorResult {
  return { success: false, errors: [{ fields: [], message: (ex as Error)?.message || 'Request failed', statusCode: 'UNKNOWN' }] };
}

function getStepResult(key: PermissionSetCloneStepKey, total: number, failures: ErrorResult[]): PermissionSetCloneStepResult {
  const errorCounts = new Map<string, number>();
  failures.forEach((failure) => {
    const message = failure.errors.map(({ message }) => message).join(' ') || 'Unknown error';
    errorCounts.set(message, (errorCounts.get(message) || 0) + 1);
  });
  return {
    key,
    label: CLONE_STEP_LABELS[key],
    total,
    failed: failures.length,
    errors: Array.from(errorCounts.entries()).map(([message, count]) => ({ message, count })),
  };
}

function getUniqueErrorMessages(results: (RecordResult | undefined)[]): string[] {
  return Array.from(new Set(results.flatMap((result) => (result && !result.success ? result.errors.map(({ message }) => message) : []))));
}

function pickFields(record: CloneRecord, fields: string[]): CloneRecord {
  return fields.reduce((output: CloneRecord, field) => {
    output[field] = record[field];
    return output;
  }, {});
}

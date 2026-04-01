import { logger } from '@jetstream/shared/client-logger';
import { describeSObject, query, queryAll, readMetadata } from '@jetstream/shared/data';
import { groupByFlat } from '@jetstream/shared/utils';
import {
  Field,
  FieldType,
  Maybe,
  PermissionSetMetadataRecord,
  ProfileMetadataRecord,
  QueryResultsColumn,
  QueryResultsColumns,
  SalesforceOrgUi,
} from '@jetstream/types';
import type {
  ExtractedFields,
  FieldSchema,
  FormulaContext,
  FormulaRecord,
  FormulaReturnType,
  FormulaValue,
  SfTime,
} from '@jetstreamapp/sf-formula-parser';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import lodashGet from 'lodash/get';
import lodashSet from 'lodash/set';
import { ManualFormulaFieldType, ManualFormulaRecord } from '../create-fields/create-fields-types';

const MATCH_FORMULA_SPECIAL_PREFIX = /^\$[a-zA-Z]+\./;

const FIELD_TYPE_TO_RETURN_TYPE: Partial<Record<FieldType, FormulaReturnType>> = {
  string: 'string',
  textarea: 'string',
  phone: 'string',
  url: 'string',
  email: 'string',
  picklist: 'string',
  multipicklist: 'string',
  encryptedstring: 'string',
  id: 'string',
  reference: 'string',
  combobox: 'string',
  boolean: 'boolean',
  int: 'number',
  double: 'number',
  currency: 'number',
  percent: 'number',
  date: 'date',
  datetime: 'datetime',
  time: 'time',
};

/** Map a Salesforce field type to a formula return type for the returnType option. */
export function fieldTypeToReturnType(fieldType: FieldType): FormulaReturnType | null {
  return FIELD_TYPE_TO_RETURN_TYPE[fieldType] ?? null;
}

/** The global variable keys that map to describable SObjects. */
const GLOBAL_SOBJECT_MAP: Record<string, string> = {
  $User: 'User',
  $Organization: 'Organization',
  $Profile: 'Profile',
  $UserRole: 'UserRole',
};

/**
 * Convert a SOQL query result value to a FormulaValue based on column type.
 * Dates and times need explicit conversion from ISO strings; everything else passes through.
 */
function convertQueryValue(col: QueryResultsColumn, value: unknown): FormulaValue {
  if (value == null) {
    return null;
  }
  if (col.apexType === 'Date' && typeof value === 'string') {
    return startOfDay(parseISO(value));
  }
  if (col.apexType === 'Datetime' && typeof value === 'string') {
    return parseISO(value);
  }
  if (col.apexType === 'Time' && typeof value === 'string') {
    return parseSfTime(value);
  }
  return value as FormulaValue;
}

/**
 * Convert a manually-provided field value based on its Salesforce field type.
 */
function convertManualValue(fieldType: ManualFormulaFieldType, value: unknown): FormulaValue {
  if (value == null) {
    return null;
  }
  if (fieldType === 'date' && typeof value === 'string') {
    return startOfDay(parseISO(value));
  }
  if (fieldType === 'datetime' && typeof value === 'string') {
    return parseISO(value);
  }
  if (fieldType === 'time' && typeof value === 'string') {
    return parseSfTime(value);
  }
  return value as FormulaValue;
}

/** Parse a Salesforce time string (HH:mm:ss.SSS[Z]) to an SfTime object */
function parseSfTime(value: string): SfTime {
  const parts = value.split(':');
  const hours = Number(parts[0] || 0);
  const minutes = Number(parts[1] || 0);
  const secondsParts = (parts[2] || '0').split('.');
  const seconds = Number((secondsParts[0] || '0').replace(/\D/g, '') || 0);
  const fractionDigits = (secondsParts[1] || '').replace(/\D/g, '');
  const ms = fractionDigits ? Number((fractionDigits + '000').slice(0, 3)) : 0;
  return { timeInMillis: (hours * 3600 + minutes * 60 + seconds) * 1000 + ms };
}

interface FormulaDataProps {
  selectedOrg: SalesforceOrgUi;
  selectedUserId: string;
  categorizedFields: ExtractedFields;
  /**
   * If recordId is provided, the record will be queried from the org.
   * In this case, type can be omitted, if provided it should be 'QUERY_RECORD'.
   */
  type?: 'QUERY_RECORD';
  recordId: string;
  record?: never;
  sobjectName: string;
}

interface FormulaDataProvidedRecordProps {
  selectedOrg: SalesforceOrgUi;
  selectedUserId: string;
  categorizedFields: ExtractedFields;
  /**
   * If record is provided, the record will be used directly instead of querying from the org.
   */
  type: 'PROVIDED_RECORD';
  recordId?: never;
  record: ManualFormulaRecord;
  sobjectName: string;
}

export async function getFormulaData({
  selectedOrg,
  selectedUserId,
  categorizedFields,
  type = 'QUERY_RECORD',
  recordId,
  record,
  sobjectName,
}: FormulaDataProps | FormulaDataProvidedRecordProps): Promise<
  | { type: 'error'; message: string }
  | { type: 'success'; context: FormulaContext; schema: Record<string, FieldSchema[]>; warnings: { type: string; message: string }[] }
> {
  try {
    const formulaRecord: FormulaRecord = {};
    const globals: Record<string, FormulaRecord> = {};
    const warnings: { type: string; message: string }[] = [];
    const schema: Record<string, FieldSchema[]> = {};

    const { objectFields, globals: globalFields, customMetadata, customLabels, customSettings, customPermissions } = categorizedFields;

    const userFields = globalFields['$User'] || [];
    const organizationFields = globalFields['$Organization'] || [];
    const profileFields = globalFields['$Profile'] || [];
    const userRoleFields = globalFields['$UserRole'] || [];
    const apiFields = globalFields['$Api'] || [];
    const systemFields = globalFields['$System'] || [];

    // Collect schema metadata for the root SObject and any related/global objects
    await collectSchema({ selectedOrg, sobjectName, objectFields, globalFields, schema });

    if (type === 'QUERY_RECORD' && recordId) {
      await collectBaseQueriedRecordFields({ selectedOrg, fields: objectFields, recordId, sobjectName, output: formulaRecord });
    } else {
      collectBaseRecordFields({ fields: objectFields, manualRecord: record || {}, output: formulaRecord });
    }

    collectApiFields({ selectedOrg, fields: apiFields, globals });
    await collectCustomMetadata({ selectedOrg, fields: customMetadata, globals });
    await collectCustomSettingFields({ selectedOrg, selectedUserId, fields: customSettings, globals });
    await collectCustomPermissions({ selectedOrg, selectedUserId, fields: customPermissions, globals });
    await collectLabels({ selectedOrg, fields: customLabels, globals });
    await collectOrganizationFields({ selectedOrg, fields: organizationFields, globals });
    await collectUserProfileAndRoleFields({
      selectedOrg,
      selectedUserId,
      userFields,
      profileFields,
      roleFields: userRoleFields,
      globals,
    });
    collectSystemFields({ fields: systemFields, globals });

    const context: FormulaContext = { record: formulaRecord };
    if (Object.keys(globals).length) {
      context.globals = globals;
    }

    logger.log({ context, schema, warnings });

    return { type: 'success', context, schema, warnings };
  } catch (ex) {
    logger.error(ex);
    throw ex;
  }
}

/**
 * Collect schema metadata for the root SObject, any related objects referenced in objectFields,
 * and any global variables ($User, $Organization, etc.) referenced in globalFields.
 *
 * The schema map uses '$record' for the root object, relationship names for related objects,
 * and '$'-prefixed names for globals — matching the sf-formula-parser SchemaInput format.
 */
async function collectSchema({
  selectedOrg,
  sobjectName,
  objectFields,
  globalFields,
  schema,
}: {
  selectedOrg: SalesforceOrgUi;
  sobjectName: string;
  objectFields: string[];
  globalFields: Record<string, string[]>;
  schema: Record<string, FieldSchema[]>;
}) {
  const describeCache: Record<string, Field[]> = {};

  async function describeFields(sObjectName: string): Promise<Field[]> {
    if (describeCache[sObjectName]) {
      return describeCache[sObjectName];
    }
    try {
      const { data } = await describeSObject(selectedOrg, sObjectName);
      describeCache[sObjectName] = data.fields;
      return data.fields;
    } catch (ex) {
      logger.warn(`Could not describe ${sObjectName} for schema validation`, ex);
      return [];
    }
  }

  // Root SObject — always describe so we can validate direct field references
  const rootFields = await describeFields(sobjectName);
  if (rootFields.length) {
    schema['$record'] = rootFields;
  }

  // Related objects referenced via dot-notation in objectFields (e.g. "Account.Name", "Owner.Profile.Name")
  const relationshipNames = new Set<string>();
  for (const field of objectFields) {
    const dotIndex = field.indexOf('.');
    if (dotIndex > -1) {
      relationshipNames.add(field.substring(0, dotIndex));
    }
  }

  for (const relationshipName of relationshipNames) {
    const relField = rootFields.find(
      (field) => field.relationshipName && field.relationshipName.toLowerCase() === relationshipName.toLowerCase(),
    );
    if (relField?.referenceTo?.length) {
      const relatedFields = await describeFields(relField.referenceTo[0]);
      if (relatedFields.length) {
        schema[relationshipName] = relatedFields;
      }
    }
  }

  // Global variables that map to describable SObjects
  for (const [globalKey, sObjectName] of Object.entries(GLOBAL_SOBJECT_MAP)) {
    if (globalFields[globalKey]?.length) {
      const fields = await describeFields(sObjectName);
      if (fields.length) {
        schema[globalKey] = fields;
      }
    }
  }
}

async function collectBaseQueriedRecordFields({
  selectedOrg,
  fields,
  recordId,
  sobjectName,
  output,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  recordId: string;
  sobjectName: string;
  output: FormulaRecord;
}) {
  if (!fields.length) {
    return;
  }

  const { queryResults, columns } = await query(
    selectedOrg,
    composeQuery({
      fields: fields.map(getField),
      sObject: sobjectName,
      where: {
        left: {
          field: 'Id',
          operator: '=',
          value: recordId,
          literalType: 'STRING',
        },
      },
    }),
  );

  if (!queryResults.totalSize) {
    throw new Error(`A record with Id ${recordId} was not found.`);
  }

  const fieldsByName = getFieldsByName(columns);

  output['Id'] = recordId;
  fields.forEach((field) => {
    const column = fieldsByName[field.toLowerCase()];
    if (!column) {
      throw new Error(`Field ${field} does not exist on ${sobjectName}.`);
    }
    lodashSet(output, field, convertQueryValue(column, lodashGet(queryResults.records[0], column.columnFullPath)));
  });
}

function collectBaseRecordFields({
  fields,
  manualRecord,
  output,
}: {
  fields: string[];
  manualRecord: ManualFormulaRecord;
  output: FormulaRecord;
}) {
  if (!fields.length) {
    return;
  }

  fields.forEach((field) => {
    const recordValue = manualRecord[field];
    if (!recordValue) {
      throw new Error(`Field ${field} does not exist in provided record data.`);
    }
    output[field] = convertManualValue(recordValue.type, recordValue.value);
  });
}

function collectApiFields({
  selectedOrg,
  fields,
  globals,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  globals: Record<string, FormulaRecord>;
}) {
  if (!fields.length) {
    return;
  }

  const apiGlobals: FormulaRecord = {};
  fields.forEach((fieldWithIdentifier) => {
    const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_PREFIX, '');
    let value: string;
    if (field.toLowerCase() === 'session_id') {
      value = '*****';
    } else {
      // Output: https://foo-dev-ed.my.salesforce.com/services/Soap/u/56.0/00D500000004712
      const apiVersion = field.split('_').reverse()[0];
      value = `${selectedOrg.instanceUrl}/services/Soap/u/${apiVersion.substring(
        0,
        apiVersion.length - 1,
      )}.0/${selectedOrg.organizationId.substring(0, 15)}`;
    }
    apiGlobals[field] = value;
  });
  globals['$Api'] = apiGlobals;
}

async function collectCustomMetadata({
  selectedOrg,
  fields,
  globals,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  globals: Record<string, FormulaRecord>;
}) {
  if (!fields.length) {
    return;
  }

  const data = fields.reduce(
    (
      output: Record<
        string,
        { object: string; records: Record<string, { record: string; fields: { field: string; fullField: string }[] }> }
      >,
      fullField,
    ) => {
      const [, object, record, field] = fullField.split('.');
      output[object] = output[object] || { object, records: {} };
      output[object].records[record] = output[object].records[record] || { record, fields: [] };
      output[object].records[record].fields.push({ field, fullField });
      return output;
    },
    {},
  );

  const customMetadataGlobals: FormulaRecord = {};

  for (const metadataObject of Object.keys(data)) {
    const { records } = data[metadataObject];
    const { queryResults, columns } = await query(
      selectedOrg,
      composeQuery({
        fields: [{ type: 'FieldFunctionExpression', functionName: 'FIELDS', parameters: ['ALL'], rawValue: 'FIELDS(ALL)' }],
        sObject: metadataObject,
        where: {
          left: {
            field: 'QualifiedApiName',
            operator: 'IN',
            value: Object.keys(records),
            literalType: 'STRING',
          },
        },
        limit: 200,
      }),
    );

    const fieldsByName = getFieldsByName(columns);
    const recordsByApiName = getRecordsByLowercaseField(queryResults.records, 'QualifiedApiName');

    // Build nested structure: Type__mdt → Record → Field__c
    const objectRecord: FormulaRecord = {};
    Object.values(records).forEach(({ fields, record }) => {
      const metadataRecord = recordsByApiName[record.toLowerCase()];
      const recordFields: FormulaRecord = {};
      fields.forEach(({ field }) => {
        const column = fieldsByName[field.toLowerCase()];
        if (!column) {
          throw new Error(`Field ${field} does not exist on ${metadataObject}.`);
        }
        recordFields[field] = convertQueryValue(column, lodashGet(metadataRecord, column.columnFullPath));
      });
      objectRecord[record] = recordFields;
    });
    customMetadataGlobals[metadataObject] = objectRecord;
  }

  globals['$CustomMetadata'] = customMetadataGlobals;
}

async function collectLabels({
  selectedOrg,
  fields,
  globals,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  globals: Record<string, FormulaRecord>;
}) {
  if (!fields.length) {
    return;
  }

  const { queryResults } = await query(
    selectedOrg,
    composeQuery({
      fields: [getField('Name'), getField('Value')],
      sObject: 'ExternalString',
      where: {
        left: {
          field: 'Name',
          operator: 'IN',
          value: fields.map((field) => field.split('.')[1]),
          literalType: 'STRING',
        },
      },
      limit: 200,
    }),
    true,
  );

  const recordsByApiName = getRecordsByLowercaseField(queryResults.records, 'Name');
  const labelGlobals: FormulaRecord = {};

  fields.forEach((fieldWithIdentifier) => {
    const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_PREFIX, '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> | undefined = recordsByApiName[field.toLowerCase()];
    labelGlobals[field] = record?.Value || '';
  });

  globals['$Label'] = labelGlobals;
}

async function collectOrganizationFields({
  selectedOrg,
  fields,
  globals,
}: {
  selectedOrg: SalesforceOrgUi;
  fields: string[];
  globals: Record<string, FormulaRecord>;
}) {
  if (!fields.length) {
    return;
  }

  const { queryResults, columns } = await query(
    selectedOrg,
    composeQuery({
      fields: [{ type: 'FieldFunctionExpression', functionName: 'FIELDS', parameters: ['ALL'], rawValue: 'FIELDS(ALL)' }],
      sObject: 'Organization',
      limit: 1,
    }),
  );

  const fieldsByName = getFieldsByName(columns);
  const orgGlobals: FormulaRecord = {};

  fields.forEach((fieldWithIdentifier) => {
    const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_PREFIX, '');
    const column = fieldsByName[field.toLowerCase()];
    if (!column) {
      throw new Error(`Invalid Organization field in formula: ${field}`);
    }
    orgGlobals[field] = convertQueryValue(column, lodashGet(queryResults.records[0], column.columnFullPath));
  });

  globals['$Organization'] = orgGlobals;
}

async function collectUserProfileAndRoleFields({
  selectedOrg,
  selectedUserId,
  userFields,
  profileFields,
  roleFields,
  globals,
}: {
  selectedOrg: SalesforceOrgUi;
  selectedUserId: string;
  userFields: string[];
  profileFields: string[];
  roleFields: string[];
  globals: Record<string, FormulaRecord>;
}) {
  if (!userFields.length && !profileFields.length && !roleFields.length) {
    return;
  }

  const { queryResults, columns } = await query(
    selectedOrg,
    composeQuery({
      fields: Array.from(
        new Set([
          getField('Id'),
          ...userFields.map((field) => getField(field.split('.')[1])),
          getField('Profile.Id'),
          ...profileFields.map((field) => getField(`Profile.${field.split('.')[1]}`)),
          getField('UserRole.Id'),
          ...roleFields.map((field) => getField(`UserRole.${field.split('.')[1]}`)),
        ]),
      ),
      sObject: 'User',
      where: {
        left: {
          field: 'Id',
          value: selectedUserId,
          operator: '=',
          literalType: 'STRING',
        },
      },
      limit: 1,
    }),
  );

  const { Profile, UserRole, ...User } = queryResults.records[0];
  const fieldsByName = getFieldsByName(columns);

  if (userFields.length) {
    const userGlobals: FormulaRecord = {};
    userFields.forEach((fieldWithIdentifier) => {
      const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_PREFIX, '');
      const column = fieldsByName[field.toLowerCase()];
      if (!column) {
        throw new Error(`Invalid User field in formula: ${field}`);
      }
      userGlobals[field] = convertQueryValue(column, lodashGet(User, column.columnName));
    });
    globals['$User'] = userGlobals;
  }

  if (profileFields.length) {
    const profileGlobals: FormulaRecord = {};
    profileFields.forEach((fieldWithIdentifier) => {
      const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_PREFIX, '');
      const column = fieldsByName[`profile.${field.toLowerCase()}`];
      if (!column) {
        throw new Error(`Invalid Profile field in formula: ${field}`);
      }
      profileGlobals[field] = convertQueryValue(column, lodashGet(Profile, column.columnName));
    });
    globals['$Profile'] = profileGlobals;
  }

  if (roleFields.length) {
    const roleGlobals: FormulaRecord = {};
    roleFields.forEach((fieldWithIdentifier) => {
      const field = fieldWithIdentifier.replace(MATCH_FORMULA_SPECIAL_PREFIX, '');
      const column = fieldsByName[`userrole.${field.toLowerCase()}`];
      if (!column) {
        throw new Error(`Invalid UserRole field in formula: ${field}`);
      }
      roleGlobals[field] = convertQueryValue(column, lodashGet(UserRole, column.columnName));
    });
    globals['$UserRole'] = roleGlobals;
  }
}

/**
 * Fetch all assigned permission sets (which also include the user's profile),
 * read metadata for each assigned permission set,
 * get all the customPermissions assigned to the profile/permission sets,
 * and compare with the formula's custom permission.
 */
async function collectCustomPermissions({
  selectedOrg,
  selectedUserId,
  fields,
  globals,
}: {
  selectedOrg: SalesforceOrgUi;
  selectedUserId: string;
  fields: string[];
  globals: Record<string, FormulaRecord>;
}) {
  if (!fields.length) {
    return;
  }

  // Get all assigned permission sets and assigned profile
  const { queryResults } = await queryAll<{
    Id: string;
    PermissionSetId: string;
    PermissionSet:
      | { Name: string; IsOwnedByProfile: true; Profile: { Name: string } }
      | { Name: string; IsOwnedByProfile: false; Profile: undefined };
  }>(
    selectedOrg,
    composeQuery({
      fields: Array.from(
        new Set([
          getField('Id'),
          getField('PermissionSetId'),
          getField('PermissionSet.Name'),
          getField('PermissionSet.IsOwnedByProfile'),
          getField('PermissionSet.Profile.Name'),
        ]),
      ),
      sObject: 'PermissionSetAssignment',
      where: {
        left: { field: 'AssigneeId', value: selectedUserId, operator: '=', literalType: 'STRING' },
        operator: 'AND',
        right: {
          left: { field: 'IsActive', value: 'TRUE', operator: '=', literalType: 'BOOLEAN' },
          operator: 'AND',
          right: {
            left: { field: 'IsRevoked', value: 'FALSE', operator: '=', literalType: 'BOOLEAN' },
          },
        },
      },
    }),
  );

  // Fetch metadata for assigned profile and all assigned permission sets
  const permissionSetNames = queryResults.records
    .filter((item) => !item.PermissionSet.IsOwnedByProfile)
    .map(({ PermissionSet }) => encodeURIComponent(PermissionSet.Name));

  const profileMetadata = await readMetadata<ProfileMetadataRecord>(
    selectedOrg,
    'Profile',
    queryResults.records
      .filter((item) => item.PermissionSet.IsOwnedByProfile)
      .map(({ PermissionSet }) => encodeURIComponent(PermissionSet.Profile?.Name || '')),
  );
  const permissionSets = permissionSetNames.length
    ? await readMetadata<PermissionSetMetadataRecord>(selectedOrg, 'PermissionSet', permissionSetNames)
    : [];

  // Get all custom permissions assigned to profile and permission sets
  const customPermissions = new Set(
    [...profileMetadata, ...permissionSets].flatMap((item) => {
      // readMetadata sometimes returns objects instead of array because of XML parsing
      let customPermissions = item.customPermissions || [];
      if (!Array.isArray(customPermissions)) {
        customPermissions = [customPermissions];
      }
      return customPermissions.filter(({ enabled }) => enabled).map(({ name }) => name);
    }),
  );

  // Calculate if custom permission is enabled
  const permissionGlobals: FormulaRecord = {};
  fields.forEach((field) => {
    const permissionName = field.split('.')[1];
    permissionGlobals[permissionName] = customPermissions.has(permissionName);
  });
  globals['$Permission'] = permissionGlobals;
}

async function collectCustomSettingFields({
  selectedOrg,
  selectedUserId,
  fields,
  globals,
}: {
  selectedOrg: SalesforceOrgUi;
  selectedUserId: string;
  fields: string[];
  globals: Record<string, FormulaRecord>;
}) {
  if (!fields.length) {
    return;
  }

  const { queryResults: userQueryResults } = await query(
    selectedOrg,
    composeQuery({
      fields: Array.from(new Set([getField('Id'), getField('ProfileId')])),
      sObject: 'User',
      where: {
        left: {
          field: 'Id',
          value: selectedUserId,
          operator: '=',
          literalType: 'STRING',
        },
      },
      limit: 1,
    }),
  );

  const { Id, ProfileId } = userQueryResults.records[0];

  const data = fields.reduce((output: Record<string, { object: string; fields: { field: string; fullField: string }[] }>, fullField) => {
    const [, object, field] = fullField.split('.');
    output[object] = output[object] || { object, fields: [] };
    output[object].fields.push({ field, fullField });
    return output;
  }, {});

  const setupGlobals: FormulaRecord = {};

  // Query each custom setting, apply hierarchy logic, and extract fields
  for (const customSettingObject of Object.keys(data)) {
    const { fields } = data[customSettingObject];
    const { queryResults, columns } = await query(
      selectedOrg,
      composeQuery({
        fields: [{ type: 'FieldFunctionExpression', functionName: 'FIELDS', parameters: ['ALL'], rawValue: 'FIELDS(ALL)' }],
        sObject: customSettingObject,
        where: {
          left: {
            field: 'SetupOwnerId',
            operator: 'IN',
            value: [Id, ProfileId, selectedOrg.organizationId],
            literalType: 'STRING',
          },
        },
        limit: 200,
      }),
    );

    const fieldsByName = getFieldsByName(columns);
    const recordsBySetupId = groupByFlat(queryResults.records, 'SetupOwnerId');
    const record = recordsBySetupId[Id] || recordsBySetupId[ProfileId] || recordsBySetupId[selectedOrg.organizationId];

    const settingRecord: FormulaRecord = {};
    fields.forEach(({ field }) => {
      const column = fieldsByName[field.toLowerCase()];
      if (!column) {
        throw new Error(`Invalid custom setting field in formula: ${customSettingObject}.${field}`);
      }
      settingRecord[field] = convertQueryValue(column, lodashGet(record, column.columnName));
    });
    setupGlobals[customSettingObject] = settingRecord;
  }

  globals['$Setup'] = setupGlobals;
}

function collectSystemFields({ fields, globals }: { fields: string[]; globals: Record<string, FormulaRecord> }) {
  if (!fields.length) {
    return;
  }
  globals['$System'] = { OriginDateTime: new Date(1900, 1, 1) };
}

/** Get columns by field name in lowercase */
function getFieldsByName(columns: Maybe<QueryResultsColumns>) {
  return (
    columns?.columns?.reduce((output: Record<string, QueryResultsColumn>, item) => {
      output[item.columnFullPath.toLowerCase()] = item;
      return output;
    }, {}) || {}
  );
}

function getRecordsByLowercaseField(records: Record<string, string>[], field: string): Record<string, Record<string, string>> {
  return records.reduce((output: Record<string, Record<string, string>>, record) => {
    output[record[field].toLowerCase()] = record;
    return output;
  }, {});
}

export const formulaFunctions = [
  'ABS',
  'ADDMONTHS',
  'AND',
  'ASCII',
  'BEGINS',
  'BLANKVALUE',
  'BR',
  'CASE',
  'CASESAFEID',
  'CEILING',
  'CHR',
  'CONTAINS',
  'DATE',
  'DATETIMEVALUE',
  'DATEVALUE',
  'DAY',
  'DAYOFYEAR',
  'DISTANCE',
  'EXP',
  'FIND',
  'FLOOR',
  'FROMUNIXTIME',
  'GEOLOCATION',
  'GETSESSIONID',
  'HOUR',
  'HTMLENCODE',
  'HYPERLINK',
  'IF',
  'IFERROR',
  'IFS',
  'IMAGE',
  'INCLUDES',
  'INITCAP',
  'ISBLANK',
  'ISCHANGED',
  'ISCLONE',
  'ISNEW',
  'ISNULL',
  'ISNUMBER',
  'ISPICKVAL',
  'JSENCODE',
  'JSINHTMLENCODE',
  'LEFT',
  'LEN',
  'LN',
  'LOG',
  'LOWER',
  'LPAD',
  'MAX',
  'MCEILING',
  'MFLOOR',
  'MID',
  'MILLISECOND',
  'MIN',
  'MINUTE',
  'MOD',
  'MONTH',
  'NOT',
  'NOW',
  'NULLVALUE',
  'OR',
  'PI',
  'POWER',
  'PRIORVALUE',
  'RAND',
  'REGEX',
  'RIGHT',
  'ROUND',
  'RPAD',
  'SECOND',
  'SQRT',
  'SUBSTITUTE',
  'TEXT',
  'TIMENOW',
  'TIMEVALUE',
  'TODAY',
  'TRIM',
  'TRUNC',
  'UNIXTIMESTAMP',
  'UPPER',
  'URLENCODE',
  'VALUE',
  'WEEKDAY',
  'YEAR',
] as const;

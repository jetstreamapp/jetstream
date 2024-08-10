import { logger } from '@jetstream/shared/client-logger';
import { describeSObject, genericRequest } from '@jetstream/shared/data';
import { REGEX, flattenRecords, groupByFlat, splitArrayToMaxSize } from '@jetstream/shared/utils';
import type {
  CompositeRequestBody,
  CompositeResponse,
  CopyAsDataType,
  DebugLevel,
  DescribeSObjectResult,
  DescribeSObjectResultWithExtendedField,
  Field,
  FieldWithExtendedType,
  FieldWrapper,
  Maybe,
  QueryFields,
  SalesforceOrgUi,
  UserTrace,
} from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import copyToClipboard from 'copy-to-clipboard';
import { addHours } from 'date-fns/addHours';
import { formatISO } from 'date-fns/formatISO';
import { unparse } from 'papaparse';
import {
  isRelationshipField,
  polyfillFieldDefinition,
  sortQueryFields,
  transformTabularDataToExcelStr,
  transformTabularDataToHtml,
} from './shared-ui-utils';

export function buildQuery(sObject: string, fields: string[]) {
  return composeQuery({ sObject, fields: fields.map((field) => getField(field)) }, { format: true });
}

export function getFieldKey(parentKey: string, field: Field) {
  return `${parentKey}${field.relationshipName}.`;
}

/**
 * Describe SObject with user-friendly type added in typeLabel property
 *
 * @param org
 * @param sobject
 */
export async function describeSObjectWithExtendedTypes(
  org: SalesforceOrgUi,
  sobject: string,
  isTooling = false
): Promise<DescribeSObjectResultWithExtendedField> {
  const { data: describeResults } = await describeSObject(org, sobject, isTooling);
  return convertDescribeToDescribeSObjectWithExtendedTypes(describeResults);
}

export function convertDescribeToDescribeSObjectWithExtendedTypes(
  describeResults: DescribeSObjectResult
): DescribeSObjectResultWithExtendedField {
  const isCustomMetadata = describeResults.name.endsWith('__mdt');
  const fields: FieldWithExtendedType[] = sortQueryFields(describeResults.fields).map((field: Field) => {
    const output = {
      ...field,
      typeLabel: polyfillFieldDefinition(field),
    };
    // Polyfill custom metadata relationship
    if (isCustomMetadata && field.extraTypeInfo === 'externallookup') {
      output.type = 'reference';
      output.referenceTo = ['EntityDefinition'];
      output.relationshipName = field.name.replace('__c', '__r');
    }
    return output;
  });
  return { ...describeResults, fields };
}

/**
 * Fetch fields and add to queryFields
 */
export async function fetchFields(
  org: SalesforceOrgUi,
  queryFields: QueryFields,
  parentKey: string,
  isTooling = false
): Promise<QueryFields> {
  const describeResults = await describeSObjectWithExtendedTypes(org, queryFields.sobject, isTooling);
  return fetchFieldsProcessResults(describeResults, queryFields, parentKey);
}

export function fetchFieldsProcessResults(
  describeResults: DescribeSObjectResultWithExtendedField,
  queryFields: QueryFields,
  parentKey: string
): QueryFields {
  const { sobject } = queryFields;

  const childRelationships = describeResults.childRelationships.filter((relationship) => !!relationship.relationshipName);
  const fields: Record<string, FieldWrapper> = groupByFlat(
    describeResults.fields.map((field: Field & { typeLabel: string }) => {
      const type = field.typeLabel;

      const filterText = `${field.name || ''}${field.label || ''}${type}${type.replace(REGEX.NOT_ALPHA, '')}`.toLowerCase();
      let relatedSobject: string | string[] | undefined = undefined;
      if (isRelationshipField(field) && field?.referenceTo?.length) {
        if (field.referenceTo.length === 1) {
          relatedSobject = field.referenceTo[0];
        } else {
          // if only two polymorphic fields exist and the second is user, reverse the order so that User is first as it is most commonly used
          if (field.referenceTo.length === 2 && field.referenceTo[1] === 'User') {
            relatedSobject = field.referenceTo.reverse();
          } else {
            relatedSobject = field.referenceTo;
          }
        }
      }

      return {
        name: field.name,
        label: field.label,
        type,
        sobject,
        relatedSobject,
        filterText,
        metadata: field,
        relationshipKey: isRelationshipField(field) ? getFieldKey(parentKey, field) : undefined,
      };
    }),
    'name'
  );

  return { ...queryFields, fields, visibleFields: new Set(Object.keys(fields)), childRelationships, metadata: describeResults };
}

/**
 * For the provided ids, fetch each record using the composite API
 * These are automatically split into sets of up to 25 records
 *
 * The referenceId is set to the recordId
 *
 * @param selectedOrg
 * @param metadataType
 * @param recordIds
 * @param fields
 * @param apiVersion
 */
export async function getToolingRecords<T>(
  selectedOrg: SalesforceOrgUi,
  metadataType: string,
  recordIds: string[],
  apiVersion: string,
  fields: string[] = ['Id', 'FullName', 'Metadata']
): Promise<CompositeResponse<T>> {
  const compositeRequests = recordIds.map(
    (id): CompositeRequestBody => ({
      method: 'GET',
      url: `/services/data/${apiVersion}/tooling/sobjects/${metadataType}/${id}?fields=${fields.join(',')}`,
      referenceId: id,
    })
  );
  return await makeToolingRequests<T>(selectedOrg, compositeRequests, apiVersion, false);
}

/**
 * Submit tooling requests using the composite API which allows 25 records to be processed at once
 * Requests are automatically split into sets of 25 records
 *
 * @param selectedOrg
 * @param compositeRequests
 * @param apiVersion
 * @param allOrNone
 */
export async function makeToolingRequests<T>(
  selectedOrg: SalesforceOrgUi,
  compositeRequests: CompositeRequestBody[],
  apiVersion,
  allOrNone = false
): Promise<CompositeResponse<T>> {
  const compositeRequestSets = splitArrayToMaxSize(compositeRequests, 25);
  let results: CompositeResponse<T> = { compositeResponse: [] };
  for (const compositeRequest of compositeRequestSets) {
    const response = await genericRequest<CompositeResponse<T>>(selectedOrg, {
      isTooling: true,
      method: 'POST',
      url: `/services/data/${apiVersion}/tooling/composite`,
      body: { allOrNone, compositeRequest },
    });
    if (!results) {
      results = response;
    } else {
      results.compositeResponse = results.compositeResponse.concat(response.compositeResponse);
    }
  }
  return results;
}

/**
 * Create or extend trace flag
 * @param org
 * @param DebugLevelId
 * @param trace
 * @returns
 */
export async function createOrExtendDebugTrace(
  org: SalesforceOrgUi,
  numHours: number,
  DebugLevelId: string,
  trace?: UserTrace
): Promise<{
  trace: UserTrace;
  expirationDate: Date;
}> {
  const newExpDate = addHours(new Date(), numHours);
  if (trace?.Id) {
    // update existing trace
    await genericRequest(org, {
      isTooling: true,
      method: 'PATCH',
      url: `/tooling/sobjects/TraceFlag/${trace.Id}`,
      body: {
        StartDate: null,
        ExpirationDate: formatISO(newExpDate),
        DebugLevelId: DebugLevelId,
      },
    });
  } else {
    // create new trace
    const results = await genericRequest<UserTrace>(org, {
      isTooling: true,
      method: 'POST',
      url: `/tooling/sobjects/TraceFlag`,
      body: {
        TracedEntityId: org.userId,
        LogType: 'DEVELOPER_LOG',
        StartDate: null,
        ExpirationDate: formatISO(newExpDate),
        DebugLevelId: DebugLevelId,
      },
    });
    return {
      trace: results,
      expirationDate: newExpDate,
    };
  }
  return {
    trace: { ...trace, ExpirationDate: formatISO(newExpDate) },
    expirationDate: newExpDate,
  };
}

/**
 * Create debug level, then fetch and return
 * @param org
 * @returns
 */
export async function createDebugLevel(org: SalesforceOrgUi): Promise<DebugLevel> {
  const results = await genericRequest<{ id: string }>(org, {
    isTooling: true,
    method: 'POST',
    url: `/tooling/sobjects/DebugLevel`,
    body: {
      DeveloperName: 'USER_DEBUG_FINEST',
      Language: 'en_US',
      MasterLabel: 'FINEST',
      ApexCode: 'FINEST',
      ApexProfiling: 'FINEST',
      Callout: 'FINEST',
      Database: 'FINEST',
      Nba: 'FINEST',
      System: 'FINEST',
      Validation: 'FINEST',
      Visualforce: 'FINEST',
      Wave: 'FINEST',
      Workflow: 'FINEST',
    },
  });

  const fetchResults = await genericRequest(org, {
    isTooling: false,
    method: 'GET',
    url: `/tooling/sobjects/DebugLevel/${results.id}`,
  });
  return fetchResults;
}

/**
 * Get log raw content
 * @param org
 * @param id
 * @returns
 */
export async function fetchActiveLog(org: SalesforceOrgUi, id: string): Promise<string> {
  const fetchResults = await genericRequest<string>(org, {
    isTooling: false,
    method: 'GET',
    url: `/sobjects/ApexLog/${id}/Body`,
    options: { responseType: 'text' },
  });
  return fetchResults;
}

/**
 * Copy records to clipboard in various formats
 * Copy the content in both plain text and HTML to be compatible with pasting to excel
 * along with other applications at the same time
 */
export async function copyRecordsToClipboard(
  recordsToCopy: any,
  copyFormat: CopyAsDataType = 'excel',
  fields?: Maybe<string[]>,
  includeHeader = true
) {
  try {
    if (copyFormat === 'excel') {
      recordsToCopy = fields ? flattenRecords(recordsToCopy, fields) : recordsToCopy;
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([transformTabularDataToExcelStr(recordsToCopy, fields, includeHeader)], { type: 'text/plain' }),
        'text/html': new Blob([transformTabularDataToHtml(recordsToCopy, fields, includeHeader)], { type: 'text/html' }),
      });
      await navigator.clipboard.write([clipboardItem]);
    } else if (copyFormat === 'csv') {
      recordsToCopy = fields ? flattenRecords(recordsToCopy, fields) : recordsToCopy;
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([unparse(recordsToCopy, { header: includeHeader })], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboardItem]);
    } else if (copyFormat === 'json') {
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([JSON.stringify(recordsToCopy, null, 2)], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboardItem]);
    }
    logger.info('[Clipboard][Copied]', { recordsToCopy });
  } catch (ex) {
    logger.warn('Copy to clipboard failed, trying fallback', ex.message);
    if (copyFormat === 'excel' && fields) {
      const flattenedData = flattenRecords(recordsToCopy, fields);
      copyToClipboard(transformTabularDataToExcelStr(flattenedData, fields, includeHeader), { format: 'text/plain' });
    } else if (copyFormat === 'csv' && fields) {
      const flattenedData = flattenRecords(recordsToCopy, fields);
      copyToClipboard(unparse(flattenedData, { header: includeHeader }), { format: 'text/plain' });
    } else if (copyFormat === 'json') {
      copyToClipboard(JSON.stringify(recordsToCopy, null, 2), { format: 'text/plain' });
    }
  }
}

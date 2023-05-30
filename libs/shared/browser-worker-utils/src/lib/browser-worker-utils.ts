import { logger } from '@jetstream/shared/client-logger';
import { HTTP, SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { bulkApiGetJob, checkMetadataRetrieveResults, queryAll } from '@jetstream/shared/data';
import { NOOP, delay, transformRecordForDataLoad } from '@jetstream/shared/utils';
import type { BulkJobWithBatches, MapOf, Maybe, RetrieveResult, SalesforceOrgUi } from '@jetstream/types';
import { FieldType } from 'jsforce';
import isFunction from 'lodash/isFunction';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import numeral from 'numeral';
import { UnparseConfig, unparse, unparse as unparseCsv } from 'papaparse';
import { Query, WhereClause, composeQuery, getField } from 'soql-parser-js';
import * as XLSX from 'xlsx';

/**
 * PURPOSE OF THIS LIBRARY
 *
 * There is some finicky behavior with imports from workers
 * where some of our libraries have huge dependencies graphs
 * that cause the workers not to load
 *
 * This is library is basically anything a worker needs that turned out to be problematic
 * and was moved here to work around the issue since the root cause is unknown.
 *
 * Seems like this is somehow related to some type of circular reference problem
 * but failure is silent and the only indicator of an issue is that the worker does not get loaded
 *
 * FIXME: Everything here is duplicated elsewhere - we should keep this stuff here and have it accessed where needed (if possible)
 */

export class LoadRecordsBatchError extends Error {
  additionalErrors: Error[];
  constructor(message: string, additionalErrors?: Error[]) {
    super(`${message}. ${additionalErrors ? additionalErrors.map((ex) => ex.message).join(', ') : ''}`.trim());
    this.additionalErrors = additionalErrors || [];
  }
}

export function base64ToArrayBuffer(base64: string) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

function detectDelimiter(): string {
  let delimiter = ',';
  try {
    // determine if delimiter is the same as the decimal symbol in current locale
    // if so, change delimiter to ;
    if (delimiter === (1.1).toLocaleString(navigator.language).substring(1, 2)) {
      delimiter = ';';
    }
  } catch (ex) {
    logger.warn('[ERROR] Error detecting CSV delimiter', ex);
  }
  return delimiter;
}

export function generateCsv(data: any[], options: UnparseConfig = {}): string {
  options = options || {};
  options.newline = options.newline || '\n';
  if (!options.delimiter) {
    options.delimiter = detectDelimiter();
  }
  return unparseCsv(data, options);
}

export function prepareCsvFile(data: MapOf<string>[], header: string[]) {
  return unparse(
    {
      data,
      fields: header,
    },
    { header: true, quotes: true, delimiter: detectDelimiter() }
  );
}

/**
 * Prepares excel file
 * @param data Array of objects for one sheet, or map of multiple objects where the key is sheet name
 * @param header Array of strings id data is array, or map of strings[] where the key matches the sheet name This will be auto-detected if not provided
 * @param [defaultSheetName]
 * @returns excel file
 */
export function prepareExcelFile(data: any[], header?: string[], defaultSheetName?: string): ArrayBuffer;
export function prepareExcelFile(data: MapOf<any[]>, header?: MapOf<string[]>, defaultSheetName?: void): ArrayBuffer;
export function prepareExcelFile(data: any, header: any, defaultSheetName: any = 'Records'): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  if (Array.isArray(data)) {
    header = header || Object.keys(data[0]);
    const worksheet = XLSX.utils.aoa_to_sheet(convertArrayOfObjectToArrayOfArray(data, header as string[]));
    XLSX.utils.book_append_sheet(workbook, worksheet, defaultSheetName);
  } else {
    Object.keys(data).forEach((sheetName) => {
      if (data[sheetName].length > 0) {
        let currentHeader = header && header[sheetName];
        let isArrayOfArray = false;
        if (!currentHeader) {
          if (Array.isArray(data[sheetName][0])) {
            isArrayOfArray = true;
          } else {
            currentHeader = Object.keys(data[sheetName][0]);
          }
        }
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.aoa_to_sheet(isArrayOfArray ? data[sheetName] : convertArrayOfObjectToArrayOfArray(data[sheetName], currentHeader)),
          sheetName
        );
      }
    });
  }

  return excelWorkbookToArrayBuffer(workbook);
}

export function excelWorkbookToArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  // https://github.com/sheetjs/sheetjs#writing-options
  const workbookArrayBuffer: ArrayBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    bookSST: false,
    type: 'array', // ArrayBuffer
  });
  return workbookArrayBuffer;
}

export function convertArrayOfObjectToArrayOfArray(data: any[], headers?: string[]): any[][] {
  if (!data || !data.length) {
    return [];
  }
  headers = headers || Object.keys(data[0]) || [];
  return [headers].concat(data.map((row) => headers?.map((header) => row[header]) || []));
}

const DEFAULT_INTERVAL_5_SEC = 5000;
const DEFAULT_MAX_ATTEMPTS = 500;
// number of attempts before checking less often
const BACK_OFF_INTERVAL = 25;

/**
 *
 * @param selectedOrg
 * @param id
 * @param options
 * @returns
 */
export async function pollRetrieveMetadataResultsUntilDone(
  selectedOrg: SalesforceOrgUi,
  id: string,
  options?: { interval?: number; maxAttempts?: number; onChecked?: (retrieveResults: RetrieveResult) => void; isCancelled?: () => boolean }
) {
  let { interval, maxAttempts, onChecked } = options || {};
  interval = interval || DEFAULT_INTERVAL_5_SEC;
  maxAttempts = maxAttempts || DEFAULT_MAX_ATTEMPTS;
  onChecked = isFunction(onChecked) ? onChecked : NOOP;
  const isCancelled = options?.isCancelled || (() => false);

  let attempts = 0;
  let done = false;
  let retrieveResults: RetrieveResult = {} as RetrieveResult;
  while (!done && attempts <= maxAttempts) {
    await delay(interval);
    if (isCancelled && isCancelled()) {
      throw new Error('Job cancelled');
    }
    retrieveResults = await checkMetadataRetrieveResults(selectedOrg, id);
    logger.log({ retrieveResults });
    onChecked(retrieveResults);
    done = retrieveResults.done;
    attempts++;
    // back off checking if it is taking a long time
    if (attempts % BACK_OFF_INTERVAL === 0) {
      interval += DEFAULT_INTERVAL_5_SEC;
    }
    if (isCancelled && isCancelled()) {
      throw new Error('Job cancelled');
    }
  }
  if (!done) {
    throw new Error('Timed out while checking for metadata results, check Salesforce for results.');
  }
  return retrieveResults;
}

export async function pollBulkApiJobUntilDone(
  selectedOrg: SalesforceOrgUi,
  jobInfo: BulkJobWithBatches,
  totalBatches: number,
  options?: { interval?: number; maxAttempts?: number; onChecked?: (jobInfo: BulkJobWithBatches) => void }
): Promise<BulkJobWithBatches> {
  let { interval, maxAttempts, onChecked } = options || {};
  interval = interval || DEFAULT_INTERVAL_5_SEC;
  maxAttempts = maxAttempts || DEFAULT_MAX_ATTEMPTS;
  onChecked = isFunction(onChecked) ? onChecked : NOOP;

  let attempts = 0;
  let done = false;
  let jobInfoWithBatches: BulkJobWithBatches = jobInfo;
  while (!done && attempts <= maxAttempts) {
    await delay(interval);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    jobInfoWithBatches = await bulkApiGetJob(selectedOrg, jobInfo.id!);

    logger.log({ jobInfoWithBatches });
    onChecked(jobInfoWithBatches);
    done = checkIfBulkApiJobIsDone(jobInfoWithBatches, totalBatches);
    attempts++;
    // back off checking if it is taking a long time
    if (attempts % BACK_OFF_INTERVAL === 0) {
      interval += DEFAULT_INTERVAL_5_SEC;
    }
  }
  if (!done) {
    throw new Error('Timed out while waiting for the job to finish, check Salesforce for results.');
  }
  return jobInfoWithBatches;
}

function checkIfBulkApiJobIsDone(jobInfo: BulkJobWithBatches, totalBatches: number) {
  if (jobInfo.state === 'Failed' || jobInfo.state === 'Aborted') {
    return true;
  }
  return (
    jobInfo.batches.length > 0 &&
    jobInfo.batches.length === totalBatches &&
    jobInfo.batches.every((batch) => batch.state === 'Completed' || batch.state === 'Failed' || batch.state === 'NotProcessed')
  );
}

/**
 * Generate authentication in the url from a salesforce
 * @param org
 */
export function getOrgUrlParams(org: SalesforceOrgUi, additionalParams: { [param: string]: string } = {}): string {
  return new URLSearchParams({
    ...additionalParams,
    [HTTP.HEADERS.X_SFDC_ID]: org?.uniqueId || '',
  }).toString();
}

export interface FieldMapping {
  [field: string]: FieldMappingItem;
}

export interface FieldMappingItem {
  csvField: string;
  targetField: string | null;
  mappedToLookup: boolean;
  selectedReferenceTo?: string;
  relationshipName?: string;
  targetLookupField?: string;
  fieldMetadata: Maybe<FieldWithRelatedEntities>;
  relatedFieldMetadata?: FieldRelatedEntity;
  isDuplicateMappedField?: boolean;
  lookupOptionUseFirstMatch: NonExtIdLookupOption;
  lookupOptionNullIfNoMatch: boolean;
  isBinaryBodyField: boolean;
}

export type NonExtIdLookupOption = 'FIRST' | 'ERROR_IF_MULTIPLE';

export interface FieldWithRelatedEntities {
  label: string;
  name: string;
  type: FieldType;
  soapType: string;
  typeLabel: string;
  externalId: boolean;
  referenceTo?: string[];
  relationshipName?: string;
  relatedFields?: MapOf<FieldRelatedEntity[]>;
}

export interface FieldRelatedEntity {
  name: string;
  label: string;
  type: string;
  isExternalId: boolean;
}

export interface PrepareDataPayload {
  org: SalesforceOrgUi;
  data: any[];
  fieldMapping: FieldMapping;
  sObject: string;
  insertNulls?: boolean; // defaults to false
  dateFormat: string;
  apiMode: ApiMode;
}

export type ApiModeBulk = 'BULK';
export type ApiModeBatch = 'BATCH';
export type ApiMode = ApiModeBulk | ApiModeBatch;

export interface PrepareDataResponse {
  data: any[];
  errors: PrepareDataResponseError[];
  queryErrors: string[];
}

export interface PrepareDataResponseError {
  row: number;
  record: any;
  errors: string[];
}

export const SELF_LOOKUP_KEY = '~SELF_LOOKUP~';
const DEFAULT_NON_EXT_ID_MAPPING_OPT: NonExtIdLookupOption = 'ERROR_IF_MULTIPLE';
const DEFAULT_NULL_IF_NO_MATCH_MAPPING_OPT = false;

function addErrors(errorsByRowIndex: Map<number, { row: number; record: any; errors: string[] }>) {
  return function addError(row: number, record: any, error: string) {
    if (!errorsByRowIndex.has(row)) {
      errorsByRowIndex.set(row, { row, record, errors: [] });
    }
    errorsByRowIndex.get(row)?.errors.push(error);
  };
}

/**
 * For any lookup fields that are not mapped to an external Id, fetch related records and populate related record Id for each field
 * The fieldMapping option contains the options the user selected on how to handle cases where 0 or multiple related records are found for a given value
 *
 * @param data records
 * @param param1
 * @returns
 */
export async function fetchMappedRelatedRecords(
  data: any[],
  { org, sObject, fieldMapping, apiMode }: PrepareDataPayload,
  onProgress: (progress: number) => void
): Promise<PrepareDataResponse> {
  const nonExternalIdFieldMappings = Object.values(fieldMapping).filter(
    (item) =>
      item.mappedToLookup &&
      item.relatedFieldMetadata &&
      (!item.relatedFieldMetadata.isExternalId || item.relationshipName === SELF_LOOKUP_KEY)
  );

  const queryErrors: string[] = [];
  const errorsByRowIndex = new Map<number, { row: number; record: any; errors: string[] }>();
  const addError = addErrors(errorsByRowIndex);

  if (nonExternalIdFieldMappings.length) {
    // progress indicator
    let current = 0;
    const step = 100 / nonExternalIdFieldMappings.length;
    const total = 100;

    // increment progress between current and next step - lots of incremental records queried
    const emitQueryProgress = (currentQuery: number, total: number) => {
      const progressIncrement = (currentQuery / total) * step;
      // ensure we don't exceed beyond the current step
      onProgress(Math.min(current + progressIncrement, current + step));
    };

    for (const {
      lookupOptionNullIfNoMatch,
      lookupOptionUseFirstMatch,
      relationshipName,
      selectedReferenceTo,
      targetField,
      targetLookupField,
    } of nonExternalIdFieldMappings) {
      onProgress(Math.min(current / total, 100));
      // only used for error messaging
      let fieldRelationshipName = `${relationshipName}.${targetLookupField}`;
      if (relationshipName === SELF_LOOKUP_KEY) {
        // Don't show user ~SELF_LOOKUP~
        fieldRelationshipName = `${targetLookupField}`;
      }
      // remove any falsy values, related fields cannot be booleans or numbers, so this should not cause issues
      const relatedValues = new Set<string>(data.map((row: any) => row[targetField || '']).filter(Boolean));

      if (relatedValues.size && selectedReferenceTo && targetLookupField) {
        const relatedRecordsByRelatedField: MapOf<string[]> = {};
        // Get as many queries as required based on the size of the related fields
        const queries = getRelatedFieldsQueries(sObject, selectedReferenceTo, targetLookupField, Array.from(relatedValues));
        let currentQuery = 1;
        for (const query of queries) {
          try {
            emitQueryProgress(currentQuery, queries.length);
            currentQuery++;
            (await queryAll(org, query)).queryResults.records.forEach((record) => {
              relatedRecordsByRelatedField[record[targetLookupField]] = relatedRecordsByRelatedField[record[targetLookupField]] || [];
              relatedRecordsByRelatedField[record[targetLookupField]].push(record.Id);
            });
          } catch (ex) {
            queryErrors.push((ex as any).message);
          }
        }

        data.forEach((record: any, i: number) => {
          if (!targetField || isNil(record[targetField]) || record[targetField] === '') {
            return;
          }
          const relatedRecords = relatedRecordsByRelatedField[record[targetField]];
          /** NO RELATED RECORD FOUND */
          if (!relatedRecords) {
            if (lookupOptionNullIfNoMatch) {
              record[targetField] = apiMode === 'BATCH' ? null : SFDC_BULK_API_NULL_VALUE;
            } else {
              // No match, and not mark as null
              addError(
                i,
                record,
                `Related record not found for relationship "${fieldRelationshipName}" with a value of "${record[targetField]}".`
              );
            }
          } else if (relatedRecords.length > 1 && lookupOptionUseFirstMatch !== 'FIRST') {
            addError(
              i,
              record,
              `Found ${formatNumber(relatedRecords.length)} related records for relationship "${fieldRelationshipName}" with a value of "${
                record[targetField]
              }".`
            );
          } else {
            /** FOUND 1 MATCH, OR OPTION TO USE FIRST MATCH */
            record[targetField] = relatedRecords[0];
          }
        });
      }
      current++;
    }
    onProgress(100);
  }
  // remove failed records from dataset
  data = data.filter((_: unknown, i: number) => !errorsByRowIndex.has(i));

  return { data, errors: Array.from(errorsByRowIndex.values()), queryErrors };
}

export function formatNumber(number?: number) {
  return numeral(number || 0).format('0,0');
}

/**
 * Get as many queries as required to fetch all the related values based on the length of the query
 *
 * @param baseObject Parent object, not the one being queried - used for additional filter special cases (e.x. RecordType)
 * @param relatedObject
 * @param relatedField
 * @param relatedValues
 * @returns
 */
function getRelatedFieldsQueries(baseObject: string, relatedObject: string, relatedField: string, relatedValues: string[]): string[] {
  let extraWhereClause = '';

  const baseQuery: Query = {
    sObject: relatedObject,
    fields: Array.from(new Set([getField('Id'), getField(relatedField)])),
  };

  let extraWhereClauseNew: WhereClause | undefined = undefined;
  const whereClause: WhereClause = {
    left: {
      field: relatedField,
      operator: 'IN',
      value: [],
      literalType: 'STRING',
    },
  };

  /** SPECIAL CASES */
  if (relatedObject.toLowerCase() === 'recordtype') {
    extraWhereClause = `SobjectType = '${baseObject}' AND `;
    extraWhereClauseNew = {
      left: {
        field: 'SobjectType',
        operator: '=',
        value: baseObject,
        literalType: 'STRING',
      },
    };
  }
  const QUERY_ITEM_BUFFER_LENGTH = 250;
  const BASE_QUERY_LENGTH =
    `SELECT Id, ${relatedField} FROM ${relatedObject} WHERE ${extraWhereClause}${relatedField} IN ('`.length + QUERY_ITEM_BUFFER_LENGTH;
  const MAX_QUERY_LENGTH = 9500; // somewhere just over 10K was giving an error

  const queries: string[] = [];
  let tempRelatedValues: string[] = [];
  let currLength = BASE_QUERY_LENGTH;
  relatedValues.forEach((value) => {
    tempRelatedValues.push(isString(value) ? value.replaceAll(`'`, `\\'`).replaceAll(`\\n`, `\\\\n`) : value);
    currLength += value.length + QUERY_ITEM_BUFFER_LENGTH;
    if (currLength >= MAX_QUERY_LENGTH) {
      const tempQuery = { ...baseQuery };
      if (extraWhereClauseNew) {
        tempQuery.where = {
          ...extraWhereClauseNew,
          operator: 'AND',
          right: { ...whereClause, left: { ...whereClause.left, value: tempRelatedValues } },
        };
      } else {
        tempQuery.where = { ...whereClause, left: { ...whereClause.left, value: tempRelatedValues } };
      }
      queries.push(composeQuery(tempQuery));
      tempRelatedValues = [];
      currLength = BASE_QUERY_LENGTH;
    }
  });
  if (tempRelatedValues.length) {
    const tempQuery = { ...baseQuery };
    if (extraWhereClauseNew) {
      tempQuery.where = {
        ...extraWhereClauseNew,
        operator: 'AND',
        right: { ...whereClause, left: { ...whereClause.left, value: tempRelatedValues } },
      };
    } else {
      tempQuery.where = { ...whereClause, left: { ...whereClause.left, value: tempRelatedValues } };
    }
    queries.push(composeQuery(tempQuery));
  }
  return queries;
}

export function transformData({ data, fieldMapping, sObject, insertNulls, dateFormat, apiMode }: PrepareDataPayload): any[] {
  return data.map((row) => {
    return Object.keys(fieldMapping)
      .filter((key) => !!fieldMapping[key].targetField)
      .reduce((output: any, field, i) => {
        if (apiMode === 'BATCH' && i === 0) {
          output.attributes = { type: sObject };
        }
        let skipField = false;
        const fieldMappingItem = fieldMapping[field];
        // SFDC handles automatic type conversion with both bulk and batch apis (if possible, otherwise the record errors)
        let value = row[field];

        if (isNil(value) || (isString(value) && !value)) {
          if (apiMode === 'BULK' && insertNulls) {
            value = SFDC_BULK_API_NULL_VALUE;
          } else if (apiMode === 'BATCH' && insertNulls) {
            value = null;
          } else if (apiMode === 'BATCH') {
            // batch api will always clear the value in SFDC if a null is passed, so we must ensure it is not included at all
            skipField = true;
          }
        } else if (fieldMappingItem.fieldMetadata) {
          value = transformRecordForDataLoad(value, fieldMappingItem.fieldMetadata.type, dateFormat);
        }

        if (!skipField) {
          // Handle external Id related fields
          // Non-external Id lookups are handled separately in `fetchMappedRelatedRecords()` and are mapped normally to the target field initially
          if (
            apiMode === 'BATCH' &&
            fieldMappingItem.mappedToLookup &&
            fieldMappingItem.relatedFieldMetadata?.isExternalId &&
            fieldMappingItem.relationshipName !== SELF_LOOKUP_KEY &&
            fieldMappingItem.relationshipName &&
            fieldMappingItem.targetLookupField
          ) {
            output[fieldMappingItem.relationshipName] = { [fieldMappingItem.targetLookupField]: value };
            // if polymorphic field, then add type attribute
            if ((fieldMappingItem.fieldMetadata?.referenceTo?.length || 0) > 1) {
              output[fieldMappingItem.relationshipName] = {
                attributes: { type: fieldMappingItem.selectedReferenceTo },
                ...output[fieldMappingItem.relationshipName],
              };
            }
          } else if (
            fieldMappingItem.mappedToLookup &&
            fieldMappingItem.relatedFieldMetadata?.isExternalId &&
            fieldMappingItem.relationshipName !== SELF_LOOKUP_KEY &&
            fieldMappingItem.targetLookupField
          ) {
            if ((fieldMappingItem.fieldMetadata?.referenceTo?.length || 0) > 1) {
              // add in polymorphic field type
              // https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_rel_field_header_row.htm?search_text=Polymorphic
              output[`${fieldMappingItem.selectedReferenceTo}:${fieldMappingItem.relationshipName}.${fieldMappingItem.targetLookupField}`] =
                value;
            } else {
              output[`${fieldMappingItem.relationshipName}.${fieldMappingItem.targetLookupField}`] = value;
            }
          } else if (fieldMappingItem.targetField) {
            output[fieldMappingItem.targetField] = value;
          }
        }

        return output;
      }, {});
  });
}

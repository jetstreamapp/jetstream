import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { bulkApiGetJob, checkMetadataRetrieveResults } from '@jetstream/shared/data';
import { NOOP, delay } from '@jetstream/shared/utils';
import { BulkJobWithBatches, FieldType, Maybe, RetrieveResult, SalesforceOrgUi } from '@jetstream/types';
import isFunction from 'lodash/isFunction';
import numeral from 'numeral';
import { UnparseConfig, unparse, unparse as unparseCsv } from 'papaparse';
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

/** @deprecated - I think this is unused */
export function generateCsv(data: any[], options: UnparseConfig = {}): string {
  options = options || {};
  options.newline = options.newline || '\n';
  if (!options.delimiter) {
    options.delimiter = detectDelimiter();
  }
  return unparseCsv(data, options);
}

export function prepareCsvFile(data: Record<string, string>[], header: string[]) {
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
export function prepareExcelFile(data: Record<string, any[]>, header?: Record<string, string[]>, defaultSheetName?: void): ArrayBuffer;
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
  relatedFields?: Record<string, FieldRelatedEntity[]>;
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

export function formatNumber(number?: number) {
  return numeral(number || 0).format('0,0');
}

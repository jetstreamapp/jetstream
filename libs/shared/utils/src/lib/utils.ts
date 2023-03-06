import { QueryResults, QueryResultsColumn } from '@jetstream/api-interfaces';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import {
  BulkJob,
  BulkJobBatchInfo,
  BulkJobBatchInfoUntyped,
  BulkJobUntyped,
  HttpMethod,
  InsertUpdateUpsertDelete,
  ListItem,
  ListItemGroup,
  MapOf,
  Maybe,
  QueryFieldWithPolymorphic,
  Record,
  SoapNil,
} from '@jetstream/types';
import { formatISO as formatISODate, parse as parseDate, parseISO as parseISODate, startOfDay as startOfDayDate } from 'date-fns';
import fromUnixTime from 'date-fns/fromUnixTime';
import { FieldType as jsforceFieldType, QueryResult } from 'jsforce';
import { get as lodashGet, inRange, isBoolean, isNil, isNumber, isObject, isString, orderBy } from 'lodash';
import { ComposeFieldTypeof, FieldSubquery, FieldType, getField } from 'soql-parser-js';
import { REGEX } from './regex';

export function NOOP() {}

export function dateFromTimestamp(timestamp: number): Date {
  return fromUnixTime(timestamp);
}

export async function alwaysResolve<T = any>(promise: Promise<T>, valueIfError: T): Promise<T> {
  try {
    return await promise;
  } catch (ex) {
    return valueIfError;
  }
}

export class Stack<T = any> {
  items: T[];

  constructor(items: T[] = []) {
    this.items = items;
  }

  push(item: T) {
    if (item) {
      this.items.push(item);
    }
  }

  pop() {
    return this.items.pop();
  }

  peek() {
    return this.items.length ? this.items[this.items.length - 1] : null;
  }
}

/**
 * For a list of objects, return a predicate function to search across multiple fields
 * If the search term is multiple words, then each word will be matched individually and all must match to return a value
 * This is a basic form of fuzzy searching, but does not account for typos
 *
 * @param props Array of keys from item
 * @param value search term
 * @returns a predecate function that can be used in filter function
 */
export function multiWordObjectFilter<T>(
  props: Array<keyof T>,
  value: string,
  optionalExtraCondition?: (item: T) => boolean
): (value: T, index: number, array: T[]) => boolean {
  value = value || '';
  let search: string[];
  // If value is surrounded in quotes, treat as literal value
  if (value.startsWith('"') && value.endsWith('"')) {
    search = [value.toLocaleLowerCase().replace(REGEX.START_OR_END_QUOTE, '')];
  } else {
    search = value.toLocaleLowerCase().split(' ');
  }

  const hasValue = search.length > 0;
  return (item: T) => {
    if (!hasValue || !item) {
      return true;
    }
    const normalizedValue = props
      .map((prop) => (item[prop] ?? '').toString())
      .join()
      .toLocaleLowerCase();
    return search.every((word) => normalizedValue.includes(word)) || optionalExtraCondition?.(item) || false;
  };
}

export function multiWordStringFilter(value: string): (value: string, index: number, array: string[]) => boolean {
  const search = (value || '').toLocaleLowerCase().split(' ');
  const hasValue = search.length > 0;
  return (item: string) => {
    if (!hasValue || !item) {
      return true;
    }
    return search.every((word) => (item || '').toLocaleLowerCase().includes(word));
  };
}

export function orderObjectsBy<T>(items: T[], fields: keyof T | [keyof T], order: 'asc' | 'desc' | ('asc' | 'desc')[] = 'asc'): T[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields = Array.isArray(fields) ? fields : [fields];
  order = Array.isArray(order) ? order : [order];
  const orderByItereeFn = fields.map((field) => (item: T) => isString(item[field]) ? (item[field] as any).toLowerCase() : item[field]);
  return orderBy(items, orderByItereeFn, order);
}

export function orderStringsBy(items: string[], order: 'asc' | 'desc' = 'asc'): string[] {
  const orderByItereeFn = (value) => (isString(value) ? value.toLowerCase() : value);
  return orderBy(items, [orderByItereeFn], [order]);
}

export function getMapOf<T>(items: T[], prop: keyof T): MapOf<T> {
  return items.reduce((output: MapOf<T>, item) => {
    output[item[prop] as any] = item;
    return output;
  }, {});
}

export function getMapFromObj<T>(items: T[], prop: keyof T): Map<string, T> {
  return items.reduce((output: Map<string, T>, item) => {
    output.set(item[prop] as any, item);
    return output;
  }, new Map());
}

export function populateFromMapOf<T>(mapOf: MapOf<T>, items: string[]): T[] {
  return items.map((item) => mapOf[item]).filter((item) => !!item);
}

export function flattenRecords(records: Record[], fields: string[]): MapOf<string>[] {
  return records.map((record) => flattenRecord(record, fields));
}

export function flattenRecord(record: Record, fields: string[], flattObjects = true): MapOf<string> {
  return fields.reduce((obj, field) => {
    const value = lodashGet(record, field);
    if (isObject(value) && flattObjects) {
      // Subquery records have nested "records" values
      if (Array.isArray(value['records'])) {
        obj[field] = JSON.stringify(value['records']).replace(REGEX.LEADING_TRAILING_QUOTES, '');
      } else {
        obj[field] = JSON.stringify(value).replace(REGEX.LEADING_TRAILING_QUOTES, '');
      }
    } else {
      obj[field] = value;
    }
    return obj;
  }, {});
}

export function splitArrayToMaxSize<T = unknown>(items: T[], maxSize: number): T[][] {
  if (!maxSize || maxSize < 1) {
    throw new Error('maxSize must be greater than 0');
  }
  if (!items || items.length === 0) {
    return [[]];
  }
  let output: T[][] = [];
  let currSet: T[] = [];
  items.forEach((item) => {
    if (currSet.length < maxSize) {
      currSet.push(item);
    } else {
      output.push(currSet);
      currSet = [item];
    }
  });
  if (currSet.length > 0) {
    output.push(currSet);
  }
  return output;
}

export function toBoolean(value: Maybe<boolean | string>, defaultValue: boolean = false) {
  if (isBoolean(value)) {
    return value;
  }
  if (isString(value)) {
    return value.toLowerCase().startsWith('t');
  }
  return defaultValue;
}

export function toNumber(value: Maybe<number | string>) {
  if (isString(value)) {
    const val = Number.parseInt(value);
    if (Number.isFinite(val)) {
      return val;
    }
  }
  return value;
}

export function truncate(value: string, maxLength: number, trailingChar: string = '...'): string {
  if (!value || value.length <= maxLength) {
    return value;
  }
  return `${value.substring(0, maxLength)}${trailingChar}`;
}

export function pluralizeIfMultiple(value: string, items: any[], plural: string = 's'): string {
  if (!items || items.length !== 1) {
    return `${value}${plural}`;
  }
  return value;
}

export function pluralizeFromNumber(value: string, num: number = 0, plural: string = 's'): string {
  if (num !== 1) {
    return `${value}${plural}`;
  }
  return value;
}

export function getIdAndObjFromRecordUrl(url: string): [string, string] {
  const [id, sobject] = url.split('/').reverse();
  return [id, sobject];
}

export function getSObjectFromRecordUrl(url: string): string {
  const [id, sobject] = getIdAndObjFromRecordUrl(url);
  return sobject;
}

export function getIdFromRecordUrl(url: string): string {
  const [id, sobject] = getIdAndObjFromRecordUrl(url);
  return id;
}

/**
 * Remove query wrapper from child records
 * NOTE: this ignores instances where there are more records
 * @param results
 */
export function replaceSubqueryQueryResultsWithRecords(results: QueryResults<any>) {
  if (results.parsedQuery) {
    const subqueryFields = new Set<string>(
      results.parsedQuery.fields
        ?.filter((field) => field.type === 'FieldSubquery')
        .map((field: FieldSubquery) => field.subquery.relationshipName)
    );
    if (subqueryFields.size > 0) {
      results.queryResults.records.forEach((record) => {
        try {
          subqueryFields.forEach((field) => {
            if (record[field]) {
              record[field] = (record[field] as QueryResult<unknown>).records;
            }
          });
        } catch (ex) {
          // could not process field
        }
      });
    }
  }
  return results;
}

export function queryResultColumnToTypeLabel(column: QueryResultsColumn, fallback = 'Unknown'): string {
  if (column.textType) {
    return 'Text';
  }
  if (column.booleanType) {
    return 'Checkbox';
  } else if (column.numberType) {
    return 'Number';
  } else if (Array.isArray(column.childColumnPaths)) {
    return 'Child Records';
  }
  return column.apexType || fallback;
}

function getTypeOfField(polymorphicItems: { field: string; sobject: string; fields: string[] }): FieldType {
  const { field, sobject, fields } = polymorphicItems;
  if (!fields.includes('Id')) {
    // force Id onto query because it will be used in the ELSE section
    fields.unshift('Id');
  }

  const output: ComposeFieldTypeof = {
    field,
    conditions: [
      {
        type: 'WHEN',
        objectType: sobject,
        fieldList: fields,
      },
      {
        type: 'ELSE',
        fieldList: ['Id'],
      },
    ],
  };
  return getField(output);
}

export function getRecordIdFromAttributes(record: any) {
  return record.attributes.url.substring(record.attributes.url.lastIndexOf('/') + 1);
}

export function getSObjectNameFromAttributes(record: any) {
  let urlWithoutId = record.attributes.url.substring(0, record.attributes.url.lastIndexOf('/'));
  return urlWithoutId.substring(urlWithoutId.lastIndexOf('/') + 1);
}

export function convertFieldWithPolymorphicToQueryFields(inputFields: QueryFieldWithPolymorphic[]): FieldType[] {
  let polymorphicItems: { field: string; sobject: string; fields: string[] } = {
    field: '',
    sobject: '',
    fields: [],
  };
  let outputFields = inputFields.reduce((output: FieldType[], field) => {
    if (field.polymorphicObj) {
      const polymorphicField = field.field.substring(0, field.field.lastIndexOf('.'));
      const sobjectField = field.field.substring(field.field.lastIndexOf('.') + 1);
      // polymorphic fields will all be sorted, so if we see a new one we can assume it is a new set of conditions
      if (polymorphicItems.field !== polymorphicField) {
        // Compose prior polymorphic fields and reset
        if (polymorphicItems.field && polymorphicItems.fields.length > 0) {
          // build polymorphic query from prior fields
          output.push(getTypeOfField(polymorphicItems));
        }
        polymorphicItems = {
          field: polymorphicField,
          sobject: field.polymorphicObj,
          fields: [sobjectField],
        };
      } else {
        polymorphicItems.fields.push(sobjectField);
      }
    } else if (polymorphicItems.field && field.field.startsWith(`${polymorphicItems.field}.`)) {
      // field is a relationship through a polymorphic field, but is not itself polymorphic
      // we need to strip off the prefix and add to the list of fields
      polymorphicItems.fields.push(field.field.replace(`${polymorphicItems.field}.`, ''));
    } else {
      // Compose prior polymorphic fields
      if (polymorphicItems.field && polymorphicItems.fields.length > 0) {
        output.push(getTypeOfField(polymorphicItems));
        polymorphicItems = { field: '', sobject: '', fields: [] };
      }
      // return regular non-TYPEOF fields
      output.push(getField(field.field));
    }
    return output;
  }, []);

  // Compose remaining polymorphic fields
  if (polymorphicItems.field && polymorphicItems.fields.length > 0) {
    outputFields.push(getTypeOfField(polymorphicItems));
    polymorphicItems = { field: '', sobject: '', fields: [] };
  }

  return outputFields;
}

export function ensureBoolean(value: Maybe<string | boolean>) {
  if (isBoolean(value)) {
    return value;
  } else if (isString(value)) {
    return value.toLowerCase().startsWith('t');
  }
  return false;
}

export function ensureArray<T = unknown>(value: T): T {
  if (isNil(value)) {
    return [] as any;
  }
  return (Array.isArray(value) ? value : [value]) as T;
}

export function ensureStringValue(value: Maybe<string>, allowedValues: string[], fallback?: string): string | undefined {
  if (isNil(value)) {
    return fallback;
  }
  return allowedValues.find((v) => value.toLowerCase() === v.toLowerCase()) || fallback;
}

/**
 * Returns a promise that is delayed by {milliseconds}
 * @param milliseconds
 */
export async function delay(milliseconds: number) {
  // return await for better async stack trace support in case of errors.
  return await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function isValidDate(date: Date) {
  return date instanceof Date && !isNaN(date.getTime());
}

export function bulkApiEnsureTyped(job: BulkJobBatchInfo | BulkJobBatchInfoUntyped): BulkJobBatchInfo;
export function bulkApiEnsureTyped(job: BulkJob | BulkJobUntyped): BulkJob;
export function bulkApiEnsureTyped(job: any | any): BulkJob | BulkJobBatchInfo {
  if (!isObject(job)) {
    return job as BulkJob | BulkJobBatchInfo;
  }
  const numberTypes = [
    'apexProcessingTime',
    'apiActiveProcessingTime',
    'apiVersion',
    'numberBatchesCompleted',
    'numberBatchesFailed',
    'numberBatchesInProgress',
    'numberBatchesQueued',
    'numberBatchesTotal',
    'numberRecordsFailed',
    'numberRecordsProcessed',
    'numberRetries',
    'totalProcessingTime',
  ];
  if (job['$']) {
    job['$'] = undefined;
  }
  if (job['@xmlns']) {
    job['@xmlns'] = undefined;
  }
  numberTypes.forEach((prop) => {
    if (job.hasOwnProperty(prop) && typeof job[prop] === 'string') {
      job[prop] = Number(job[prop]);
    }
  });
  return job as BulkJob | BulkJobBatchInfo;
}

export function getHttpMethod(type: InsertUpdateUpsertDelete): HttpMethod {
  switch (type) {
    case 'UPDATE':
    case 'UPSERT':
      return 'PATCH';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'POST';
  }
}

export function getValueOrSoapNull(value: string | SoapNil) {
  return isString(value) ? value : null;
}

// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
export function hashString(value: string = ''): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash;
}

export function sanitizeForXml(value: string) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function unSanitizeXml(value: string) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, `'`);
}

/**
 * Given a value from a record, ensure it is in a proper format for a data load.
 * Handles boolean, data, datetime
 * @param value
 * @param options
 *
 * VALID DATE FORMATS: DATE_FORMATS.MM_DD_YYYY, DATE_FORMATS.DD_MM_YYYY, DATE_FORMATS.YYYY_MM_DD
 */
export function transformRecordForDataLoad(value: any, fieldType: jsforceFieldType, dateFormat?: string) {
  dateFormat = dateFormat || DATE_FORMATS.MM_DD_YYYY;

  if (isNil(value) || (isString(value) && !value)) {
    return null;
  } else if (fieldType === 'boolean') {
    if (isString(value) || isNumber(value)) {
      // any string that starts with "t" or number that starts with "1" is set to true
      // all other values to false (case-insensitive)
      return REGEX.BOOLEAN_STR_TRUE.test(`${value}`);
    }
  } else if (fieldType === 'date') {
    return transformDate(value, dateFormat);
  } else if (fieldType === 'datetime') {
    return transformDateTime(value, dateFormat);
  } else if (fieldType === 'time') {
    // time format is specific
    // TODO: detect if times should be corrected
    // 10 PM
    // 10:10 PM
    // 10:10:00 PM
    // 10:10
    // -->expected
    // 13:15:00.000Z
  }
  return value;
}

const DATE_ERR_MESSAGE =
  'There was an error reading one or more date fields in your file. Ensure date fields are properly formatted with a four character year.';

function transformDate(value: any, dateFormat: string): Maybe<string> {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      try {
        return formatISODate(value, { representation: 'date' });
      } catch (ex) {
        throw new Error(DATE_ERR_MESSAGE);
      }
    } else {
      // date is invalid
      return null;
    }
  } else if (isString(value)) {
    if (REGEX.ISO_DATE.test(value)) {
      try {
        return formatISODate(parseISODate(value), { representation: 'date' });
      } catch (ex) {
        throw new Error(DATE_ERR_MESSAGE);
      }
    }
    try {
      return buildDateFromString(value, dateFormat, 'date');
    } catch (ex) {
      throw new Error(DATE_ERR_MESSAGE);
    }
  }
  return null;
}

function buildDateFromString(value: string, dateFormat: string, representation: 'date' | 'complete') {
  const refDate = startOfDayDate(new Date());
  const tempValue = value.replace(REGEX.NOT_NUMERIC, '-'); // FIXME: some date formats are 'd. m. yyyy' like 'sk-SK'
  let [first, middle, end] = tempValue.split('-');
  if (!first || !middle || !end) {
    return null;
  }
  switch (dateFormat) {
    case DATE_FORMATS.MM_DD_YYYY: {
      first = first.padStart(2, '0');
      middle = middle.padStart(2, '0');
      end = end.padStart(4, '20');
      return formatISODate(parseDate(`${first}-${middle}-${end}`, 'MM-dd-yyyy', refDate), { representation });
    }
    case DATE_FORMATS.DD_MM_YYYY: {
      first = first.padStart(2, '0');
      middle = middle.padStart(2, '0');
      end = end.padStart(4, '20');
      return formatISODate(parseDate(`${first}-${middle}-${end}`, 'dd-MM-yyyy', refDate), { representation });
    }
    case DATE_FORMATS.YYYY_MM_DD: {
      first = first.padStart(4, '20');
      middle = middle.padStart(2, '0');
      end = end.padStart(2, '0');
      return formatISODate(parseDate(`${first}-${middle}-${end}`, 'yyyy-MM-dd', refDate), { representation });
    }
    default:
      break;
  }
}

function transformDateTime(value: string | null | Date, dateFormat: string): Maybe<string> {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return formatISODate(value, { representation: 'complete' });
    } else {
      // date is invalid
      return null;
    }
  } else if (isString(value)) {
    if (REGEX.ISO_DATE.test(value)) {
      return formatISODate(parseISODate(value), { representation: 'complete' });
    }

    value = value.replace('T', ' ');
    const [date, time] = value.split(' ', 2);
    if (!time) {
      return buildDateFromString(date.trim(), dateFormat, 'complete');
    }

    // TODO:
    // based on locale, we need to parse the date and the time
    // could be 12 hour time, or 24 hour time
    // date will vary depending on locale
    return null; // FIXME:
  }
  return null;
}

/**
 * Based on the number of successes or failures, provide an appropriate character for notification
 * This is used when success and error are shown separately
 * @param type
 * @param itemCount
 * @returns
 */
export function getSuccessOrFailureChar(type: 'success' | 'failure', itemCount: number) {
  if (type === 'success') {
    return itemCount > 0 ? '✅' : '❌';
  }
  return itemCount === 0 ? '✅' : '❌';
}

/**
 * Based on the number of successes and failures, provide an appropriate character for notification
 * This is used for a summary (e.x. title)
 * @param type
 * @param itemCount
 * @returns
 */
export function getSuccessOrFailureOrWarningChar(itemSuccessCount: number, itemFailedCount: number) {
  if (itemFailedCount === 0) {
    return '✅';
  } else if (itemSuccessCount === 0) {
    return '❌';
  }
  return '⚠️';
}

/**
 * Returns a map of records
 * {
 *   records: [] // all base records (excludes subquery fields)
 *   // each subquery with records gets split out
 *   accounts__r: []
 *   contacts__r: []
 *   ...: []
 * }
 *
 * @param records
 * @param fields
 * @param subqueryFields
 */
export function getMapOfBaseAndSubqueryRecords(records: any[], fields: string[], subqueryFields: MapOf<string[]>) {
  const output: MapOf<any[]> = {};
  // output['records'] = flattenRecords(records, fields);

  const subqueryFieldsSet = new Set(Object.keys(subqueryFields));
  // split fields into regular fields and subquery fields to partition record
  const [baseFieldsToUse, subqueryFieldsToUse] = fields.reduce(
    (output: [string[], string[]], field) => {
      if (subqueryFieldsSet.has(field)) {
        output[1].push(field);
      } else {
        output[0].push(field);
      }
      return output;
    },
    [[], []]
  );

  // records
  output['records'] = flattenRecords(records, baseFieldsToUse);

  // add key in output for subquery records
  if (subqueryFieldsToUse.length) {
    subqueryFieldsToUse.forEach((field) => {
      const childRecords = records.flatMap((record) => record[field]?.records || []).filter(Boolean);
      if (childRecords.length) {
        output[getExcelSafeSheetName(field)] = flattenRecords(childRecords, subqueryFields[field]);
      }
    });
  }
  return output;
}

/**
 * Sheet names must be unique and have a maximum length of 31 characters.
 * @param name
 * @param existingNames
 * @returns
 */
export function getExcelSafeSheetName(name: string, existingNames: string[] = []) {
  const existingNamesSet = new Set(existingNames);
  let suffixNum = existingNames.length;
  if (!name) {
    name = `Sheet${suffixNum}`;
  } else if (name.length > 31) {
    name = name.substring(0, 31);
  }

  while (existingNamesSet.has(name)) {
    if (name.length + `${suffixNum}`.length > 31) {
      name = `${name.substring(0, 31 - `${suffixNum}`.length)}`;
    }
    name = `${name}${suffixNum}`;
    suffixNum++;
  }
  return name;
}

// https://stackoverflow.com/questions/53228948/how-to-get-image-file-size-from-base-64-string-in-javascript
export function getSizeInMbFromBase64(data: string) {
  if (!data) {
    return 0;
  }
  const padding = data.endsWith('==') ? 2 : 1;
  return (data.length * 0.75 - padding) / 1e6;
}

export function flattenObjectArray(data: MapOf<string[]>, delimiter = ','): MapOf<string> {
  const output: MapOf<string> = {};
  Object.keys(data).forEach((key) => {
    output[key] = data[key].join(delimiter);
  });
  return output;
}

export function isRecordWithId(value: any): value is { Id: string; [key: string]: any } {
  return isString(value.Id);
}

/**
 * Flattens ListItemGroup[] into ListItem[]
 */
export function getFlattenedListItems(items: ListItemGroup[] = []): ListItem[] {
  return (items || []).reduce((output: ListItem[], group) => {
    if (group.items.length) {
      output.push({
        id: group.id,
        label: group.label,
        value: group.id,
        isGroup: true,
      });
      group.items.forEach((item) =>
        output.push({
          ...item,
          group: {
            id: group.id,
            label: group.label,
          },
        })
      );
    }
    return output;
  }, []);
}

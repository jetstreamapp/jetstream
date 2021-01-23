import { QueryResults, QueryResultsColumn } from '@jetstream/api-interfaces';
import {
  BulkJob,
  BulkJobBatchInfo,
  BulkJobBatchInfoUntyped,
  BulkJobUntyped,
  HttpMethod,
  InsertUpdateUpsertDelete,
  ListMetadataResult,
  ListMetadataResultRaw,
  MapOf,
  QueryFieldWithPolymorphic,
  Record,
} from '@jetstream/types';
import fromUnixTime from 'date-fns/fromUnixTime';
import { QueryResult } from 'jsforce';
import { get as lodashGet, isBoolean, isNil, isObject, isString, orderBy } from 'lodash';
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
  const search = (value || '').toLocaleLowerCase().split(' ');
  const hasValue = search.length > 0;
  return (item: T) => {
    if (!hasValue || !item) {
      return true;
    }
    const normalizedValue = props
      .map((prop) => (item[prop] ?? '').toString())
      .join()
      .toLocaleLowerCase();
    return search.every((word) => normalizedValue.includes(word)) || optionalExtraCondition?.(item);
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

export function orderObjectsBy<T>(items: T[], field: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderByItereeFn = (item: T) => (isString(item[field]) ? (item[field] as any).toLowerCase() : item[field]);
  return orderBy(items, [orderByItereeFn], [order]);
}

export function orderStringsBy(items: string[], order: 'asc' | 'desc' = 'asc'): string[] {
  const orderByItereeFn = (value) => (isString(value) ? value.toLowerCase() : value);
  return orderBy(items, [orderByItereeFn], [order]);
}

export function getMapOf<T>(items: T[], prop: keyof T): MapOf<T> {
  return items.reduce((output: MapOf<T>, item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    output[item[prop] as any] = item;
    return output;
  }, {});
}

export function populateFromMapOf<T>(mapOf: MapOf<T>, items: string[]): T[] {
  return items.map((item) => mapOf[item]).filter((item) => !!item);
}

export function flattenRecords(records: Record[], fields: string[]): MapOf<string>[] {
  return records.map((record) => flattenRecord(record, fields));
}

export function flattenRecord(record: Record, fields: string[]): MapOf<string> {
  return fields.reduce((obj, field) => {
    const value = lodashGet(record, field);
    obj[field] = isObject(value) ? JSON.stringify(value).replace(REGEX.LEADING_TRAILING_QUOTES, '') : value;
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
  let output = [];
  let currSet = [];
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

export function toBoolean(value: boolean | string | null | undefined, defaultValue: boolean = false) {
  if (isBoolean(value)) {
    return value;
  }
  if (isString(value)) {
    return value.toLowerCase().startsWith('t');
  }
  return defaultValue;
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

export function pluralizeFromNumber(value: string, num: number, plural: string = 's'): string {
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
        .filter((field) => field.type === 'FieldSubquery')
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
    field: null,
    sobject: null,
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
        polymorphicItems = { field: null, sobject: null, fields: [] };
      }
      // return regular non-TYPEOF fields
      output.push(getField(field.field));
    }
    return output;
  }, []);

  // Compose remaining polymorphic fields
  if (polymorphicItems.field && polymorphicItems.fields.length > 0) {
    outputFields.push(getTypeOfField(polymorphicItems));
    polymorphicItems = { field: null, sobject: null, fields: [] };
  }

  return outputFields;
}

export function ensureBoolean(value: string | boolean | null | undefined) {
  if (isBoolean(value)) {
    return value;
  } else if (isString(value)) {
    return value.toLowerCase().startsWith('t');
  }
  return !!value;
}

export function ensureArray<T = unknown>(value: T): T {
  if (isNil(value)) {
    return [] as any;
  }
  return (Array.isArray(value) ? value : [value]) as any;
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

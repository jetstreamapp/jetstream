import { orderBy, isString, get as lodashGet, isBoolean, isNil } from 'lodash';
import { MapOf, Record, BulkJob, BulkJobUntyped, BulkJobBatchInfo, BulkJobBatchInfoUntyped } from '@jetstream/types';
import { isObject } from 'util';
import { REGEX } from './regex';
import { unix } from 'moment-mini';
import { QueryResults, QueryResultsColumn } from '@jetstream/api-interfaces';
import { QueryResult } from 'jsforce';
import { FieldSubquery } from 'soql-parser-js';

export function NOOP() {}

export function dateFromTimestamp(timestamp: number): Date {
  return unix(timestamp).toDate();
}

export async function alwaysResolve<T = any>(promise: Promise<T>, valueIfError: T): Promise<T> {
  try {
    return await promise;
  } catch (ex) {
    return valueIfError;
  }
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
  return records.map((record) => {
    return fields.reduce((obj, field) => {
      const value = lodashGet(record, field);
      obj[field] = isObject(value) ? JSON.stringify(value).replace(REGEX.LEADING_TRAILING_QUOTES, '') : value;
      return obj;
    }, {});
  });
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
  numberTypes.forEach((prop) => {
    if (job.hasOwnProperty(prop) && typeof job[prop] === 'string') {
      job[prop] = Number(job[prop]);
    }
  });
  return job as BulkJob | BulkJobBatchInfo;
}

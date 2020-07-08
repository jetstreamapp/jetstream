import { orderBy, isString, get as lodashGet, isBoolean } from 'lodash';
import { MapOf, Record } from '@jetstream/types';
import { isObject } from 'util';
import { REGEX } from './regex';
import { unix } from 'moment-mini';

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

export function flattenRecords(records: Record[], fields: string[]) {
  return records.map((record) => {
    return fields.reduce((obj, field) => {
      const value = lodashGet(record, field);
      obj[field] = isObject(value) ? JSON.stringify(value).replace(REGEX.LEADING_TRAILING_QUOTES, '') : value;
      return obj;
    }, {});
  });
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

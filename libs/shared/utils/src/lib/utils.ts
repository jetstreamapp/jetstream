import { orderBy, isString, get as lodashGet, isBoolean } from 'lodash';
import { MapOf, Record, QueryFieldWithPolymorphic } from '@jetstream/types';
import { isObject } from 'util';
import { REGEX } from './regex';
import { unix } from 'moment-mini';
import { QueryResults, QueryResultsColumn } from '@jetstream/api-interfaces';
import { QueryResult } from 'jsforce';
import { FieldSubquery, FieldType, ComposeFieldTypeof, getField } from 'soql-parser-js';

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

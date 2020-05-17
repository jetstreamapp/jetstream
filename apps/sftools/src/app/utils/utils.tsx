import _ from 'lodash';
import { MapOf } from '@silverthorn/api-interfaces';
import { Field } from 'jsforce';

export function orderObjectsBy<T>(items: T[], field: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderByItereeFn = (item: T) => (_.isString(item[field]) ? (item[field] as any).toLowerCase() : item[field]);
  return _.orderBy(items, [orderByItereeFn], [order]);
}

export function orderStringsBy<T>(items: string[], order: 'asc' | 'desc' = 'asc'): T[] {
  const orderByItereeFn = (value) => (_.isString(value) ? value.toLowerCase() : value);
  return _.orderBy(items, [orderByItereeFn], [order]);
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

export function sortQueryFields(fields: Field[]): Field[] {
  // partition name and id field out, then append to front
  const reducedFields = orderObjectsBy(fields, 'label').reduce(
    (out, field) => {
      if (field.name === 'Id') {
        out.id = field;
      } else if (field.name === 'Name') {
        out.name = field;
      } else {
        out.remaining.push(field);
      }
      return out;
    },
    {
      id: null,
      name: null,
      remaining: [],
    }
  );

  const firstItems = [];
  if (reducedFields.id) {
    firstItems.push(reducedFields.id);
  }
  if (reducedFields.name) {
    firstItems.push(reducedFields.name);
  }

  return firstItems.concat(reducedFields.remaining);
}

export function sortQueryFieldsStr(fields: string[]): string[] {
  // partition name and id field out, then append to front
  const reducedFields = fields.reduce(
    (out, field) => {
      if (field === 'Id') {
        out.id = field;
      } else if (field === 'Name') {
        out.name = field;
      } else {
        out.remaining.push(field);
      }
      return out;
    },
    {
      id: null,
      name: null,
      remaining: [],
    }
  );

  const firstItems = [];
  if (reducedFields.id) {
    firstItems.push(reducedFields.id);
  }
  if (reducedFields.name) {
    firstItems.push(reducedFields.name);
  }

  return firstItems.concat(reducedFields.remaining);
}

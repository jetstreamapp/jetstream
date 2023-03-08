import { convertFiltersToWhereClause } from '@jetstream/shared/ui-utils';
import { getMapOf } from '@jetstream/shared/utils';
import { ErrorResult, ExpressionType, ListItemGroup, MapOf, Maybe, QueryFields, Record } from '@jetstream/types';
import formatISO from 'date-fns/formatISO';
import parseISO from 'date-fns/parseISO';
import { Field, FieldType } from 'jsforce';
import isNil from 'lodash/isNil';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import { composeQuery, FieldSubquery, getFlattenedFields, Query } from 'soql-parser-js';

export interface EditFromErrors {
  hasErrors: boolean;
  generalErrors: string[];
  fieldErrors: MapOf<string | undefined>;
}

const CHILD_FIELD_SEPARATOR = `~`;
const DATE_FIELD_TYPES = new Set<FieldType>(['date', 'datetime']);
const TIME_FIELD_TYPES = new Set<FieldType>(['time']);
const NUMBER_TYPES = new Set<FieldType>(['int', 'double', 'currency', 'percent']);

export function composeSoqlQuery(query: Query, whereExpression: ExpressionType) {
  return composeQuery(
    { ...query, where: convertFiltersToWhereClause(whereExpression) },
    { format: true, formatOptions: { fieldMaxLineLength: 80 } }
  );
}

/**
 * Build all the data to show in the field filter
 * This omits any field that is not filterable
 *
 * @param queryFieldsMap Query fields with filter data
 */
export function calculateFilterAndOrderByListGroupFields(
  queryFieldsMap: MapOf<QueryFields>,
  requiredMetadataProps?: [keyof Field]
): ListItemGroup[] {
  const newFilterFields: ListItemGroup[] = [];

  function includeField(metadata: Field) {
    if (Array.isArray(requiredMetadataProps) && requiredMetadataProps.length > 0) {
      return requiredMetadataProps.every((prop) => metadata[prop]);
    }
    return true;
  }

  Object.values(queryFieldsMap)
    .filter((queryField) => !queryField.key.includes(CHILD_FIELD_SEPARATOR))
    .forEach((queryField) => {
      const [base, path] = queryField.key.split('|');
      const currGroup: ListItemGroup = {
        id: queryField.key,
        label: path ? path.substring(0, path.length - 1) : base,
        items: [],
      };
      newFilterFields.push(currGroup);
      Object.values(queryField.fields)
        .filter(({ metadata }) => includeField(metadata))
        .forEach((field) => {
          const value = `${path || ''}${field.name}`;
          currGroup.items.push({
            id: value,
            label: field.label,
            secondaryLabel: `${path}${field.name}`,
            secondaryLabelOnNewLine: true,
            value: value,
            meta: field,
          });
        });
    });
  return newFilterFields;
}

/**
 * Ensure all data is in correct format
 * If a text input has invalid characters, it will be set to NaN to allow invalid detection in validateEditForm
 *
 * returns cloned object
 *
 * @param sobjectFields
 * @param record
 */
export function transformEditForm(sobjectFields: Field[], record: Record): Record {
  record = { ...record };
  const fieldsByName = getMapOf(sobjectFields, 'name');
  Object.keys(record).forEach((fieldName) => {
    const field = fieldsByName[fieldName];
    const value = record[fieldName];
    if (NUMBER_TYPES.has(field.type) && !isNumber(value) && value) {
      record[fieldName] = Number.parseFloat(value);
    } else if (NUMBER_TYPES.has(field.type) && !isNumber(value) && !value) {
      // ensure value is not empty string, as that ends up being coerced to 0
      record[fieldName] = null;
    } else if (DATE_FIELD_TYPES.has(field.type) && isString(value) && value) {
      if (field.type === 'date') {
        record[fieldName] = formatISO(parseISO(value), { representation: 'date' });
      } else {
        // this converts to UTC
        record[fieldName] = parseISO(value).toISOString();
      }
    } else if (TIME_FIELD_TYPES.has(field.type) && isString(value) && value) {
      // Without Z, salesforce will modify the timezone
      record[fieldName] = `${value}Z`;
    }
  });
  return record;
}

/**
 * Combine original record and modified record and set all non-creatable fields to undefined
 */
export function combineRecordsForClone(sobjectFields: Field[], initialRecord: Record, modifiedRecord: Record): Record {
  const clonedRecord = { ...initialRecord, ...modifiedRecord };
  sobjectFields.forEach((field) => {
    if (!field.createable) {
      clonedRecord[field.name] = undefined;
    } else if (clonedRecord[field.name] === null) {
      clonedRecord[field.name] = undefined;
    }
  });
  return JSON.parse(JSON.stringify(clonedRecord));
}

/**
 * Validate all input fields that have been modified
 *
 * @param sobjectFields
 * @param record
 */
export function validateEditForm(sobjectFields: Field[], record: Record): EditFromErrors {
  const fieldsByName = getMapOf(sobjectFields, 'name');
  const output: EditFromErrors = { hasErrors: false, generalErrors: [], fieldErrors: {} };
  output.fieldErrors = Object.keys(record).reduce((fieldErrors: MapOf<string>, fieldName) => {
    const field = fieldsByName[fieldName];
    const value = record[fieldName];
    if (field) {
      if (!field.nillable && value === null) {
        output.hasErrors = true;
        fieldErrors[fieldName] = 'Complete this field';
      } else if (NUMBER_TYPES.has(field.type) && !isNil(value) && value !== '' && !Number.isFinite(value)) {
        output.hasErrors = true;
        fieldErrors[fieldName] = 'Enter a valid value';
      }
    }
    return fieldErrors;
  }, {});
  return output;
}

export function handleEditFormErrorResponse(result: ErrorResult): EditFromErrors {
  const output: EditFromErrors = { hasErrors: false, generalErrors: [], fieldErrors: {} };

  result.errors.forEach((error) => {
    output.hasErrors = true;
    if (error.fields.length) {
      error.fields.forEach((field) => {
        if (error.statusCode === 'REQUIRED_FIELD_MISSING') {
          output.fieldErrors[field] = 'Complete this field';
        } else {
          output.fieldErrors[field] = error.message;
        }
      });
    }
    output.generalErrors.push(error.message);
  });
  return output;
}

/**
 * Get an object with the subquery relationship field as the key and the parsed query for each child part
 *
 * @param query
 * @returns
 */
export function getFlattenSubqueryFlattenedFieldMap(query: Maybe<Query>): MapOf<string[]> {
  return (
    query?.fields
      ?.filter((field) => field.type === 'FieldSubquery')
      .reduce((output: MapOf<string[]>, field: FieldSubquery) => {
        output[field.subquery.relationshipName] = getFlattenedFields(field.subquery);
        return output;
      }, {}) || {}
  );
}

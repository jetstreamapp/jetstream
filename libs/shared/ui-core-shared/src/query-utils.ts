import { convertFiltersToWhereClause } from '@jetstream/shared/ui-utils';
import { groupByFlat } from '@jetstream/shared/utils';
import { ErrorResult, ExpressionType, Field, FieldType, Maybe, SalesforceRecord } from '@jetstream/types';
import { FieldSubquery, HavingClause, Query, WhereClause, composeQuery, getFlattenedFields } from '@jetstreamapp/soql-parser-js';
import { formatISO } from 'date-fns/formatISO';
import { parseISO } from 'date-fns/parseISO';
import isNil from 'lodash/isNil';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';

export interface EditFromErrors {
  hasErrors: boolean;
  generalErrors: string[];
  fieldErrors: Record<string, string | undefined>;
}

const DATE_FIELD_TYPES = new Set<FieldType>(['date', 'datetime']);
const TIME_FIELD_TYPES = new Set<FieldType>(['time']);
const NUMBER_TYPES = new Set<FieldType>(['int', 'double', 'currency', 'percent']);

export function composeSoqlQuery(query: Query, whereExpression: ExpressionType, havingClauses?: ExpressionType) {
  return composeQuery(
    {
      ...query,
      where: convertFiltersToWhereClause<WhereClause>(whereExpression),
      having: havingClauses ? convertFiltersToWhereClause<HavingClause>(havingClauses) : undefined,
    },
    { format: true, formatOptions: { fieldMaxLineLength: 80 } }
  );
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
export function transformEditForm(sobjectFields: Field[], record: SalesforceRecord): SalesforceRecord {
  record = { ...record };
  const fieldsByName = groupByFlat(sobjectFields, 'name');
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
export function combineRecordsForClone(
  sobjectFields: Field[],
  initialRecord: SalesforceRecord,
  modifiedRecord: SalesforceRecord
): SalesforceRecord {
  const clonedRecord = { ...initialRecord, ...modifiedRecord };
  sobjectFields.forEach((field) => {
    if (!field.createable) {
      clonedRecord[field.name] = undefined;
    } else if (clonedRecord[field.name] === null) {
      clonedRecord[field.name] = undefined;
    }
  });
  // Record includes a bunch of related record data so we can show the name of the related record
  // but this will cause errors on record action, so we need to remove it
  Object.keys(clonedRecord).forEach((fieldName) => {
    if (typeof clonedRecord[fieldName] === 'object' && clonedRecord[fieldName] !== null && fieldName !== 'attributes') {
      clonedRecord[fieldName] = undefined;
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
export function validateEditForm(sobjectFields: Field[], record: SalesforceRecord): EditFromErrors {
  const fieldsByName = groupByFlat(sobjectFields, 'name');
  const output: EditFromErrors = { hasErrors: false, generalErrors: [], fieldErrors: {} };
  output.fieldErrors = Object.keys(record).reduce((fieldErrors: Record<string, string>, fieldName) => {
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
export function getFlattenSubqueryFlattenedFieldMap(query: Maybe<Query>): Record<string, string[]> {
  return (
    query?.fields
      ?.filter((field) => field.type === 'FieldSubquery')
      .reduce((output: Record<string, string[]>, field: FieldSubquery) => {
        output[field.subquery.relationshipName] = getFlattenedFields(field.subquery || {});
        return output;
      }, {}) || {}
  );
}

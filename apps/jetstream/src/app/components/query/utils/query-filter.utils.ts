/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  DATE_LITERALS_SET,
  getBooleanListItems,
  getDateLiteralListItems,
  getFlattenedListItemsById,
  getPicklistListItems,
} from '@jetstream/shared/ui-utils';
import { REGEX } from '@jetstream/shared/utils';
import {
  ExpressionConditionHelpText,
  ExpressionConditionRowSelectedItems,
  ExpressionGetResourceTypeFns,
  ExpressionRowValueType,
  Field,
  FieldType,
  ListItem,
  Maybe,
  QueryFilterOperator,
} from '@jetstream/types';

// Used for GROUP BY and HAVING clause
export const QUERY_FIELD_DATE_FUNCTIONS: ListItem<string, QueryFilterOperator>[] = [
  { id: 'CALENDAR_MONTH', label: 'CALENDAR_MONTH', value: 'CALENDAR_MONTH' },
  { id: 'CALENDAR_QUARTER', label: 'CALENDAR_QUARTER', value: 'CALENDAR_QUARTER' },
  { id: 'CALENDAR_YEAR', label: 'CALENDAR_YEAR', value: 'CALENDAR_YEAR' },
  { id: 'DAY_IN_MONTH', label: 'DAY_IN_MONTH', value: 'DAY_IN_MONTH' },
  { id: 'DAY_IN_WEEK', label: 'DAY_IN_WEEK', value: 'DAY_IN_WEEK' },
  { id: 'DAY_IN_YEAR', label: 'DAY_IN_YEAR', value: 'DAY_IN_YEAR' },
  { id: 'DAY_ONLY', label: 'DAY_ONLY', value: 'DAY_ONLY' },
  { id: 'FISCAL_MONTH', label: 'FISCAL_MONTH', value: 'FISCAL_MONTH' },
  { id: 'FISCAL_QUARTER', label: 'FISCAL_QUARTER', value: 'FISCAL_QUARTER' },
  { id: 'FISCAL_YEAR', label: 'FISCAL_YEAR', value: 'FISCAL_YEAR' },
  { id: 'HOUR_IN_DAY', label: 'HOUR_IN_DAY', value: 'HOUR_IN_DAY' },
  { id: 'WEEK_IN_MONTH', label: 'WEEK_IN_MONTH', value: 'WEEK_IN_MONTH' },
  { id: 'WEEK_IN_YEAR', label: 'WEEK_IN_YEAR', value: 'WEEK_IN_YEAR' },
];

export const QUERY_FIELD_FUNCTIONS: ListItem<string, QueryFilterOperator>[] = [
  { id: 'AVG', label: 'AVG', value: 'AVG' },
  { id: 'COUNT', label: 'COUNT', value: 'COUNT' },
  { id: 'COUNT_DISTINCT', label: 'COUNT_DISTINCT', value: 'COUNT_DISTINCT' },
  { id: 'MIN', label: 'MIN', value: 'MIN' },
  { id: 'MAX', label: 'MAX', value: 'MAX' },
  { id: 'SUM', label: 'SUM', value: 'SUM' },
  ...QUERY_FIELD_DATE_FUNCTIONS,
];

export const QUERY_OPERATORS: ListItem<string, QueryFilterOperator>[] = [
  { id: 'eq', label: 'Equals', value: 'eq' },
  { id: 'ne', label: 'Does Not Equal', value: 'ne' },
  { id: 'lt', label: 'Less Than', value: 'lt' },
  { id: 'lte', label: 'Less Than Or Equal To', value: 'lte' },
  { id: 'gt', label: 'Greater Than', value: 'gt' },
  { id: 'gte', label: 'Greater Than Or Equal To', value: 'gte' },
  { id: 'contains', label: 'Contains', value: 'contains' },
  { id: 'doesNotContain', label: 'Does Not Contain', value: 'doesNotContain' },
  { id: 'startsWith', label: 'Starts With', value: 'startsWith' },
  { id: 'doesNotStartWith', label: 'Does Not Start With', value: 'doesNotStartWith' },
  { id: 'endsWith', label: 'Ends With', value: 'endsWith' },
  { id: 'doesNotEndWith', label: 'Does Not End With', value: 'doesNotEndWith' },
  { id: 'isNull', label: 'Is Null', value: 'isNull' },
  { id: 'isNotNull', label: 'Is Not Null', value: 'isNotNull' },
  { id: 'in', label: 'In', value: 'in' },
  { id: 'notIn', label: 'Not In', value: 'notIn' },
  { id: 'includes', label: 'Includes', value: 'includes' },
  { id: 'excludes', label: 'Excludes', value: 'excludes' },
];

function findResourceMeta(fields: ListItem[], selected: ExpressionConditionRowSelectedItems) {
  return selected.resource && getFlattenedListItemsById(fields)[selected.resource]?.meta;
}

function isListOperator(operator: Maybe<QueryFilterOperator>): boolean {
  return operator === 'in' || operator === 'notIn' || operator === 'includes' || operator === 'excludes';
}

function isDatetimeCompatibleFilter(operator: Maybe<QueryFilterOperator>): boolean {
  return operator === 'lt' || operator === 'lte' || operator === 'gt' || operator === 'gte';
}

function isLikeOperator(operator: Maybe<QueryFilterOperator>): boolean {
  return (
    operator === 'contains' ||
    operator === 'doesNotContain' ||
    operator === 'startsWith' ||
    operator === 'doesNotStartWith' ||
    operator === 'endsWith' ||
    operator === 'doesNotEndWith'
  );
}

function isIncludesExcludesOperator(operator: Maybe<QueryFilterOperator>): boolean {
  return operator === 'includes' || operator === 'excludes';
}

export function getPicklistSingleResourceTypes(): ListItem<ExpressionRowValueType>[] {
  return [
    {
      id: 'picklistValue',
      label: 'Picklist Value',
      value: 'SELECT',
    },
    {
      id: 'text',
      label: 'Text',
      value: 'TEXT',
    },
  ];
}

export function getPicklistMultiResourceTypes(): ListItem<ExpressionRowValueType>[] {
  return [
    {
      id: 'picklistValue',
      label: 'Picklist Value',
      value: 'SELECT-MULTI',
    },
    {
      id: 'text',
      label: 'Text',
      value: 'TEXTAREA',
    },
  ];
}

export function getDateResourceTypes(): ListItem<ExpressionRowValueType>[] {
  return [
    {
      id: 'date',
      label: 'Date Picker',
      value: 'DATE',
    },
    {
      id: 'literal',
      label: 'Relative Value',
      value: 'SELECT',
    },
    {
      id: 'manual',
      label: 'Manual Value',
      value: 'TEXT',
    },
  ];
}

export function getDateMultiResourceTypes(): ListItem<ExpressionRowValueType>[] {
  return [
    {
      id: 'date',
      label: 'Date Picker',
      value: 'DATE',
    },
    {
      id: 'literal',
      label: 'Relative Value',
      value: 'SELECT-MULTI',
    },
    {
      id: 'manual',
      label: 'Manual Value',
      value: 'TEXT',
    },
  ];
}

export function getDateTimeResourceTypes(): ListItem<ExpressionRowValueType>[] {
  return [
    {
      id: 'date',
      label: 'Date Picker',
      value: 'DATETIME',
    },
    {
      id: 'literal',
      label: 'Relative Value',
      value: 'SELECT',
    },
    {
      id: 'manual',
      label: 'Manual Value',
      value: 'TEXT',
    },
  ];
}

export function getDateTimeMultiResourceTypes(): ListItem<ExpressionRowValueType>[] {
  return [
    {
      id: 'date',
      label: 'Date Picker',
      value: 'DATETIME',
    },
    {
      id: 'literal',
      label: 'Relative Value',
      value: 'SELECT-MULTI',
    },
    {
      id: 'manual',
      label: 'Manual Value',
      value: 'TEXT',
    },
  ];
}

export function getTypeFromMetadata(type: FieldType, operator: Maybe<QueryFilterOperator>, value?: string | string[]) {
  /**
   * TODO:
   * int / double / currency / percent
   * reference
   * time
   */

  switch (type) {
    case 'date': {
      // default to SELECT if value is a date literal (query restore would have a value)
      if (Array.isArray(value) || DATE_LITERALS_SET.has(value || '')) {
        return isListOperator(operator) ? 'SELECT-MULTI' : 'SELECT';
      } else if (value && REGEX.NUMERIC.test(value)) {
        return 'TEXT';
      }
      return 'DATE';
    }
    case 'datetime': {
      // default to SELECT (Relative Value) if no value or value is a date literal (query restore would have a value)
      if (!value || Array.isArray(value) || DATE_LITERALS_SET.has(value)) {
        return isListOperator(operator) ? 'SELECT-MULTI' : 'SELECT';
      } else if (value && REGEX.NUMERIC.test(value)) {
        return 'TEXT';
      }
      return 'DATETIME';
    }
    case 'boolean':
    case 'picklist':
    case 'multipicklist': {
      return isListOperator(operator) ? 'SELECT-MULTI' : 'SELECT';
    }
    default:
      return isListOperator(operator) ? 'TEXTAREA' : 'TEXT';
  }
}

export function getFieldSelectItems(field: Field): ListItem<string, any>[] {
  switch (field.type) {
    case 'date':
    case 'datetime':
      return getDateLiteralListItems();
    case 'boolean':
      return getBooleanListItems();
    case 'picklist':
    case 'multipicklist':
      return getPicklistListItems(field);
    default:
      return [];
  }
}

export function ensureFieldSelectItemsIncludesSelectionsFromRestore(
  field: Field,
  listItems: ListItem<string, any>[],
  value: string | string[]
) {
  switch (field.type) {
    case 'picklist':
    case 'multipicklist': {
      // determine if the query included values that are not in the list, and add them if so
      const selectedValues = new Set(Array.isArray(value) ? value : [value]);
      listItems.forEach((item) => selectedValues.delete(item.value));
      selectedValues.forEach((item) => listItems.push({ id: item, label: item, value: item }));
      return listItems;
    }
    default:
      return listItems;
  }
}

export function getFieldResourceTypes(
  field: Field,
  operator: Maybe<QueryFilterOperator>
): ListItem<ExpressionRowValueType, any>[] | undefined {
  if (!operator) {
    return;
  }
  if (field.type === 'picklist' || field.type === 'multipicklist') {
    return isListOperator(operator) ? getPicklistMultiResourceTypes() : getPicklistSingleResourceTypes();
  } else if (field.type === 'date') {
    return isListOperator(operator) ? getDateMultiResourceTypes() : getDateResourceTypes();
  } else if (field.type === 'datetime') {
    return isListOperator(operator) ? getDateTimeMultiResourceTypes() : getDateTimeResourceTypes();
  }
  return;
}

export function getResourceTypeFnsFromFields(fields: ListItem[]): ExpressionGetResourceTypeFns {
  const getResourceTypeFns: ExpressionGetResourceTypeFns & { fields: ListItem[] } = {
    fields,
    getTypes: (selected: ExpressionConditionRowSelectedItems): ListItem<ExpressionRowValueType>[] | undefined => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
      if (!fieldMeta) {
        return;
      }
      return getFieldResourceTypes(fieldMeta, selected.operator);
    },
    getType: (selected: ExpressionConditionRowSelectedItems): ExpressionRowValueType | undefined => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
      if (!fieldMeta) {
        return;
      }
      // e.x. IN or NOT NULL
      if (selected.resourceType) {
        return selected.resourceType;
      }
      return getTypeFromMetadata(fieldMeta.type, selected.operator);
    },
    getHelpText: (selected: ExpressionConditionRowSelectedItems): ExpressionConditionHelpText | undefined => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
      if (!fieldMeta) {
        return undefined;
      }
      if (fieldMeta.type === 'datetime' && selected.resourceType === 'DATETIME' && !isDatetimeCompatibleFilter(selected.operator)) {
        return { type: 'warning', value: 'Datetime filters work best with a relative value or the Greater Than, Less Than operators.' };
      }
      if (fieldMeta.type === 'id' && isLikeOperator(selected.operator)) {
        return { type: 'warning', value: 'The selected operator is not allowed with Id fields.' };
      }
      if (fieldMeta.type === 'multipicklist') {
        return { type: 'hint', value: 'Use Includes and Excludes to match multiple values for multi-select picklists.' };
      }
      if (isIncludesExcludesOperator(selected.operator)) {
        return { type: 'warning', value: 'Includes and Excludes operators are only compatible with multi-select picklists.' };
      }
    },
    checkSelected: (selected: ExpressionConditionRowSelectedItems): ExpressionConditionRowSelectedItems => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
      if (!fieldMeta) {
        return selected;
      }

      if (
        (fieldMeta.type === 'multipicklist' || fieldMeta.type === 'picklist') &&
        isListOperator(selected.operator) &&
        !Array.isArray(selected.value)
      ) {
        if (selected.value) {
          selected.value = [selected.value];
        } else {
          selected.value = [];
        }
      } else if (
        (fieldMeta.type === 'multipicklist' || fieldMeta.type === 'picklist') &&
        !isListOperator(selected.operator) &&
        Array.isArray(selected.value)
      ) {
        if (selected.value.length) {
          selected.value = selected.value[0];
        } else {
          selected.value = '';
        }
      }
      return selected;
    },
    getSelectItems: (selected: ExpressionConditionRowSelectedItems): ListItem[] | undefined => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
      if (!fieldMeta) {
        return [];
      }
      return ensureFieldSelectItemsIncludesSelectionsFromRestore(fieldMeta, getFieldSelectItems(fieldMeta), selected.value);
    },
  };
  return getResourceTypeFns;
}

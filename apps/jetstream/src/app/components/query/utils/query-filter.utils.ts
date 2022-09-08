/* eslint-disable @typescript-eslint/no-unused-vars */
import { DATE_LITERALS_SET, getBooleanListItems, getDateLiteralListItems, getPicklistListItems } from '@jetstream/shared/ui-utils';
import {
  ExpressionConditionHelpText,
  ExpressionConditionRowSelectedItems,
  ExpressionGetResourceTypeFns,
  ExpressionRowValueType,
  ListItem,
  ListItemGroup,
  QueryFilterOperator,
} from '@jetstream/types';
import { Field, FieldType } from 'jsforce';

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

function findResourceMeta(fields: ListItemGroup[], selected: ExpressionConditionRowSelectedItems) {
  return fields.find((group) => group.id === selected.resourceGroup)?.items.find((item) => item.id === selected.resource).meta.metadata;
}

function isListOperator(operator: QueryFilterOperator): boolean {
  return operator === 'in' || operator === 'notIn' || operator === 'includes' || operator === 'excludes';
}

function isDatetimeCompatibleFilter(operator: QueryFilterOperator): boolean {
  return operator === 'lt' || operator === 'lte' || operator === 'gt' || operator === 'gte';
}

function isLikeOperator(operator: QueryFilterOperator): boolean {
  return (
    operator === 'contains' ||
    operator === 'doesNotContain' ||
    operator === 'startsWith' ||
    operator === 'doesNotStartWith' ||
    operator === 'endsWith' ||
    operator === 'doesNotEndWith'
  );
}

function isIncludesExcludesOperator(operator: QueryFilterOperator): boolean {
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
  ];
}

export function getTypeFromMetadata(type: FieldType, operator: QueryFilterOperator, value?: string | string[]) {
  /**
   * TODO:
   * int / double / currency / percent
   * reference
   * time
   */

  switch (type) {
    case 'date': {
      // default to SELECT if value is a date literal (query restore would have a value)
      if (Array.isArray(value) || DATE_LITERALS_SET.has(value)) {
        return isListOperator(operator) ? 'SELECT-MULTI' : 'SELECT';
      }
      return 'DATE';
    }
    case 'datetime': {
      // default to SELECT (Relative Value) if no value or value is a date literal (query restore would have a value)
      if (!value || Array.isArray(value) || DATE_LITERALS_SET.has(value)) {
        return isListOperator(operator) ? 'SELECT-MULTI' : 'SELECT';
      }
      return 'SELECT';
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

export function getFieldResourceTypes(field: Field, operator: QueryFilterOperator): ListItem<ExpressionRowValueType, any>[] {
  if (field.type === 'picklist' || field.type === 'multipicklist') {
    return isListOperator(operator) ? getPicklistMultiResourceTypes() : getPicklistSingleResourceTypes();
  } else if (field.type === 'date') {
    return isListOperator(operator) ? getDateMultiResourceTypes() : getDateResourceTypes();
  } else if (field.type === 'datetime') {
    return isListOperator(operator) ? getDateTimeMultiResourceTypes() : getDateTimeResourceTypes();
  }
  return undefined;
}

export function getResourceTypeFnsFromFields(fields: ListItemGroup[]): ExpressionGetResourceTypeFns {
  const getResourceTypeFns: ExpressionGetResourceTypeFns = {
    getTypes: (selected: ExpressionConditionRowSelectedItems): ListItem<ExpressionRowValueType>[] => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
      if (!fieldMeta) {
        return undefined;
      }
      return getFieldResourceTypes(fieldMeta, selected.operator);
    },
    getType: (selected: ExpressionConditionRowSelectedItems): ExpressionRowValueType => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
      if (!fieldMeta) {
        return undefined;
      }
      // e.x. IN or NOT NULL
      if (selected.resourceType) {
        return selected.resourceType;
      }
      return getTypeFromMetadata(fieldMeta.type, selected.operator);
    },
    getHelpText: (selected: ExpressionConditionRowSelectedItems): ExpressionConditionHelpText => {
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

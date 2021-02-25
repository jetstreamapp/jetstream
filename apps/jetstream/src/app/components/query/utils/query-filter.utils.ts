/* eslint-disable @typescript-eslint/no-unused-vars */
import { getBooleanListItems, getDateLiteralListItems, getPicklistListItems } from '@jetstream/shared/ui-utils';
import {
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

export function getTypeFromMetadata(type: FieldType, operator: QueryFilterOperator) {
  /**
   * TODO:
   * int / double / currency / percent
   * reference
   * time
   */
  switch (type) {
    case 'date':
      return 'DATE';
    case 'datetime':
      return 'DATETIME';
    case 'boolean':
    case 'picklist':
    case 'multipicklist': {
      if (isListOperator(operator)) {
        return 'SELECT-MULTI';
      }
      return 'SELECT';
    }
    default:
      if (isListOperator(operator)) {
        return 'TEXTAREA';
      }
      return 'TEXT';
  }
}

export function getFieldSelectItems(field: Field) {
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

export function getFieldResourceTypes(field: Field, operator: QueryFilterOperator): ListItem<ExpressionRowValueType, any>[] {
  if (field.type === 'picklist' || field.type === 'multipicklist') {
    if (isListOperator(operator)) {
      return getPicklistMultiResourceTypes();
    }
    return getPicklistSingleResourceTypes();
  } else if (field.type === 'date') {
    return getDateResourceTypes();
  } else if (field.type === 'datetime') {
    return getDateTimeResourceTypes();
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
    checkSelected: (selected: ExpressionConditionRowSelectedItems): ExpressionConditionRowSelectedItems => {
      if (isListOperator(selected.operator) && !Array.isArray(selected.value)) {
        if (selected.value) {
          selected.value = [selected.value];
        } else {
          selected.value = [];
        }
      } else if (!isListOperator(selected.operator) && Array.isArray(selected.value)) {
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
      return getFieldSelectItems(fieldMeta);
    },
  };
  return getResourceTypeFns;
}

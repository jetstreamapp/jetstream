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
import { ExpressionContainer } from '@jetstream/ui';
import { Field } from 'jsforce';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import * as fromQueryState from '../query.state';

export interface QueryFilterProps {
  fields: ListItemGroup[];
}

const operators: ListItem<string, QueryFilterOperator>[] = [
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

function resourceTypeFns(fields: ListItemGroup[]): ExpressionGetResourceTypeFns {
  const getResourceTypeFns: ExpressionGetResourceTypeFns = {
    getTypes: (selected: ExpressionConditionRowSelectedItems): ListItem<ExpressionRowValueType>[] => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
      if (!fieldMeta) {
        return undefined;
      }
      if (fieldMeta.type === 'date') {
        return [
          {
            id: 'date',
            label: 'Date',
            value: 'DATE',
          },
          {
            id: 'literal',
            label: 'Literal',
            value: 'SELECT',
          },
        ];
      } else if (fieldMeta.type === 'datetime') {
        return [
          {
            id: 'date',
            label: 'Date',
            value: 'DATETIME',
          },
          {
            id: 'literal',
            label: 'Literal',
            value: 'SELECT',
          },
        ];
      }
      return undefined;
    },
    getType: (selected: ExpressionConditionRowSelectedItems): ExpressionRowValueType => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
      // TODO: can also take selected.operator into account as well
      // e.x. IN or NOT NULL
      if (selected.resourceType) {
        return selected.resourceType;
      }
      if (!fieldMeta) {
        return undefined;
      }
      /**
       * TODO:
       * boolean <---- could we show
       * int / double / currency / percent
       * reference
       * time
       */
      switch (fieldMeta.type) {
        case 'date':
          return 'DATE';
        case 'datetime':
          return 'DATETIME';
        case 'boolean':
        case 'picklist':
        case 'multipicklist': {
          if (isListOperator(selected.operator)) {
            return 'SELECT-MULTI';
          }
          return 'SELECT';
        }
        default:
          if (isListOperator(selected.operator)) {
            return 'TEXTAREA';
          }
          return 'TEXT';
      }
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
      switch (fieldMeta.type) {
        case 'date':
        case 'datetime':
          return getDateLiteralListItems();
        case 'boolean':
          return getBooleanListItems();
        case 'picklist':
        case 'multipicklist':
          return getPicklistListItems(fieldMeta);
        default:
          return [];
      }
    },
  };
  return getResourceTypeFns;
}

const disableValueForOperators: QueryFilterOperator[] = ['isNull', 'isNotNull'];

export const QueryFilter: FunctionComponent<QueryFilterProps> = ({ fields }) => {
  const isMounted = useRef(null);

  const [queryFilters, setQueryFilters] = useRecoilState(fromQueryState.queryFiltersState);
  const [initialQueryFilters] = useState(queryFilters);
  const [getResourceTypeFns, setResourceTypeFns] = useState(() => resourceTypeFns(fields));

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  // ensure that we have fields in scope
  useEffect(() => {
    setResourceTypeFns(resourceTypeFns(fields));
  }, [fields]);

  return (
    <ExpressionContainer
      expressionInitValue={initialQueryFilters}
      actionLabel="Filter When"
      resourceHelpText="Related fields must be selected to appear in this list and only fields that allow filtering are included."
      resourceLabel="Fields"
      resources={fields}
      operators={operators}
      getResourceTypeFns={getResourceTypeFns}
      disableValueForOperators={disableValueForOperators}
      onChange={(filters) => {
        if (isMounted.current) {
          setQueryFilters(filters);
        }
      }}
    />
  );
};

export default QueryFilter;

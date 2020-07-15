/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ExpressionType,
  ListItem,
  QueryFilterOperator,
  ListItemGroup,
  ExpressionGetResourceTypeFns,
  ExpressionConditionRowSelectedItems,
  ExpressionRowValueType,
} from '@jetstream/types';
import { ExpressionContainer } from '@jetstream/ui';
import React, { FunctionComponent, useState, useEffect } from 'react';
import * as fromQueryState from '../query.state';
import { useRecoilState } from 'recoil';
import { Field } from 'jsforce';
import { getDateLiteralListItems, getBooleanListItems, getPicklistListItems } from '@jetstream/shared/ui-utils';
import { logger } from '@jetstream/shared/client-logger';

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

function resourceTypeFns(fields: ListItemGroup[]) {
  const getResourceTypeFns: ExpressionGetResourceTypeFns = {
    getTypes: (selected: ExpressionConditionRowSelectedItems): ListItem<ExpressionRowValueType>[] => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
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
        case 'multipicklist':
          return 'SELECT';
        default:
          if (
            selected.operator === 'in' ||
            selected.operator === 'notIn' ||
            selected.operator === 'includes' ||
            selected.operator === 'excludes'
          ) {
            return 'TEXTAREA';
          }
          return 'TEXT';
      }
    },
    getSelectItems: (selected: ExpressionConditionRowSelectedItems): ListItem[] | undefined => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
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

export const QueryFilter: FunctionComponent<QueryFilterProps> = ({ fields }) => {
  const [queryFilters, setQueryFilters] = useRecoilState(fromQueryState.queryFiltersState);
  const [initialQueryFilters] = useState(queryFilters);
  const [getResourceTypeFns, setResourceTypeFns] = useState(() => resourceTypeFns(fields));

  // ensure that we have fields in scope
  useEffect(() => {
    setResourceTypeFns(resourceTypeFns(fields));
  }, [fields]);

  return (
    <ExpressionContainer
      expressionInitValue={initialQueryFilters}
      actionLabel="Filter When"
      resourceHelpText="Related fields must be selected to appear in this list"
      resourceLabel="Fields"
      resources={fields}
      operators={operators}
      getResourceTypeFns={getResourceTypeFns}
      disableValueForOperators={['isNull', 'isNotNull']}
      onChange={(filters) => {
        logger.log({ filters });
        setQueryFilters(filters);
      }}
    />
  );
};

export default QueryFilter;

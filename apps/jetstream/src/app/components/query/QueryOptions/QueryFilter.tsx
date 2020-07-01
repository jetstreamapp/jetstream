/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ExpressionType,
  ListItem,
  QueryFilterOperator,
  ListItemGroup,
  ExpressionGetResourceTypeFns,
  ExpressionConditionRowSelectedItems,
  SelectTextTextAreaDateDateTime,
} from '@jetstream/types';
import { ExpressionContainer } from '@jetstream/ui';
import React, { FunctionComponent, useState, useEffect } from 'react';
import * as fromQueryState from '../query.state';
import { useRecoilState } from 'recoil';
import { Field } from 'jsforce';

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
    getTypes: (selected: ExpressionConditionRowSelectedItems): ListItem<SelectTextTextAreaDateDateTime>[] => {
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
    getType: (selected: ExpressionConditionRowSelectedItems): SelectTextTextAreaDateDateTime => {
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
          return 'TEXT';
      }
    },
    getSelectItems: (selected: ExpressionConditionRowSelectedItems): ListItem[] | undefined => {
      const fieldMeta: Field = findResourceMeta(fields, selected);
      switch (fieldMeta.type) {
        case 'date':
        case 'datetime':
          return [
            {
              id: 'TODAY',
              label: 'TODAY',
              value: 'TODAY',
            },
            {
              id: 'YESTERDAY',
              label: 'YESTERDAY',
              value: 'YESTERDAY',
            },
          ];
        case 'boolean':
          return [
            {
              id: 'True',
              label: 'True',
              value: 'True',
            },
            {
              id: 'False',
              label: 'False',
              value: 'False',
            },
          ];
        case 'picklist':
        case 'multipicklist':
          return [
            {
              id: '~~empty~~',
              label: `-- No Value --`,
              value: '',
            },
          ].concat(
            fieldMeta.picklistValues.map((item) => ({
              id: item.value,
              label: item.label || item.value,
              value: item.value,
            }))
          );
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
      resources={fields}
      operators={operators}
      getResourceTypeFns={getResourceTypeFns}
      onChange={setQueryFilters}
    />
  );
};

export default QueryFilter;

/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExpressionType, ListItem, QueryFilterOperator, ListItemGroup } from '@jetstream/types';
import { ExpressionContainer } from '@jetstream/ui';
import React, { FunctionComponent } from 'react';
import * as fromQueryState from './query.state';
import { useRecoilState } from 'recoil';

export interface QueryFilterProps {
  fields: ListItemGroup[];
}

const resources = [
  { id: 'Id', label: 'Id', value: 'Id' },
  { id: 'Name', label: 'Name', value: 'Name' },
  { id: 'Type', label: 'Type', value: 'Type__c' },
];

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

export const QueryFilter: FunctionComponent<QueryFilterProps> = ({ fields }) => {
  const [queryFilters, setQueryFilters] = useRecoilState(fromQueryState.queryFiltersState);
  return (
    <ExpressionContainer
      expressionInitValue={queryFilters}
      actionLabel="Filter When"
      resources={fields}
      operators={operators}
      onChange={setQueryFilters}
    />
  );
};

export default QueryFilter;

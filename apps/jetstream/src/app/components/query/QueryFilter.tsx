/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExpressionType } from '@jetstream/types';
import { ExpressionContainer } from '@jetstream/ui';
import React, { FunctionComponent } from 'react';

export interface QueryFilterProps {
  // TODO: fields, which will be converted to resources
  onChange: (expression: ExpressionType) => void;
}

const resources = [
  { id: 'Id', label: 'Id', value: 'Id' },
  { id: 'Name', label: 'Name', value: 'Name' },
  { id: 'Type', label: 'Type', value: 'Type__c' },
];

const operators = [
  { id: '=', label: 'Equals', value: '=' },
  { id: '!=', label: 'Does Not Equal', value: '!=' },
  { id: 'like', label: 'Contains', value: 'LIKE' },
];

export const QueryFilter: FunctionComponent<QueryFilterProps> = ({ onChange }) => {
  return <ExpressionContainer actionLabel="Filter When" resources={resources} operators={operators} onChange={onChange} />;
};

export default QueryFilter;

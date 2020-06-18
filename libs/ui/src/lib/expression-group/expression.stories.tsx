import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import React from 'react';
import Expression from './Expression';
import ExpressionContainer from './ExpressionContainer';
import { ListItem, ListItemGroup, QueryFilterOperator } from '@jetstream/types';

export default {
  component: Expression,
  title: 'Expression',
};

const resources: ListItemGroup[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'Id', label: 'Id', value: 'Id' },
      { id: 'Name', label: 'Name', value: 'Name' },
      { id: 'Type', label: 'Type', value: 'Type__c' },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    items: [
      { id: 'Contact.Id', label: 'Id', value: 'Id' },
      { id: 'Contact.FirstName', label: 'FirstName', value: 'FirstName' },
      { id: 'Contact.LastName', label: 'LastName', value: 'LastName' },
    ],
  },
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

export const base = () => (
  <ExpressionContainer
    title={text('title', 'Some fancy title')}
    actionLabel={text('actionLabel', 'Filter When')}
    resourceLabel={text('resourceLabel', undefined)}
    operatorLabel={text('operatorLabel', undefined)}
    valueLabel={text('valueLabel', undefined)}
    resources={resources}
    operators={operators}
    expressionInitValue={undefined}
    onChange={action('onChange')}
  />
);

export const preSelected = () => (
  <ExpressionContainer
    title={text('title', 'Some fancy title')}
    actionLabel={text('actionLabel', 'Filter When')}
    resourceLabel={text('resourceLabel', undefined)}
    operatorLabel={text('operatorLabel', undefined)}
    valueLabel={text('valueLabel', undefined)}
    resources={resources}
    operators={operators}
    expressionInitValue={{
      action: 'AND',
      rows: [
        {
          key: 0,
          selected: {
            operator: 'contains',
            resource: resources[0].items[0].id,
            value: 'FOO',
          },
        },
      ],
      groups: [],
    }}
    onChange={action('onChange')}
  />
);

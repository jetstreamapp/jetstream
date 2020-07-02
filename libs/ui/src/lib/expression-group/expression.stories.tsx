import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import React from 'react';
import Expression from './Expression';
import ExpressionContainer from './ExpressionContainer';
import {
  ListItem,
  ListItemGroup,
  QueryFilterOperator,
  ExpressionConditionRowSelectedItems,
  ExpressionRowValueType,
  ExpressionGetResourceTypeFns,
} from '@jetstream/types';

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
            resourceGroup: null,
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

export const changeValueInputBasedOnResource = () => {
  const listItemGroup: ListItemGroup[] = [
    {
      id: 'account',
      label: 'Account',
      items: [
        {
          id: 'Id',
          label: 'Id',
          value: 'Id',
          meta: {
            type: 'Id',
          },
        },
        {
          id: 'CreatedDate',
          label: 'Created Date',
          value: 'CreatedDate',
          meta: {
            type: 'Date',
          },
        },
        {
          id: 'Type',
          label: 'Type',
          value: 'Type__c',
          meta: {
            type: 'Picklist',
            values: [
              { name: 'super', label: 'Super' },
              { name: 'duper', label: 'Duper' },
              { name: 'regular', label: 'Regular' },
            ],
          },
        },
      ],
    },
  ];

  function findResourceMeta(selected: ExpressionConditionRowSelectedItems) {
    return listItemGroup.find((group) => group.id === selected.resourceGroup)?.items.find((item) => item.id === selected.resource).meta;
  }

  const getResourceTypeFns: ExpressionGetResourceTypeFns = {
    getTypes: (selected: ExpressionConditionRowSelectedItems): ListItem<ExpressionRowValueType>[] => {
      const meta = findResourceMeta(selected);
      if (meta.type === 'Date') {
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
      } else if (meta.type === 'Datetime') {
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
      const meta = findResourceMeta(selected);
      // TODO: can also take selected.operator into account as well
      if (selected.resourceType) {
        return selected.resourceType;
      }
      switch (meta.type) {
        case 'Id': // TODO: add real and accurate types
          return 'TEXT';
        case 'Date':
          return 'DATE';
        case 'DateTime':
          return 'DATETIME';
        case 'Picklist':
          return 'SELECT';
        default:
          return 'TEXT';
      }
    },
    getSelectItems: (selected: ExpressionConditionRowSelectedItems): ListItem[] | undefined => {
      const meta = findResourceMeta(selected);
      if (meta.type === 'Picklist') {
        return meta.values.map((item) => ({
          id: item.name,
          label: item.label,
          value: item.name,
        }));
      } else if (meta.type === 'Date' && selected.resourceType === 'SELECT') {
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
      }
      return [];
    },
  };

  return (
    <ExpressionContainer
      title={text('title', 'Some fancy title')}
      actionLabel={text('actionLabel', 'Filter When')}
      resourceLabel={text('resourceLabel', undefined)}
      operatorLabel={text('operatorLabel', undefined)}
      valueLabel={text('valueLabel', undefined)}
      resources={listItemGroup}
      operators={operators}
      getResourceTypeFns={getResourceTypeFns}
      onChange={action('onChange')}
    />
  );
};

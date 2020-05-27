import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import React from 'react';
import Expression from './Expression';
import ExpressionContainer from './ExpressionContainer';

export default {
  component: Expression,
  title: 'Expression',
};

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

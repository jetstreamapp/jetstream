import { action } from '@storybook/addon-actions';
import { text, object, select } from '@storybook/addon-knobs';
import React from 'react';
import Expression from './Expression';
import ExpressionConditionRow from './ExpressionConditionRow';
import ExpressionGroup from './ExpressionGroup';

export default {
  component: Expression,
  title: 'Expression',
};

export const base = () => (
  <Expression actionLabel={text('actionLabel', 'Filter When')} title={text('title', 'Filter')}>
    <ExpressionConditionRow
      row={1}
      resources={[
        { id: 'Id', label: 'Id', value: 'Id' },
        { id: 'Name', label: 'Name', value: 'Name' },
        { id: 'Type', label: 'Type', value: 'Type__c' },
      ]}
      operators={[
        { id: '=', label: 'Equals', value: '=' },
        { id: '!=', label: 'Does Not Equal', value: '!=' },
        { id: 'like', label: 'Contains', value: 'LIKE' },
      ]}
      selected={object('', {
        resource: '',
        operator: '',
        value: '',
      })}
      onChange={action('onChange')}
    ></ExpressionConditionRow>
    <ExpressionConditionRow
      row={2}
      groupingOperator="AND"
      resources={[
        { id: 'Id', label: 'Id', value: 'Id' },
        { id: 'Name', label: 'Name', value: 'Name' },
        { id: 'Type', label: 'Type', value: 'Type__c' },
      ]}
      operators={[
        { id: '=', label: 'Equals', value: '=' },
        { id: '!=', label: 'Does Not Equal', value: '!=' },
        { id: 'like', label: 'Contains', value: 'LIKE' },
      ]}
      selected={object('', {
        resource: '',
        operator: '',
        value: '',
      })}
      onChange={action('onChange')}
    ></ExpressionConditionRow>
  </Expression>
);

export const withGroup = () => (
  <Expression actionLabel={text('actionLabel', 'Filter When')} title={text('title', 'Filter')}>
    <ExpressionConditionRow
      row={1}
      resources={[
        { id: 'Id', label: 'Id', value: 'Id' },
        { id: 'Name', label: 'Name', value: 'Name' },
        { id: 'Type', label: 'Type', value: 'Type__c' },
      ]}
      operators={[
        { id: '=', label: 'Equals', value: '=' },
        { id: '!=', label: 'Does Not Equal', value: '!=' },
        { id: 'like', label: 'Contains', value: 'LIKE' },
      ]}
      selected={object('', {
        resource: '',
        operator: '',
        value: '',
      })}
      onChange={action('onChange')}
    ></ExpressionConditionRow>
    <ExpressionConditionRow
      row={2}
      groupingOperator="AND"
      resources={[
        { id: 'Id', label: 'Id', value: 'Id' },
        { id: 'Name', label: 'Name', value: 'Name' },
        { id: 'Type', label: 'Type', value: 'Type__c' },
      ]}
      operators={[
        { id: '=', label: 'Equals', value: '=' },
        { id: '!=', label: 'Does Not Equal', value: '!=' },
        { id: 'like', label: 'Contains', value: 'LIKE' },
      ]}
      selected={object('', {
        resource: '',
        operator: '',
        value: '',
      })}
      onChange={action('onChange')}
    ></ExpressionConditionRow>

    <ExpressionGroup group={1} groupingOperator="AND">
      <ExpressionConditionRow
        row={3}
        group={1}
        resources={[
          { id: 'Id', label: 'Id', value: 'Id' },
          { id: 'Name', label: 'Name', value: 'Name' },
          { id: 'Type', label: 'Type', value: 'Type__c' },
        ]}
        operators={[
          { id: '=', label: 'Equals', value: '=' },
          { id: '!=', label: 'Does Not Equal', value: '!=' },
          { id: 'like', label: 'Contains', value: 'LIKE' },
        ]}
        selected={object('', {
          resource: '',
          operator: '',
          value: '',
        })}
        onChange={action('onChange')}
      ></ExpressionConditionRow>
      <ExpressionConditionRow
        row={4}
        group={1}
        groupingOperator="AND"
        resources={[
          { id: 'Id', label: 'Id', value: 'Id' },
          { id: 'Name', label: 'Name', value: 'Name' },
          { id: 'Type', label: 'Type', value: 'Type__c' },
        ]}
        operators={[
          { id: '=', label: 'Equals', value: '=' },
          { id: '!=', label: 'Does Not Equal', value: '!=' },
          { id: 'like', label: 'Contains', value: 'LIKE' },
        ]}
        selected={object('', {
          resource: '',
          operator: '',
          value: '',
        })}
        onChange={action('onChange')}
      ></ExpressionConditionRow>
    </ExpressionGroup>
  </Expression>
);

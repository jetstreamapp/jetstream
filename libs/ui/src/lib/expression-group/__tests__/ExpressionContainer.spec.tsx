import {
  ExpressionConditionType,
  ExpressionGetResourceTypeFns,
  ExpressionType,
  ListItem,
  QueryFilterOperator,
  SalesforceOrgUi,
} from '@jetstream/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExpressionContainer } from '../ExpressionContainer';

const ORG = {} as SalesforceOrgUi;

const RESOURCES: ListItem[] = [{ id: 'Name', label: 'Name', value: 'Name', meta: { name: 'Name', type: 'string' } }];

const OPERATORS: ListItem[] = [
  { id: 'eq', label: 'Equals', value: 'eq' },
  { id: 'in', label: 'In', value: 'in' },
];

// Stands in for the query builder's field metadata rules: a list operator swaps the single line input for a textarea
const RESOURCE_TYPE_FNS: ExpressionGetResourceTypeFns = {
  getType: ({ operator }) => (operator === 'in' || operator === 'notIn' ? 'TEXTAREA' : 'TEXT'),
  getSelectItems: () => [],
};

function createRow(key: number, value: string, operator: QueryFilterOperator = 'eq'): ExpressionConditionType {
  return {
    key,
    resourceType: 'TEXT',
    selected: { resource: 'Name', resourceGroup: null, function: null, operator, value },
  };
}

function renderExpression(expressionInitValue: ExpressionType) {
  const onChange = vi.fn();
  render(
    <ExpressionContainer
      org={ORG}
      actionLabel="Filter When"
      resources={RESOURCES}
      operators={OPERATORS}
      expressionInitValue={expressionInitValue}
      getResourceTypeFns={RESOURCE_TYPE_FNS}
      onChange={onChange}
    />,
  );
  return {
    onChange,
    /** Throws (so `waitFor` retries) until the container has pushed an expression out */
    getLatestExpression: (): ExpressionType => {
      const expression = onChange.mock.calls.at(-1)?.[0] as ExpressionType | undefined;
      if (!expression) {
        throw new Error('onChange has not been called yet');
      }
      return expression;
    },
  };
}

describe('ExpressionContainer list operator suggestions', () => {
  it('offers to combine repeated conditions and replaces them with a single list operator row', async () => {
    const { getLatestExpression } = renderExpression({
      action: 'OR',
      rows: [createRow(0, 'Acme'), createRow(1, 'Initech')],
    });

    expect(screen.getByText(/appears in 2 conditions/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Use In operator for Name' }));

    await waitFor(() => expect(getLatestExpression().rows).toHaveLength(1));

    const [row] = getLatestExpression().rows as ExpressionConditionType[];
    expect(row.key).toBe(0);
    // the row keeps the multi value input; `selected.resourceType` is only populated for fields that offer a Type dropdown
    expect(row.resourceType).toBe('TEXTAREA');
    expect(row.selected).toMatchObject({ resource: 'Name', operator: 'in', value: 'Acme\nInitech' });
    expect(screen.queryByText(/appears in 2 conditions/)).toBeNull();
  });

  it('hides a dismissed suggestion without changing the conditions', async () => {
    const { onChange, getLatestExpression } = renderExpression({
      action: 'OR',
      rows: [createRow(0, 'Acme'), createRow(1, 'Initech')],
    });

    // let the rows settle so a later onChange can only come from the dismissal
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const callCountBeforeDismiss = onChange.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss suggestion for Name' }));

    expect(screen.queryByText(/appears in 2 conditions/)).toBeNull();
    expect(onChange.mock.calls.length).toBe(callCountBeforeDismiss);
    expect(getLatestExpression().rows).toHaveLength(2);
  });

  it('names the group so a root level suggestion and a group suggestion for the same field stay distinct', () => {
    renderExpression({
      action: 'OR',
      rows: [
        createRow(0, 'Acme'),
        createRow(1, 'Initech'),
        { key: 2, action: 'OR', rows: [createRow(3, 'Hooli'), createRow(4, 'Soylent')] },
      ],
    });

    // the group is the third row, matching the "Condition Group 3" label the group itself announces
    expect(screen.getByRole('button', { name: 'Use In operator for Name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use In operator for Name in condition group 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss suggestion for Name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss suggestion for Name in condition group 3' })).toBeTruthy();
  });

  it('does not offer a suggestion when the conditions are joined by AND', () => {
    renderExpression({ action: 'AND', rows: [createRow(0, 'Acme'), createRow(1, 'Initech')] });

    expect(screen.queryByText(/can be combined/)).toBeNull();
  });
});

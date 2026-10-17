import {
  ExpressionConditionRowSelectedItems,
  ExpressionConditionType,
  ExpressionType,
  Field,
  ListItem,
  SalesforceOrgUi,
} from '@jetstream/types';
import { ExpressionContainer } from '@jetstream/ui';
import { getResourceTypeFnsFromFields, QUERY_FILTER_FORMULA_FUNCTIONS, QUERY_OPERATORS } from '@jetstream/ui-core/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const FIELDS: Partial<Field>[] = [
  { name: 'Name', label: 'Account Name', type: 'string' },
  { name: 'Amount', label: 'Amount', type: 'currency' },
  { name: 'ExpectedRevenue', label: 'Expected Revenue', type: 'currency' },
  { name: 'CloseDate', label: 'Close Date', type: 'date' },
  { name: 'IsClosed', label: 'Closed', type: 'boolean' },
];

const ACCOUNT_FIELDS: Partial<Field>[] = [
  { name: 'Account.Name', label: 'Account Name', type: 'string' },
  { name: 'Account.AnnualRevenue', label: 'Annual Revenue', type: 'currency' },
];

function toListItems(fields: Partial<Field>[], parentId?: string): ListItem[] {
  return fields.map((field) => ({
    id: field.name as string,
    label: field.label as string,
    value: field.name as string,
    parentId,
    meta: field,
  }));
}

const RESOURCES: ListItem[] = [
  { id: 'Account', label: 'Account', value: 'Account', isDrillInItem: true, childItems: toListItems(ACCOUNT_FIELDS, 'Account') },
  ...toListItems(FIELDS),
];

function renderRow(selected: ExpressionConditionRowSelectedItems) {
  const expression: ExpressionType = { action: 'AND', rows: [{ key: 0, resourceType: 'TEXT', selected }] };
  const onChange = vi.fn();
  const result = render(
    <ExpressionContainer
      org={{} as SalesforceOrgUi}
      actionLabel="Filter When"
      resourceLabel="Field"
      resources={RESOURCES}
      functionsLabel="Field Math"
      functions={QUERY_FILTER_FORMULA_FUNCTIONS}
      operators={QUERY_OPERATORS}
      expressionInitValue={expression}
      getResourceTypeFns={getResourceTypeFnsFromFields(RESOURCES)}
      onChange={onChange}
    />,
  );
  return {
    ...result,
    getLatestRow: (): ExpressionConditionType => {
      const expression = onChange.mock.calls.at(-1)?.[0] as ExpressionType | undefined;
      if (!expression) {
        throw new Error('onChange has not been called yet');
      }
      return expression.rows[0] as ExpressionConditionType;
    },
  };
}

function getOptionIds() {
  return screen.getAllByRole('option').map((option) => option.id);
}

function selectOption(label: string, optionId: string) {
  fireEvent.click(screen.getByLabelText(label, { exact: true }));
  const option = screen.getAllByRole('option').find(({ id }) => id === optionId);
  if (!option) {
    throw new Error(`Option ${optionId} not found in ${label}`);
  }
  fireEvent.click(option);
}

describe('FORMULA() filter row', () => {
  it('shows the math operator and a second field when the FORMULA function is selected', () => {
    renderRow({
      resource: 'Amount',
      resourceGroup: null,
      function: 'FORMULA',
      operator: 'gt',
      value: '100',
      formula: { operator: '-', resource: 'ExpectedRevenue', resourceGroup: null },
    });

    expect(screen.getByText('Math')).toBeTruthy();
    expect(screen.getByText('Second Field')).toBeTruthy();
  });

  it('only offers compatible fields as the second field', () => {
    renderRow({
      resource: 'Amount',
      resourceGroup: null,
      function: 'FORMULA',
      operator: 'gt',
      value: '100',
      formula: { operator: '-', resource: null, resourceGroup: null },
    });

    fireEvent.click(screen.getByLabelText('Second Field'));
    // the relationship stays navigable, text and date fields are excluded when the first field is a number
    expect(getOptionIds()).toEqual(['Account', 'Amount', 'ExpectedRevenue']);

    // drilling in to the relationship applies the same rules to the related fields
    fireEvent.click(screen.getByRole('option', { name: /^Account/ }));
    expect(getOptionIds()).toEqual(['Account.AnnualRevenue']);
  });

  it('offers every field as the first field', () => {
    renderRow({
      resource: null,
      resourceGroup: null,
      function: 'FORMULA',
      operator: 'gt',
      value: '100',
      formula: { operator: '-', resource: null, resourceGroup: null },
    });

    fireEvent.click(screen.getByLabelText('Field', { exact: true }));
    expect(getOptionIds()).toEqual(['Account', 'Name', 'Amount', 'ExpectedRevenue', 'CloseDate', 'IsClosed']);
  });

  it('keeps the math operator chosen before the second field', () => {
    const { getLatestRow } = renderRow({
      resource: 'Amount',
      resourceGroup: null,
      function: 'FORMULA',
      operator: 'gt',
      value: '100',
      formula: { operator: '+', resource: null, resourceGroup: null },
    });

    selectOption('Math', '-');
    selectOption('Second Field', 'ExpectedRevenue');

    expect(getLatestRow().selected).toMatchObject({
      operator: 'gt',
      formula: { operator: '-', resource: 'ExpectedRevenue' },
    });
  });

  it('goes back to the regular controls when the first field is changed to one Field Math does not support', () => {
    const { getLatestRow } = renderRow({
      resource: 'Amount',
      resourceGroup: null,
      function: 'FORMULA',
      operator: 'gt',
      value: '100',
      formula: { operator: '-', resource: 'ExpectedRevenue', resourceGroup: null },
    });

    selectOption('Field', 'IsClosed');

    const row = getLatestRow();
    expect(row.selected.function).toBeNull();
    expect(row.selected.formula).toBeUndefined();
    expect(row.resourceType).toBe('SELECT');
    expect(row.helpText).toBeUndefined();
  });

  it('clears the second field when the first field is changed to one it cannot be combined with', () => {
    // date - date is allowed, but CloseDate cannot stay the second field once the first field is a number
    const { getLatestRow } = renderRow({
      resource: 'CloseDate',
      resourceGroup: null,
      function: 'FORMULA',
      operator: 'gt',
      value: '10',
      formula: { operator: '-', resource: 'CloseDate', resourceGroup: null },
    });

    selectOption('Field', 'Amount');

    const row = getLatestRow();
    expect(row.selected).toMatchObject({ resource: 'Amount', function: 'FORMULA', operator: 'gt', value: '10' });
    expect(row.selected.formula).toMatchObject({ operator: '-', resource: null });
    expect(row.helpText).toBeUndefined();
    // the second field list only offers fields compatible with the new first field
    fireEvent.click(screen.getByLabelText('Second Field'));
    expect(getOptionIds()).toEqual(['Account', 'Amount', 'ExpectedRevenue']);
  });

  it('only shows Field Math for number and date fields', () => {
    const { unmount } = renderRow({ resource: 'Amount', resourceGroup: null, function: null, operator: 'gt', value: '100' });
    expect(screen.getByText('Field Math')).toBeTruthy();
    unmount();

    renderRow({ resource: 'Name', resourceGroup: null, function: null, operator: 'eq', value: 'test' });
    expect(screen.queryByText('Field Math')).toBeNull();
  });

  it('does not show Field Math until a field is chosen', () => {
    renderRow({ resource: null, resourceGroup: null, function: null, operator: null, value: '' });
    expect(screen.queryByText('Field Math')).toBeNull();
  });

  it('does not show the second field for a regular filter', () => {
    renderRow({ resource: 'Amount', resourceGroup: null, function: null, operator: 'gt', value: '100' });

    expect(screen.queryByText('Math')).toBeNull();
    expect(screen.queryByText('Second Field')).toBeNull();
  });
});

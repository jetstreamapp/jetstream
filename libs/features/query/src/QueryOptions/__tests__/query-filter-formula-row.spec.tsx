import { ExpressionConditionRowSelectedItems, ExpressionType, Field, ListItem, SalesforceOrgUi } from '@jetstream/types';
import { ExpressionContainer } from '@jetstream/ui';
import { getResourceTypeFnsFromFields, QUERY_FILTER_FORMULA_FUNCTIONS, QUERY_OPERATORS } from '@jetstream/ui-core/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const FIELDS: Partial<Field>[] = [
  { name: 'Amount', label: 'Amount', type: 'currency' },
  { name: 'ExpectedRevenue', label: 'Expected Revenue', type: 'currency' },
];

const RESOURCES: ListItem[] = FIELDS.map((field) => ({
  id: field.name as string,
  label: field.label as string,
  value: field.name as string,
  meta: field,
}));

function renderRow(selected: ExpressionConditionRowSelectedItems) {
  const expression: ExpressionType = { action: 'AND', rows: [{ key: 0, resourceType: 'TEXT', selected }] };
  return render(
    <ExpressionContainer
      org={{} as SalesforceOrgUi}
      actionLabel="Filter When"
      resourceLabel="Field"
      resources={RESOURCES}
      functions={QUERY_FILTER_FORMULA_FUNCTIONS}
      operators={QUERY_OPERATORS}
      expressionInitValue={expression}
      getResourceTypeFns={getResourceTypeFnsFromFields(RESOURCES)}
      onChange={vi.fn()}
    />,
  );
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

  it('does not show the second field for a regular filter', () => {
    renderRow({ resource: 'Amount', resourceGroup: null, function: null, operator: 'gt', value: '100' });

    expect(screen.queryByText('Math')).toBeNull();
    expect(screen.queryByText('Second Field')).toBeNull();
  });
});

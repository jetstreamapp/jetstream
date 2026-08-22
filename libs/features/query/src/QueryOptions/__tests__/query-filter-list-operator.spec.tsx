import { convertFiltersToWhereClause } from '@jetstream/shared/ui-utils';
import {
  ExpressionConditionType,
  ExpressionRowValueType,
  ExpressionType,
  Field,
  ListItem,
  QueryFilterOperator,
  SalesforceOrgUi,
} from '@jetstream/types';
import { ExpressionContainer, getListOperatorSuggestions, ListOperatorSuggestion } from '@jetstream/ui';
import { getResourceTypeFnsFromFields, getTypeFromMetadata, QUERY_OPERATORS } from '@jetstream/ui-core/shared';
import { composeQuery, WhereClause } from '@jetstreamapp/soql-parser-js';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * Exercises the suggestion end to end against the real field metadata rules the query builder uses, rather
 * than a stand-in: detection, the conversion the expression builder performs when the offer is accepted,
 * and the SOQL that comes out the other side. Field shapes are trimmed from an actual Opportunity describe.
 */
const FIELDS: Partial<Field>[] = [
  { name: 'Name', label: 'Name', type: 'string' },
  {
    name: 'StageName',
    label: 'Stage',
    type: 'picklist',
    picklistValues: [
      { label: 'Prospecting', value: 'Prospecting', active: true, defaultValue: false },
      { label: 'Qualification', value: 'Qualification', active: true, defaultValue: false },
      { label: 'Closed Won', value: 'Closed Won', active: true, defaultValue: false },
    ],
  },
  { name: 'AccountId', label: 'Account ID', type: 'reference', referenceTo: ['Account'] },
  { name: 'CloseDate', label: 'Close Date', type: 'date' },
  { name: 'IsWon', label: 'Won', type: 'boolean' },
  { name: 'Amount', label: 'Amount', type: 'currency' },
];

const RESOURCES: ListItem[] = FIELDS.map((field) => ({
  id: field.name as string,
  label: field.label as string,
  value: field.name as string,
  meta: field,
}));

const ORG = {} as SalesforceOrgUi;
const getResourceTypeFns = getResourceTypeFnsFromFields(RESOURCES);

/**
 * `resourceType` normally comes from the field metadata, but fields that offer a Type dropdown let the user
 * override it - pass `resourceType` to stand in for that choice.
 */
function createRow(
  key: number,
  resource: string,
  operator: QueryFilterOperator,
  value: string | string[],
  resourceTypeOverride?: ExpressionRowValueType,
): ExpressionConditionType {
  const field = FIELDS.find(({ name }) => name === resource) as Field;
  // matches how the builder derives the row's value input when a field and operator are picked
  const resourceType: ExpressionRowValueType = resourceTypeOverride ?? getTypeFromMetadata(field.type, operator, value);
  return {
    key,
    resourceType,
    selected: { resource, resourceGroup: null, function: null, operator, value, resourceType, resourceMeta: field },
  };
}

function getSuggestions(expression: ExpressionType): ListOperatorSuggestion[] {
  return getListOperatorSuggestions(expression, getResourceTypeFns, QUERY_OPERATORS);
}

/**
 * Accepts the suggestion through the real expression builder - render it, click the offer, and compose the
 * SOQL from the expression the builder emits.
 */
async function composeAfterConversion(expression: ExpressionType, suggestion: ListOperatorSuggestion) {
  const onChange = vi.fn();
  const { unmount } = render(
    <ExpressionContainer
      org={ORG}
      actionLabel="Filter When"
      resources={RESOURCES}
      operators={QUERY_OPERATORS}
      expressionInitValue={expression}
      getResourceTypeFns={getResourceTypeFns}
      onChange={onChange}
    />,
  );

  const { resource, toOperatorLabel, rowKeys } = suggestion;
  fireEvent.click(screen.getByRole('button', { name: `Use ${toOperatorLabel} operator for ${resource}` }));

  const expectedRowCount = expression.rows.length - rowKeys.length + 1;
  await waitFor(() => expect((onChange.mock.calls.at(-1)?.[0] as ExpressionType | undefined)?.rows).toHaveLength(expectedRowCount));
  const converted = onChange.mock.calls.at(-1)?.[0] as ExpressionType;
  unmount();

  return composeQuery({
    sObject: 'Opportunity',
    fields: [{ type: 'Field', field: 'Id' }],
    where: convertFiltersToWhereClause<WhereClause>(converted),
  });
}

describe('list operator suggestions against real field metadata', () => {
  it('combines repeated picklist equals conditions into an IN clause with the same values', async () => {
    const expression: ExpressionType = {
      action: 'OR',
      rows: [
        createRow(0, 'StageName', 'eq', 'Prospecting'),
        createRow(1, 'StageName', 'eq', 'Qualification'),
        createRow(2, 'StageName', 'eq', 'Closed Won'),
      ],
    };

    const [suggestion] = getSuggestions(expression);
    expect(suggestion).toMatchObject({ toOperator: 'in', targetResourceType: 'SELECT-MULTI' });
    expect(await composeAfterConversion(expression, suggestion)).toBe(
      `SELECT Id FROM Opportunity WHERE StageName IN ('Prospecting', 'Qualification', 'Closed Won')`,
    );
  });

  it('keeps the merged values separate when a picklist field uses the text input', async () => {
    const expression: ExpressionType = {
      action: 'OR',
      rows: [createRow(0, 'StageName', 'eq', 'Prospecting', 'TEXT'), createRow(1, 'StageName', 'eq', 'Qualification', 'TEXT')],
    };

    const [suggestion] = getSuggestions(expression);
    expect(suggestion).toMatchObject({ toOperator: 'in', targetResourceType: 'TEXTAREA' });
    // the field metadata rules normalize picklist values into an array, which would otherwise turn the
    // newline separated textarea value into a single literal containing a newline
    expect(await composeAfterConversion(expression, suggestion)).toBe(
      `SELECT Id FROM Opportunity WHERE StageName IN ('Prospecting', 'Qualification')`,
    );
  });

  it('combines repeated text does-not-equal conditions into a NOT IN clause', async () => {
    const expression: ExpressionType = {
      action: 'AND',
      rows: [createRow(0, 'Name', 'ne', 'Acme'), createRow(1, 'Name', 'ne', 'Initech')],
    };

    const [suggestion] = getSuggestions(expression);
    expect(suggestion).toMatchObject({ toOperator: 'notIn', targetResourceType: 'TEXTAREA' });
    expect(await composeAfterConversion(expression, suggestion)).toBe(`SELECT Id FROM Opportunity WHERE Name NOT IN ('Acme', 'Initech')`);
  });

  it('combines lookup conditions into a NOT IN of ids', async () => {
    const expression: ExpressionType = {
      action: 'AND',
      rows: [createRow(0, 'AccountId', 'ne', '001000000000001'), createRow(1, 'AccountId', 'ne', '001000000000002')],
    };

    const [suggestion] = getSuggestions(expression);
    expect(suggestion).toMatchObject({ toOperator: 'notIn', targetResourceType: 'TEXTAREA' });
    expect(await composeAfterConversion(expression, suggestion)).toBe(
      `SELECT Id FROM Opportunity WHERE AccountId NOT IN ('001000000000001', '001000000000002')`,
    );
  });

  it('combines currency conditions into an unquoted IN clause', async () => {
    const expression: ExpressionType = {
      action: 'OR',
      rows: [createRow(0, 'Amount', 'eq', '100'), createRow(1, 'Amount', 'eq', '200')],
    };

    const [suggestion] = getSuggestions(expression);
    expect(await composeAfterConversion(expression, suggestion)).toBe(`SELECT Id FROM Opportunity WHERE Amount IN (100, 200)`);
  });

  it('combines boolean conditions into an unquoted IN clause', async () => {
    const expression: ExpressionType = {
      action: 'OR',
      rows: [createRow(0, 'IsWon', 'eq', 'true'), createRow(1, 'IsWon', 'eq', 'false')],
    };

    const [suggestion] = getSuggestions(expression);
    expect(suggestion).toMatchObject({ targetResourceType: 'SELECT-MULTI' });
    expect(await composeAfterConversion(expression, suggestion)).toBe(`SELECT Id FROM Opportunity WHERE IsWon IN (true, false)`);
  });

  it('combines relative date conditions but leaves the date picker alone', async () => {
    const relativeDates: ExpressionType = {
      action: 'OR',
      rows: [createRow(0, 'CloseDate', 'eq', 'LAST_WEEK'), createRow(1, 'CloseDate', 'eq', 'TODAY')],
    };
    const pickedDates: ExpressionType = {
      action: 'OR',
      rows: [createRow(0, 'CloseDate', 'eq', '2026-01-01'), createRow(1, 'CloseDate', 'eq', '2026-02-01')],
    };

    const [suggestion] = getSuggestions(relativeDates);
    expect(suggestion).toMatchObject({ targetResourceType: 'SELECT-MULTI' });
    expect(await composeAfterConversion(relativeDates, suggestion)).toBe(
      `SELECT Id FROM Opportunity WHERE CloseDate IN (LAST_WEEK, TODAY)`,
    );
    expect(getSuggestions(pickedDates)).toEqual([]);
  });
});

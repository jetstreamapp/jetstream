import {
  ExpressionConditionRowSelectedItems,
  ExpressionConditionType,
  ExpressionGetResourceTypeFns,
  ExpressionGroupType,
  ExpressionRowValueType,
  ExpressionType,
  ListItem,
  QueryFilterOperator,
} from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { getListOperatorSuggestions, getListOperatorSuggestionValue } from '../expression-list-operator-utils';

const OPERATORS: ListItem[] = [
  { id: 'eq', label: 'Equals', value: 'eq' },
  { id: 'ne', label: 'Does Not Equal', value: 'ne' },
  { id: 'in', label: 'In', value: 'in' },
  { id: 'notIn', label: 'Not In', value: 'notIn' },
];

type TestFieldType = 'string' | 'int' | 'boolean' | 'picklist' | 'multipicklist' | 'reference' | 'date' | 'datetime';

const LIST_OPERATORS = new Set<QueryFilterOperator>(['in', 'notIn', 'includes', 'excludes']);

function toListItems(values: ExpressionRowValueType[]): ListItem<ExpressionRowValueType>[] {
  return values.map((value) => ({ id: value, label: value, value }));
}

/**
 * Mirrors the rules that `getResourceTypeFnsFromFields` derives from field metadata, so suggestions are
 * exercised against the same value input decisions the query builder makes at runtime.
 */
function createResourceTypeFns(fieldTypeByResource: Record<string, TestFieldType>): ExpressionGetResourceTypeFns {
  function getFieldType({ resource }: ExpressionConditionRowSelectedItems): TestFieldType | undefined {
    return fieldTypeByResource[resource || ''];
  }
  return {
    getTypes: (selected) => {
      const fieldType = getFieldType(selected);
      const isListOperator = LIST_OPERATORS.has(selected.operator as QueryFilterOperator);
      switch (fieldType) {
        case 'picklist':
        case 'multipicklist':
          return toListItems(isListOperator ? ['SELECT-MULTI', 'TEXTAREA'] : ['SELECT', 'TEXT']);
        case 'date':
          return toListItems(isListOperator ? ['DATE', 'SELECT-MULTI', 'TEXT'] : ['DATE', 'SELECT', 'TEXT']);
        case 'datetime':
          return toListItems(isListOperator ? ['DATETIME', 'SELECT-MULTI', 'TEXT'] : ['DATETIME', 'SELECT', 'TEXT']);
        default:
          return undefined;
      }
    },
    getType: (selected) => {
      const fieldType = getFieldType(selected);
      if (!fieldType) {
        return undefined;
      }
      if (selected.resourceType) {
        return selected.resourceType;
      }
      const isListOperator = LIST_OPERATORS.has(selected.operator as QueryFilterOperator);
      switch (fieldType) {
        case 'date':
          return 'DATE';
        case 'datetime':
        case 'boolean':
        case 'picklist':
        case 'multipicklist':
          return isListOperator ? 'SELECT-MULTI' : 'SELECT';
        case 'reference':
          return isListOperator ? 'TEXTAREA' : 'LOOKUP';
        default:
          return isListOperator ? 'TEXTAREA' : 'TEXT';
      }
    },
    getSelectItems: () => [],
  };
}

function createRow(
  key: number,
  resource: string,
  operator: QueryFilterOperator,
  value: string | string[],
  resourceType: ExpressionRowValueType,
  selectedOverrides: Partial<ExpressionConditionRowSelectedItems> = {},
): ExpressionConditionType {
  return {
    key,
    resourceType,
    selected: { resource, resourceGroup: null, function: null, operator, value, ...selectedOverrides },
  };
}

function createGroup(key: number, action: 'AND' | 'OR', rows: ExpressionConditionType[]): ExpressionGroupType {
  return { key, action, rows };
}

function getSuggestions(expression: ExpressionType, fieldTypeByResource: Record<string, TestFieldType>) {
  return getListOperatorSuggestions(expression, createResourceTypeFns(fieldTypeByResource), OPERATORS);
}

describe('getListOperatorSuggestions', () => {
  it('suggests In for repeated Equals conditions on a picklist joined by OR', () => {
    const suggestions = getSuggestions(
      {
        action: 'OR',
        rows: [
          createRow(0, 'StageName', 'eq', 'Prospecting', 'SELECT'),
          createRow(1, 'StageName', 'eq', 'Qualification', 'SELECT'),
          createRow(2, 'StageName', 'eq', 'Closed Won', 'SELECT'),
        ],
      },
      { StageName: 'picklist' },
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      resource: 'StageName',
      fromOperator: 'eq',
      toOperator: 'in',
      toOperatorLabel: 'In',
      rowKeys: [0, 1, 2],
      targetResourceType: 'SELECT-MULTI',
      values: ['Prospecting', 'Qualification', 'Closed Won'],
    });
    expect(suggestions[0].groupKey).toBeUndefined();
    expect(getListOperatorSuggestionValue(suggestions[0])).toEqual(['Prospecting', 'Qualification', 'Closed Won']);
  });

  it('suggests Not In for repeated Does Not Equal conditions on a text field joined by AND', () => {
    const suggestions = getSuggestions(
      {
        action: 'AND',
        rows: [createRow(0, 'Name', 'ne', 'Acme', 'TEXT'), createRow(1, 'Name', 'ne', 'Initech', 'TEXT')],
      },
      { Name: 'string' },
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      toOperator: 'notIn',
      toOperatorLabel: 'Not In',
      targetResourceType: 'TEXTAREA',
      values: ['Acme', 'Initech'],
    });
    expect(getListOperatorSuggestionValue(suggestions[0])).toBe('Acme\nInitech');
  });

  it('trims and de-dupes merged values while keeping first-occurrence order', () => {
    const suggestions = getSuggestions(
      {
        action: 'OR',
        rows: [
          createRow(0, 'Name', 'eq', ' Acme ', 'TEXT'),
          createRow(1, 'Name', 'eq', 'Initech', 'TEXT'),
          createRow(2, 'Name', 'eq', 'Acme', 'TEXT'),
        ],
      },
      { Name: 'string' },
    );

    expect(suggestions[0].values).toEqual(['Acme', 'Initech']);
    expect(suggestions[0].rowKeys).toEqual([0, 1, 2]);
  });

  it('does not suggest when the conjunction does not match the operator', () => {
    const equalsWithAnd = getSuggestions(
      { action: 'AND', rows: [createRow(0, 'Name', 'eq', 'Acme', 'TEXT'), createRow(1, 'Name', 'eq', 'Initech', 'TEXT')] },
      { Name: 'string' },
    );
    const notEqualsWithOr = getSuggestions(
      { action: 'OR', rows: [createRow(0, 'Name', 'ne', 'Acme', 'TEXT'), createRow(1, 'Name', 'ne', 'Initech', 'TEXT')] },
      { Name: 'string' },
    );

    expect(equalsWithAnd).toEqual([]);
    expect(notEqualsWithOr).toEqual([]);
  });

  it('does not suggest for a single condition, mixed fields, or mixed operators', () => {
    const fields: Record<string, TestFieldType> = { Name: 'string', Type: 'string' };

    expect(getSuggestions({ action: 'OR', rows: [createRow(0, 'Name', 'eq', 'Acme', 'TEXT')] }, fields)).toEqual([]);
    expect(
      getSuggestions(
        { action: 'OR', rows: [createRow(0, 'Name', 'eq', 'Acme', 'TEXT'), createRow(1, 'Type', 'eq', 'Acme', 'TEXT')] },
        fields,
      ),
    ).toEqual([]);
    expect(
      getSuggestions(
        { action: 'OR', rows: [createRow(0, 'Name', 'eq', 'Acme', 'TEXT'), createRow(1, 'Name', 'ne', 'Initech', 'TEXT')] },
        fields,
      ),
    ).toEqual([]);
  });

  it('ignores conditions without a value', () => {
    const suggestions = getSuggestions(
      {
        action: 'OR',
        rows: [createRow(0, 'Name', 'eq', 'Acme', 'TEXT'), createRow(1, 'Name', 'eq', '', 'TEXT'), createRow(2, 'Name', 'eq', [], 'TEXT')],
      },
      { Name: 'string' },
    );

    expect(suggestions).toEqual([]);
  });

  it('ignores conditions that use a field function, which the having clause relies on', () => {
    const suggestions = getSuggestions(
      {
        action: 'OR',
        rows: [
          createRow(0, 'Amount', 'eq', '1', 'TEXT', { function: 'COUNT' }),
          createRow(1, 'Amount', 'eq', '2', 'TEXT', { function: 'COUNT' }),
        ],
      },
      { Amount: 'int' },
    );

    expect(suggestions).toEqual([]);
  });

  it('does not merge rows that use different value inputs for the same field', () => {
    const suggestions = getSuggestions(
      {
        action: 'OR',
        rows: [createRow(0, 'StageName', 'eq', 'Prospecting', 'SELECT'), createRow(1, 'StageName', 'eq', 'Custom', 'TEXT')],
      },
      { StageName: 'picklist' },
    );

    expect(suggestions).toEqual([]);
  });

  it('suggests for date fields using relative values but not for the date picker', () => {
    const relativeValues = getSuggestions(
      {
        action: 'OR',
        rows: [createRow(0, 'CloseDate', 'eq', 'LAST_WEEK', 'SELECT'), createRow(1, 'CloseDate', 'eq', 'TODAY', 'SELECT')],
      },
      { CloseDate: 'date' },
    );
    const datePicker = getSuggestions(
      {
        action: 'OR',
        rows: [createRow(0, 'CloseDate', 'eq', '2026-01-01', 'DATE'), createRow(1, 'CloseDate', 'eq', '2026-02-01', 'DATE')],
      },
      { CloseDate: 'date' },
    );

    expect(relativeValues).toHaveLength(1);
    expect(relativeValues[0]).toMatchObject({ targetResourceType: 'SELECT-MULTI', values: ['LAST_WEEK', 'TODAY'] });
    expect(datePicker).toEqual([]);
  });

  it('does not suggest for a date field using manual text, which has no multi value input', () => {
    const suggestions = getSuggestions(
      {
        action: 'OR',
        rows: [createRow(0, 'CloseDate', 'eq', 'yesterday', 'TEXT'), createRow(1, 'CloseDate', 'eq', 'tomorrow', 'TEXT')],
      },
      { CloseDate: 'date' },
    );

    expect(suggestions).toEqual([]);
  });

  it('converts a reference field lookup into the multi value textarea', () => {
    const suggestions = getSuggestions(
      {
        action: 'OR',
        rows: [createRow(0, 'AccountId', 'eq', '001000000000001', 'LOOKUP'), createRow(1, 'AccountId', 'eq', '001000000000002', 'LOOKUP')],
      },
      { AccountId: 'reference' },
    );

    expect(suggestions[0]).toMatchObject({ targetResourceType: 'TEXTAREA', values: ['001000000000001', '001000000000002'] });
  });

  it('evaluates group rows against the group action rather than the expression action', () => {
    const suggestions = getSuggestions(
      {
        action: 'AND',
        rows: [
          createRow(0, 'Name', 'eq', 'Acme', 'TEXT'),
          createGroup(1, 'OR', [createRow(2, 'Type', 'eq', 'Customer', 'TEXT'), createRow(3, 'Type', 'eq', 'Partner', 'TEXT')]),
        ],
      },
      { Name: 'string', Type: 'string' },
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ groupKey: 1, resource: 'Type', rowKeys: [2, 3] });
  });

  it('keeps the suggestion id stable when the matched rows change', () => {
    const twoRows = getSuggestions(
      { action: 'OR', rows: [createRow(0, 'Name', 'eq', 'Acme', 'TEXT'), createRow(1, 'Name', 'eq', 'Initech', 'TEXT')] },
      { Name: 'string' },
    );
    const threeRows = getSuggestions(
      {
        action: 'OR',
        rows: [
          createRow(0, 'Name', 'eq', 'Acme Updated', 'TEXT'),
          createRow(1, 'Name', 'eq', 'Initech', 'TEXT'),
          createRow(5, 'Name', 'eq', 'Umbrella', 'TEXT'),
        ],
      },
      { Name: 'string' },
    );

    expect(twoRows[0].id).toEqual(threeRows[0].id);
  });

  it('returns nothing when resource type functions are not provided', () => {
    const expression: ExpressionType = {
      action: 'OR',
      rows: [createRow(0, 'Name', 'eq', 'Acme', 'TEXT'), createRow(1, 'Name', 'eq', 'Initech', 'TEXT')],
    };

    expect(getListOperatorSuggestions(expression, undefined, OPERATORS)).toEqual([]);
  });

  it('returns nothing when the consumer does not offer the list operators', () => {
    const expression: ExpressionType = {
      action: 'OR',
      rows: [createRow(0, 'Name', 'eq', 'Acme', 'TEXT'), createRow(1, 'Name', 'eq', 'Initech', 'TEXT')],
    };

    expect(getListOperatorSuggestions(expression, createResourceTypeFns({ Name: 'string' }), [OPERATORS[0]])).toEqual([]);
  });
});

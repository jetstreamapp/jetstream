import { convertFiltersToWhereClause, getFilterResourceText, queryFilterHasValue } from '@jetstream/shared/ui-utils';
import {
  ExpressionConditionRowSelectedItems,
  ExpressionConditionType,
  ExpressionType,
  Field,
  ListItem,
  QueryFilterOperator,
} from '@jetstream/types';
import { getResourceTypeFnsFromFields, QUERY_FILTER_FORMULA_FUNCTIONS } from '@jetstream/ui-core/shared';
import { composeQuery, WhereClause } from '@jetstreamapp/soql-parser-js';
import { describe, expect, it } from 'vitest';

const FIELDS: Partial<Field>[] = [
  { name: 'Name', label: 'Name', type: 'string' },
  { name: 'Amount', label: 'Amount', type: 'currency' },
  { name: 'ExpectedRevenue', label: 'Expected Revenue', type: 'currency' },
  { name: 'CloseDate', label: 'Close Date', type: 'date' },
  { name: 'CreatedDate', label: 'Created Date', type: 'datetime' },
  { name: 'Account.AnnualRevenue', label: 'Annual Revenue', type: 'currency' },
];

const RESOURCES: ListItem[] = FIELDS.map((field) => ({
  id: field.name as string,
  label: field.label as string,
  value: field.name as string,
  meta: field,
}));

const getResourceTypeFns = getResourceTypeFnsFromFields(RESOURCES);

function createFormulaSelected({
  resource = 'Amount',
  formulaResource = 'ExpectedRevenue',
  formulaOperator = '-',
  operator = 'gt',
  value = '100',
}: {
  resource?: string;
  formulaResource?: string;
  formulaOperator?: '+' | '-';
  operator?: QueryFilterOperator;
  value?: string;
} = {}): ExpressionConditionRowSelectedItems {
  return {
    resource,
    resourceGroup: null,
    function: 'FORMULA',
    operator,
    value,
    resourceMeta: FIELDS.find(({ name }) => name === resource),
    formula: {
      operator: formulaOperator,
      resource: formulaResource,
      resourceGroup: null,
      resourceMeta: FIELDS.find(({ name }) => name === formulaResource),
    },
  };
}

function createRow(key: number, selected: ExpressionConditionRowSelectedItems): ExpressionConditionType {
  return { key, resourceType: 'TEXT', selected };
}

function compose(expression: ExpressionType) {
  const where = convertFiltersToWhereClause<WhereClause>(expression);
  return composeQuery({ fields: [{ type: 'Field', field: 'Id' }], sObject: 'Opportunity', where });
}

describe('FORMULA() filter rows', () => {
  describe('composing SOQL', () => {
    it('composes a formula row', () => {
      const soql = compose({ action: 'AND', rows: [createRow(0, createFormulaSelected())] });
      expect(soql).toBe(`SELECT Id FROM Opportunity WHERE FORMULA('Amount - ExpectedRevenue') > 100`);
    });

    it('composes addition with a related field and a decimal value', () => {
      const soql = compose({
        action: 'AND',
        rows: [createRow(0, createFormulaSelected({ formulaResource: 'Account.AnnualRevenue', formulaOperator: '+', value: '10.5' }))],
      });
      expect(soql).toBe(`SELECT Id FROM Opportunity WHERE FORMULA('Amount + Account.AnnualRevenue') > 10.5`);
    });

    it('does not quote the value of a date arithmetic comparison', () => {
      const soql = compose({
        action: 'AND',
        rows: [
          createRow(0, createFormulaSelected({ resource: 'CloseDate', formulaResource: 'CreatedDate', operator: 'lte', value: '10' })),
        ],
      });
      expect(soql).toBe(`SELECT Id FROM Opportunity WHERE FORMULA('CloseDate - CreatedDate') <= 10`);
    });

    it('combines with regular filters and keeps the formula inside a group', () => {
      const soql = compose({
        action: 'AND',
        rows: [
          {
            key: 0,
            action: 'OR',
            rows: [
              createRow(1, createFormulaSelected()),
              createRow(2, { resource: 'Name', resourceGroup: null, function: null, operator: 'eq', value: 'Acme' }),
            ],
          },
          createRow(3, createFormulaSelected({ operator: 'lt', value: '5' })),
        ],
      });
      expect(soql).toBe(
        `SELECT Id FROM Opportunity WHERE (FORMULA('Amount - ExpectedRevenue') > 100 OR Name = 'Acme') AND FORMULA('Amount - ExpectedRevenue') < 5`,
      );
    });

    it('skips a formula row until the second field is chosen', () => {
      const selected = createFormulaSelected();
      selected.formula = { operator: '+', resource: null, resourceGroup: null };
      const row = createRow(0, selected);
      expect(queryFilterHasValue(row)).toBeFalsy();
      expect(convertFiltersToWhereClause({ action: 'AND', rows: [row] })).toBeUndefined();
    });

    it('still requires an operator and a value', () => {
      expect(queryFilterHasValue(createRow(0, createFormulaSelected({ value: '' })))).toBeFalsy();
      expect(queryFilterHasValue(createRow(0, createFormulaSelected()))).toBeTruthy();
    });
  });

  describe('summary text', () => {
    it('describes a formula row', () => {
      expect(getFilterResourceText(createFormulaSelected())).toBe('FORMULA(Amount - ExpectedRevenue)');
    });

    it('describes a regular row by its field', () => {
      expect(getFilterResourceText({ resource: 'Name', resourceGroup: null, function: null, operator: 'eq', value: '' })).toBe('Name');
    });
  });

  describe('field metadata rules', () => {
    it('always uses a text input for the value and offers no type choice', () => {
      const selected = createFormulaSelected({ resource: 'CloseDate', formulaResource: 'CreatedDate' });
      expect(getResourceTypeFns.getType(selected)).toBe('TEXT');
      expect(getResourceTypeFns.getTypes?.(selected)).toBeUndefined();
    });

    it('shows no help text when the selection is valid', () => {
      expect(getResourceTypeFns.getHelpText?.(createFormulaSelected())).toBeUndefined();
    });

    it('warns when a field type is not supported', () => {
      const helpText = getResourceTypeFns.getHelpText?.(createFormulaSelected({ resource: 'Name' }));
      expect(helpText).toEqual({ type: 'warning', value: 'FORMULA() only supports number, currency, date and datetime fields.' });
    });

    it('warns when date and datetime fields are mixed', () => {
      const helpText = getResourceTypeFns.getHelpText?.(createFormulaSelected({ resource: 'CloseDate', formulaResource: 'CreatedDate' }));
      expect(helpText?.type).toBe('warning');
      expect(helpText?.value).toContain('cannot mix date and datetime');
    });

    it('warns when a date is on the right of a non-date field', () => {
      const helpText = getResourceTypeFns.getHelpText?.(createFormulaSelected({ resource: 'Amount', formulaResource: 'CloseDate' }));
      expect(helpText?.type).toBe('warning');
    });
  });

  describe('function availability', () => {
    function hasFormulaFunction(resource: string | null): boolean {
      const selected = createFormulaSelected();
      selected.resource = resource;
      const functions = getResourceTypeFns.filterFunctions?.(selected, QUERY_FILTER_FORMULA_FUNCTIONS) || [];
      return functions.some(({ value }) => value === 'FORMULA');
    }

    it('offers the formula for number and date fields', () => {
      expect(hasFormulaFunction('Amount')).toBe(true);
      expect(hasFormulaFunction('CloseDate')).toBe(true);
      expect(hasFormulaFunction('CreatedDate')).toBe(true);
    });

    it('hides the formula for text fields and until a field is chosen', () => {
      expect(hasFormulaFunction('Name')).toBe(false);
      expect(hasFormulaFunction(null)).toBe(false);
    });

    it('drops the formula when the field is changed to an unsupported type', () => {
      const selected = getResourceTypeFns.checkSelected?.(createFormulaSelected({ resource: 'Name' }));
      expect(selected?.function).toBeNull();
      expect(selected?.formula).toBeUndefined();
    });

    it('keeps the formula when the field is changed to another supported type', () => {
      const selected = getResourceTypeFns.checkSelected?.(createFormulaSelected({ resource: 'CloseDate' }));
      expect(selected?.function).toBe('FORMULA');
      expect(selected?.formula?.resource).toBe('ExpectedRevenue');
    });
  });

  describe('second field eligibility', () => {
    const RESOURCES_BY_ID = Object.fromEntries(RESOURCES.map((resource) => [resource.id, resource]));

    function allowedSecondFields(resource: string | null): string[] {
      const selected = createFormulaSelected();
      selected.resource = resource;
      return RESOURCES.filter((item) => getResourceTypeFns.isFormulaOperandAllowed?.(selected, item)).map(({ id }) => id);
    }

    it('offers number fields when the first field is a number', () => {
      expect(allowedSecondFields('Amount')).toEqual(['Amount', 'ExpectedRevenue', 'Account.AnnualRevenue']);
    });

    it('offers matching date fields and numbers when the first field is a date', () => {
      expect(allowedSecondFields('CloseDate')).toEqual(['Amount', 'ExpectedRevenue', 'CloseDate', 'Account.AnnualRevenue']);
      expect(allowedSecondFields('CreatedDate')).toEqual(['Amount', 'ExpectedRevenue', 'CreatedDate', 'Account.AnnualRevenue']);
    });

    it('offers every supported field before the first field is chosen', () => {
      expect(allowedSecondFields(null)).toEqual(['Amount', 'ExpectedRevenue', 'CloseDate', 'CreatedDate', 'Account.AnnualRevenue']);
    });

    it('never offers text fields', () => {
      const selected = createFormulaSelected({ resource: 'Name' });
      expect(getResourceTypeFns.isFormulaOperandAllowed?.(selected, RESOURCES_BY_ID.Name)).toBe(false);
      expect(getResourceTypeFns.isFormulaOperandAllowed?.(createFormulaSelected(), RESOURCES_BY_ID.Name)).toBe(false);
    });
  });
});

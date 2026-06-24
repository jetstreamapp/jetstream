import { ErrorResult, Field } from '@jetstream/types';
import { describe, expect, test } from 'vitest';
import { ColumnWithFilter, RowSalesforceRecordWithKey } from '../grid-types';
import { getRowErrorMessages, mapSaveErrorsToRow, summarizeRowErrors, validateCellValue, validateRow } from '../validate-cell-value';

function baseField(): Field {
  return {
    type: 'string',
    length: 255,
    nillable: true,
    updateable: true,
    calculated: false,
    autoNumber: false,
    defaultedOnCreate: false,
    label: 'Test Field',
    scale: 0,
  } as Field;
}

function fieldWith(overrides: Partial<Field>): Field {
  return { ...baseField(), ...overrides } as Field;
}

describe('validateCellValue', () => {
  test('returns empty result when there is no field metadata', () => {
    expect(validateCellValue('anything', null)).toEqual({});
  });

  test('skips calculated and auto-number fields entirely', () => {
    const longValue = 'x'.repeat(500);
    expect(validateCellValue(longValue, fieldWith({ calculated: true, length: 10 }))).toEqual({});
    expect(validateCellValue(longValue, fieldWith({ autoNumber: true, length: 10 }))).toEqual({});
  });

  describe('strings', () => {
    test('errors when the value exceeds the field length', () => {
      const result = validateCellValue('x'.repeat(256), fieldWith({ type: 'string', length: 255 }));
      expect(result.error).toContain('255');
    });

    test('accepts a value at the length boundary', () => {
      expect(validateCellValue('x'.repeat(255), fieldWith({ type: 'string', length: 255 }))).toEqual({});
    });
  });

  describe('required', () => {
    test('errors when a non-nillable updateable field is cleared', () => {
      const result = validateCellValue('', fieldWith({ nillable: false, updateable: true }));
      expect(result.error).toContain('required');
    });

    test('allows clearing a nillable field', () => {
      expect(validateCellValue('', fieldWith({ nillable: true }))).toEqual({});
    });

    test('errors when a non-nillable field with a create-time default is cleared (defaults do not apply on update)', () => {
      const result = validateCellValue('', fieldWith({ nillable: false, updateable: true, defaultedOnCreate: true }));
      expect(result.error).toContain('required');
    });

    test('does not require booleans (false is a value)', () => {
      expect(validateCellValue('', fieldWith({ type: 'boolean', nillable: false }))).toEqual({});
    });
  });

  describe('numbers', () => {
    test('warns (not errors) on a non-numeric value so the save can still be attempted', () => {
      const result = validateCellValue('abc', fieldWith({ type: 'double' }));
      expect(result.error).toBeUndefined();
      expect(result.warning).toContain('not a valid number');
    });

    test('accepts a numeric string with thousands separators', () => {
      expect(validateCellValue('1,000', fieldWith({ type: 'currency', precision: 18, scale: 2 }))).toEqual({});
    });

    test('errors when the integer part exceeds precision - scale', () => {
      const result = validateCellValue('1000', fieldWith({ type: 'int', precision: 4, scale: 2 }));
      expect(result.error).toContain('too large');
    });
  });

  describe('dates', () => {
    test('warns (not errors) on an unparseable date so the save can still be attempted', () => {
      const result = validateCellValue('not-a-date', fieldWith({ type: 'date' }));
      expect(result.error).toBeUndefined();
      expect(result.warning).toContain('valid');
    });

    test('accepts an ISO date', () => {
      expect(validateCellValue('2024-01-15', fieldWith({ type: 'date' }))).toEqual({});
    });
  });

  describe('picklists', () => {
    const picklistField = fieldWith({
      type: 'picklist',
      picklistValues: [
        { active: true, value: 'Open', label: 'Open' },
        { active: false, value: 'Legacy', label: 'Legacy' },
      ] as Field['picklistValues'],
    });

    test('warns (not errors) when the value is not in the picklist', () => {
      const result = validateCellValue('Unknown', picklistField);
      expect(result.error).toBeUndefined();
      expect(result.warning).toContain('not in the picklist');
    });

    test('warns when the value is valid but inactive', () => {
      const result = validateCellValue('Legacy', picklistField);
      expect(result.warning).toContain('Inactive');
    });

    test('accepts an active picklist value', () => {
      expect(validateCellValue('Open', picklistField)).toEqual({});
    });
  });
});

describe('validateRow', () => {
  function row(values: Record<string, any>, touched: string[], record: Record<string, any> = {}): RowSalesforceRecordWithKey {
    return {
      _key: '1',
      _record: record,
      _touchedColumns: new Set(touched),
      ...values,
    } as RowSalesforceRecordWithKey;
  }

  test('only validates touched-and-changed columns', () => {
    const metadata = { name: fieldWith({ type: 'string', length: 5 }) } as any;
    const result = validateRow(row({ Name: 'toolong' }, ['Name'], { Name: 'ok' }), metadata);
    expect(Object.keys(result.fieldErrors)).toEqual(['Name']);
  });

  test('ignores a touched column whose value matches the original', () => {
    const metadata = { name: fieldWith({ type: 'string', length: 5 }) } as any;
    const result = validateRow(row({ Name: 'toolong' }, ['Name'], { Name: 'toolong' }), metadata);
    expect(result.fieldErrors).toEqual({});
  });
});

describe('mapSaveErrorsToRow', () => {
  const columns = [{ key: 'Name' }, { key: 'Industry' }] as ColumnWithFilter<RowSalesforceRecordWithKey>[];

  test('maps an error with a matching field to a cell error (case-insensitive)', () => {
    const errorResult: ErrorResult = {
      success: false,
      errors: [{ fields: ['name'], message: 'Too long', statusCode: 'STRING_TOO_LONG' }],
    };
    const { fieldErrors, recordErrors } = mapSaveErrorsToRow(errorResult, columns);
    expect(fieldErrors).toEqual({ Name: 'Too long' });
    expect(recordErrors).toEqual([]);
  });

  test('falls back to record-level when the field is not a visible column', () => {
    const errorResult: ErrorResult = {
      success: false,
      errors: [{ fields: ['Hidden__c'], message: 'Bad value', statusCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION' }],
    };
    const { fieldErrors, recordErrors } = mapSaveErrorsToRow(errorResult, columns);
    expect(fieldErrors).toEqual({});
    expect(recordErrors).toEqual(['Bad value']);
  });

  test('routes field-less errors to record level', () => {
    const errorResult: ErrorResult = {
      success: false,
      errors: [{ fields: [], message: 'Record locked', statusCode: 'UNABLE_TO_LOCK_ROW' }],
    };
    expect(mapSaveErrorsToRow(errorResult, columns).recordErrors).toEqual(['Record locked']);
  });
});

describe('summarizeRowErrors + getRowErrorMessages', () => {
  test('summarize joins field + record errors, or null when empty', () => {
    expect(summarizeRowErrors({ Name: 'A' }, ['B'])).toBe('A\nB');
    expect(summarizeRowErrors({}, [])).toBeNull();
  });

  test('getRowErrorMessages prefers field+record errors over the derived summary', () => {
    const row = { _fieldErrors: { Name: 'A' }, _recordErrors: ['B'], _saveError: 'A\nB' } as unknown as RowSalesforceRecordWithKey;
    expect(getRowErrorMessages(row)).toEqual(['A', 'B']);
  });

  test('getRowErrorMessages falls back to _saveError when no structured errors exist', () => {
    const row = { _saveError: 'legacy' } as unknown as RowSalesforceRecordWithKey;
    expect(getRowErrorMessages(row)).toEqual(['legacy']);
  });
});

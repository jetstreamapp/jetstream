import { Field } from '@jetstream/types';
import { describe, expect, test } from 'vitest';
import { applyPasteCellsToRows, coercePastedValue, revertCellsInRows } from '../data-table-paste-utils';
import { GridCellRef, PasteTargetCell, RowSalesforceRecordWithKey } from '../grid/grid-types';

function field(overrides: Partial<Field>): Field {
  return {
    type: 'string',
    length: 255,
    nillable: true,
    updateable: true,
    calculated: false,
    autoNumber: false,
    scale: 0,
    label: 'F',
    ...overrides,
  } as Field;
}

describe('coercePastedValue', () => {
  test('returns the raw string when there is no field metadata', () => {
    expect(coercePastedValue('hello', null)).toBe('hello');
  });

  // Empty input is how Delete/Backspace clears a cell — it must produce an "empty" value per type.
  test('clears to an empty value per type', () => {
    expect(coercePastedValue('', field({ type: 'string' }))).toBe('');
    expect(coercePastedValue('', field({ type: 'double' }))).toBe('');
    expect(coercePastedValue('', field({ type: 'date' }))).toBe('');
    expect(coercePastedValue('', field({ type: 'multipicklist' }))).toBe('');
    expect(coercePastedValue('', field({ type: 'boolean' }))).toBe(false);
  });

  test('coerces booleans from common truthy tokens', () => {
    expect(coercePastedValue('true', field({ type: 'boolean' }))).toBe(true);
    expect(coercePastedValue('X', field({ type: 'boolean' }))).toBe(true);
    expect(coercePastedValue('no', field({ type: 'boolean' }))).toBe(false);
    expect(coercePastedValue('', field({ type: 'boolean' }))).toBe(false);
  });

  test('strips thousands separators from numbers (kept as string)', () => {
    expect(coercePastedValue('1,234', field({ type: 'double' }))).toBe('1234');
  });

  test('formats dates to an ISO date string', () => {
    expect(coercePastedValue('2024-01-15', field({ type: 'date' }))).toBe('2024-01-15');
  });

  test('keeps an unparseable date verbatim so validation can flag it', () => {
    expect(coercePastedValue('garbage', field({ type: 'date' }))).toBe('garbage');
  });

  test('normalizes a multipicklist to a semicolon-joined value', () => {
    expect(coercePastedValue('A, B;C', field({ type: 'multipicklist' }))).toBe('A;B;C');
  });

  test('passes picklist / reference / text values through unchanged', () => {
    expect(coercePastedValue('Open', field({ type: 'picklist' }))).toBe('Open');
    expect(coercePastedValue('001000000000001', field({ type: 'reference' }))).toBe('001000000000001');
  });
});

describe('applyPasteCellsToRows', () => {
  function makeRow(key: string, record: Record<string, any>): RowSalesforceRecordWithKey {
    return {
      _key: key,
      _record: record,
      _touchedColumns: new Set<string>(),
      _fieldErrors: {},
      _fieldWarnings: {},
      _recordErrors: [],
      ...record,
    } as RowSalesforceRecordWithKey;
  }

  const fieldMetadata = {
    name: field({ type: 'string', length: 5 }),
    industry: field({ type: 'string', length: 255 }),
  } as any;

  test('applies coerced values, marks columns touched, and validates', () => {
    const rows = [makeRow('r0', { Name: 'old', Industry: 'Tech' }), makeRow('r1', { Name: 'keep', Industry: 'Tech' })];
    const cells: PasteTargetCell[] = [
      { rowKey: 'r0', columnKey: 'Name', value: 'toolong' },
      { rowKey: 'r0', columnKey: 'Industry', value: 'Finance' },
    ];

    const result = applyPasteCellsToRows(rows, cells, fieldMetadata);

    // Untouched row keeps identity.
    expect(result[1]).toBe(rows[1]);

    const updated = result[0];
    expect(updated.Name).toBe('toolong');
    expect(updated.Industry).toBe('Finance');
    expect(Array.from(updated._touchedColumns).sort()).toEqual(['Industry', 'Name']);
    // "toolong" exceeds length 5 → cell error surfaced.
    expect(updated._fieldErrors?.Name).toContain('5');
    expect(updated._saveError).toContain('5');
  });

  test('returns the same array reference when there are no cells', () => {
    const rows = [makeRow('r0', { Name: 'x' })];
    expect(applyPasteCellsToRows(rows, [], fieldMetadata)).toBe(rows);
  });

  // Delete/Backspace routes empty values through this same path to clear cells.
  test('clears a cell when given an empty value and marks it dirty', () => {
    const rows = [makeRow('r0', { Name: 'Acme', Industry: 'Tech' })];
    const cells: PasteTargetCell[] = [{ rowKey: 'r0', columnKey: 'Name', value: '' }];

    const updated = applyPasteCellsToRows(rows, cells, fieldMetadata)[0];
    expect(updated.Name).toBe('');
    expect(updated._touchedColumns.has('Name')).toBe(true);
  });
});

describe('revertCellsInRows', () => {
  function makeRow(key: string, record: Record<string, any>, edits: Record<string, any>, touched: string[]): RowSalesforceRecordWithKey {
    return {
      _key: key,
      _record: record,
      _touchedColumns: new Set<string>(touched),
      _fieldErrors: {},
      _fieldWarnings: {},
      _recordErrors: [],
      ...record,
      ...edits,
    } as RowSalesforceRecordWithKey;
  }

  test('restores original values and removes the column from the touched set', () => {
    const rows = [makeRow('r0', { Name: 'Acme', Industry: 'Tech' }, { Name: 'Edited', Industry: 'Finance' }, ['Name', 'Industry'])];
    const cells: GridCellRef[] = [{ rowKey: 'r0', columnKey: 'Name' }];

    const updated = revertCellsInRows(rows, cells, null)[0];
    expect(updated.Name).toBe('Acme');
    expect(updated._touchedColumns.has('Name')).toBe(false);
    // The other edit is untouched.
    expect(updated.Industry).toBe('Finance');
    expect(updated._touchedColumns.has('Industry')).toBe(true);
  });

  test('returns the same array reference when there are no cells', () => {
    const rows = [makeRow('r0', { Name: 'Acme' }, { Name: 'Edited' }, ['Name'])];
    expect(revertCellsInRows(rows, [], null)).toBe(rows);
  });
});

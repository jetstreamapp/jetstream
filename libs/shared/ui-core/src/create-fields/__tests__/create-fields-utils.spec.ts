import { describe, expect, test } from 'vitest';
import { convertFormulaSecondaryTypeToEvaluatorType, ensureValidSecondaryType } from '../create-fields-utils';

describe('create-fields-utils#convertFormulaSecondaryTypeToEvaluatorType', () => {
  test.each([
    ['Checkbox', 'boolean'],
    ['Currency', 'number'],
    ['Date', 'date'],
    ['DateTime', 'datetime'],
    ['Number', 'number'],
    ['Percent', 'number'],
    ['Time', 'time'],
    ['Text', 'string'],
  ])('maps secondary type %s to %s', (input, expected) => {
    expect(convertFormulaSecondaryTypeToEvaluatorType(input)).toBe(expected);
  });

  // Imported fields can omit the secondaryType column, leaving the value undefined - it must not throw
  test.each([undefined, null])('returns string for missing secondary type (%s)', (input) => {
    expect(convertFormulaSecondaryTypeToEvaluatorType(input)).toBe('string');
  });

  test('returns string for an unknown secondary type', () => {
    expect(convertFormulaSecondaryTypeToEvaluatorType('SomethingElse')).toBe('string');
  });
});

describe('create-fields-utils#ensureValidSecondaryType', () => {
  test.each(['Checkbox', 'Currency', 'Date', 'DateTime', 'Number', 'Percent', 'Text', 'Time'])(
    'passes through the canonical value %s',
    (input) => {
      expect(ensureValidSecondaryType(input)).toBe(input);
    },
  );

  // Imported values only have their keys lowercased, so differently-cased values must still normalize to the canonical type
  test.each([
    ['checkbox', 'Checkbox'],
    ['currency', 'Currency'],
    ['DATETIME', 'DateTime'],
    ['  number  ', 'Number'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(ensureValidSecondaryType(input)).toBe(expected);
  });

  test.each(['', 'SomethingElse'])('falls back to Text for an unknown value (%s)', (input) => {
    expect(ensureValidSecondaryType(input)).toBe('Text');
  });

  // XLSX parsing can yield non-string cell values - they must fall back to Text instead of throwing
  test.each([123, true, false, new Date(0), {}, [], undefined, null])('falls back to Text for a non-string value (%s)', (input) => {
    expect(ensureValidSecondaryType(input)).toBe('Text');
  });
});

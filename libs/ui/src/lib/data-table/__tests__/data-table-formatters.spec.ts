import { describe, expect, test } from 'vitest';
import { dataTableDateFormatter, dataTableTimeFormatter } from '../data-table-formatters';

describe('dataTableDateFormatter', () => {
  test('returns null for empty values', () => {
    expect(dataTableDateFormatter(null)).toBeNull();
    expect(dataTableDateFormatter(undefined)).toBeNull();
    expect(dataTableDateFormatter('')).toBeNull();
  });

  test('formats a valid ISO date (length 10)', () => {
    expect(dataTableDateFormatter('2023-11-12')).toBe('2023-11-12');
  });

  test('formats a valid ISO datetime (length 28)', () => {
    const value = '2023-11-12T15:30:45.000+0000';
    expect(value.length).toBe(28);
    // Exact time depends on the runner's timezone, so assert the formatted shape rather than the wall-clock time.
    expect(dataTableDateFormatter(value)).toMatch(/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}:\d{2} (AM|PM)$/);
  });

  test('formats a valid Date instance', () => {
    const result = dataTableDateFormatter(new Date(2023, 10, 12, 15, 30, 45));
    expect(result).toBe('2023-11-12 3:30:45 PM');
  });

  // Regression: an invalid Date instance previously caused formatDate to throw "RangeError: Invalid time value".
  // It should fall back to the raw value (coerced to a string) rather than throwing or hiding data.
  test('returns the raw value for an invalid Date instance instead of throwing', () => {
    const value = new Date('invalid');
    expect(() => dataTableDateFormatter(value)).not.toThrow();
    expect(dataTableDateFormatter(value)).toBe('Invalid Date');
  });

  // Regression: a 10-char MM/DD/YYYY value (e.g. from a formula field) is not ISO and previously
  // caused parseISO -> Invalid Date -> formatDate to throw "RangeError: Invalid time value".
  test('returns the raw value for a 10-char non-ISO date instead of throwing', () => {
    expect(() => dataTableDateFormatter('12/11/2023')).not.toThrow();
    expect(dataTableDateFormatter('12/11/2023')).toBe('12/11/2023');
    expect(dataTableDateFormatter('10/15/2019')).toBe('10/15/2019');
  });

  test('returns the raw value for an unparseable 28-char value instead of throwing', () => {
    const value = 'x'.repeat(28);
    expect(() => dataTableDateFormatter(value)).not.toThrow();
    expect(dataTableDateFormatter(value)).toBe(value);
  });

  test('returns other-length strings unchanged', () => {
    expect(dataTableDateFormatter('some text')).toBe('some text');
  });
});

describe('dataTableTimeFormatter', () => {
  test('returns null for empty values', () => {
    expect(dataTableTimeFormatter(null)).toBeNull();
    expect(dataTableTimeFormatter(undefined)).toBeNull();
    expect(dataTableTimeFormatter('')).toBeNull();
  });

  test('formats a valid 13-char Salesforce time value', () => {
    expect(dataTableTimeFormatter('15:30:45.000Z')).toBe('3:30:45 PM');
  });

  // Regression: a 13-char value that does not match the expected time format should not throw.
  test('returns the raw value for an unparseable 13-char time instead of throwing', () => {
    const value = 'not-valid-tim';
    expect(value.length).toBe(13);
    expect(() => dataTableTimeFormatter(value)).not.toThrow();
    expect(dataTableTimeFormatter(value)).toBe(value);
  });

  test('returns other-length strings unchanged', () => {
    expect(dataTableTimeFormatter('15:30')).toBe('15:30');
  });
});

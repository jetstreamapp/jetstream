import { parse, unparse } from 'papaparse';
import { describe, expect, it } from 'vitest';
import { CSV_FORMULA_ESCAPE_REGEX, unescapeCsvFormula } from '../csv-formula-escape';

function roundTripCell(value: string) {
  const csv = unparse([[value]], { escapeFormulae: CSV_FORMULA_ESCAPE_REGEX });
  return parse<string[]>(csv).data[0][0];
}

describe('CSV_FORMULA_ESCAPE_REGEX', () => {
  it.each(['=SUM(1,2)', '+1', '-1', '@SUM(1,2)', '\tvalue', '\rvalue'])(
    'should escape a value starting with a formula trigger: %j',
    (value) => {
      expect(roundTripCell(value)).toBe(`'${value}`);
    },
  );

  it('should escape a formula followed by a line break, which the boolean option misses', () => {
    const value = '=HYPERLINK("https://example.com","x")\n';
    expect(parse<string[]>(unparse([[value]], { escapeFormulae: true })).data[0][0]).toBe(value);
    expect(roundTripCell(value)).toBe(`'${value}`);
  });

  it('should escape a formula with a line break in the middle', () => {
    const value = '=1+1\nsecond line';
    expect(roundTripCell(value)).toBe(`'${value}`);
  });

  it('should leave values that do not start with a trigger alone', () => {
    expect(roundTripCell('Account Name')).toBe('Account Name');
    expect(roundTripCell('a=b')).toBe('a=b');
    expect(CSV_FORMULA_ESCAPE_REGEX.test('')).toBe(false);
  });

  it('should not escape numbers, only strings', () => {
    const csv = unparse([[-1]], { escapeFormulae: CSV_FORMULA_ESCAPE_REGEX });
    expect(csv).toBe('-1');
  });
});

describe('unescapeCsvFormula', () => {
  it('should remove the quote added in front of a formula trigger', () => {
    expect(unescapeCsvFormula("'=SUM(1,2)")).toBe('=SUM(1,2)');
    expect(unescapeCsvFormula("'-1")).toBe('-1');
  });

  it('should round-trip an escaped value', () => {
    const value = '=1+1\nsecond line';
    expect(unescapeCsvFormula(roundTripCell(value))).toBe(value);
  });

  it('should leave other values untouched', () => {
    expect(unescapeCsvFormula("'quoted text'")).toBe("'quoted text'");
    expect(unescapeCsvFormula('=SUM(1,2)')).toBe('=SUM(1,2)');
    expect(unescapeCsvFormula(true)).toBe(true);
    expect(unescapeCsvFormula(undefined)).toBeUndefined();
  });
});

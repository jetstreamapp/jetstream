import { formatNumber } from '../shared-ui-utils';

describe('formatNumber', () => {
  it('formats whole numbers with thousands separators', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('returns "0" for zero, undefined, or NaN', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(undefined)).toBe('0');
    expect(formatNumber(NaN)).toBe('0');
  });

  it('handles small and negative numbers', () => {
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(-1234)).toBe('-1,234');
  });

  it('truncates fractional input to whole-number display (legacy behavior)', () => {
    // Previous numeral('0,0') behavior rounded; Intl.NumberFormat default also rounds for integer-only formatting.
    expect(formatNumber(1234.4)).toBe('1,234');
    expect(formatNumber(1234.6)).toBe('1,235');
  });
});

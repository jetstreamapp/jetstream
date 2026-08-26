import { describe, expect, it } from 'vitest';
import { getCoveragePercentage } from '../coverage/coverage-utils';

describe('getCoveragePercentage', () => {
  it('computes a rounded percentage', () => {
    expect(getCoveragePercentage({ NumLinesCovered: 2, NumLinesUncovered: 1 })).toBe(67);
    expect(getCoveragePercentage({ NumLinesCovered: 10, NumLinesUncovered: 0 })).toBe(100);
    expect(getCoveragePercentage({ NumLinesCovered: 0, NumLinesUncovered: 24 })).toBe(0);
  });

  it('returns null when the class has no coverable lines', () => {
    expect(getCoveragePercentage({ NumLinesCovered: 0, NumLinesUncovered: 0 })).toBeNull();
  });
});

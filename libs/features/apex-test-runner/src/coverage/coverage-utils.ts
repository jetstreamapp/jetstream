import type { ApexCodeCoverageAggregateRecord } from '@jetstream/types';

/**
 * Coverage percentage rounded to a whole number, or null when the class has no coverable lines
 * (e.g. an interface or a class containing only constants).
 */
export function getCoveragePercentage({
  NumLinesCovered,
  NumLinesUncovered,
}: Pick<ApexCodeCoverageAggregateRecord, 'NumLinesCovered' | 'NumLinesUncovered'>): number | null {
  const totalLines = NumLinesCovered + NumLinesUncovered;
  if (totalLines === 0) {
    return null;
  }
  return Math.round((NumLinesCovered / totalLines) * 100);
}

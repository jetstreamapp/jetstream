import type { ApexTestOutcome, ApexTestRunStatus, BadgeType } from '@jetstream/types';

export function getRunStatusBadgeType(status: ApexTestRunStatus): BadgeType {
  switch (status) {
    case 'Completed':
      return 'success';
    case 'Failed':
      return 'error';
    case 'Aborted':
      return 'warning';
    default:
      return 'default';
  }
}

export function getOutcomeBadgeType(outcome: ApexTestOutcome): BadgeType {
  switch (outcome) {
    case 'Pass':
      return 'success';
    case 'Fail':
    case 'CompileFail':
      return 'error';
    default:
      return 'default';
  }
}

/** Format a millisecond duration like "1.2s" / "450ms" */
export function formatTestTime(testTime: number | null | undefined): string {
  if (testTime === null || testTime === undefined) {
    return '';
  }
  if (testTime < 1000) {
    return `${testTime}ms`;
  }
  return `${(testTime / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}s`;
}

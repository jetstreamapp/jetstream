import { PermissionExportFindingCode } from '@jetstream/shared/constants';
import { describe, expect, it } from 'vitest';
import { aggregatePermissionAnalysisFindings, type PermissionAnalysisFinding } from '../permission-export-result-view';

describe('aggregatePermissionAnalysisFindings', () => {
  it('returns empty rollups for an empty list', () => {
    expect(aggregatePermissionAnalysisFindings([])).toEqual({ byCode: [], byObject: [] });
  });

  it('groups by code and object and excludes FINDINGS_TRUNCATED', () => {
    const rows: PermissionAnalysisFinding[] = [
      { severity: 'error', code: 'FLS_READ_NO_OBJECT_READ', objectApiName: 'Account', message: 'a' },
      { severity: 'error', code: 'FLS_READ_NO_OBJECT_READ', objectApiName: 'Contact', message: 'b' },
      { severity: 'warning', code: 'OLS_READ_NO_FLS_ROWS', objectApiName: 'Account', message: 'c' },
      { severity: 'warning', code: PermissionExportFindingCode.FINDINGS_TRUNCATED, message: 'cap' },
    ];
    const agg = aggregatePermissionAnalysisFindings(rows);
    expect(agg.byCode.map((r) => r.code)).toEqual(['FLS_READ_NO_OBJECT_READ', 'OLS_READ_NO_FLS_ROWS']);
    expect(agg.byCode[0].count).toBe(2);
    expect(agg.byCode[0].errorCount).toBe(2);
    expect(agg.byObject.find((o) => o.objectApiName === 'Account')?.count).toBe(2);
  });
});

import { PermissionExportFindingCode } from '@jetstream/shared/constants';
import { describe, expect, it } from 'vitest';
import { aggregatePermissionAnalysisFindings, type PermissionAnalysisFinding } from '../permission-export-result-view';

describe('aggregatePermissionAnalysisFindings', () => {
  it('returns empty rollups for an empty list', () => {
    expect(aggregatePermissionAnalysisFindings([])).toEqual({ byCode: [], byObject: [] });
  });

  it('groups by code and object and excludes FINDINGS_TRUNCATED', () => {
    const rows: PermissionAnalysisFinding[] = [
      { severity: 'error', code: 'OBJECT_MODIFY_ALL_RECORDS', objectApiName: 'Account', message: 'a' },
      { severity: 'error', code: 'OBJECT_MODIFY_ALL_RECORDS', objectApiName: 'Contact', message: 'b' },
      { severity: 'warning', code: 'OLS_READ_NO_FLS_ROWS', objectApiName: 'Account', message: 'c' },
      { severity: 'warning', code: PermissionExportFindingCode.FINDINGS_TRUNCATED, message: 'cap' },
    ];
    const agg = aggregatePermissionAnalysisFindings(rows);
    expect(agg.byCode.map((r) => r.code)).toEqual(['OBJECT_MODIFY_ALL_RECORDS', 'OLS_READ_NO_FLS_ROWS']);
    expect(agg.byCode[0].count).toBe(2);
    expect(agg.byCode[0].errorCount).toBe(2);
    expect(agg.byObject.find((o) => o.objectApiName === 'Account')?.count).toBe(2);
  });

  it('counts by the catalog severity, not a stale stored one', () => {
    // The rollup tiles and the grid highlights must never disagree: both resolve severity from the
    // catalog, so a row whose stored severity contradicts its code is counted as the catalog says.
    const rows: PermissionAnalysisFinding[] = [
      { severity: 'error', code: 'FLS_READ_NO_OBJECT_READ', objectApiName: 'Account', message: 'a' },
    ];
    const agg = aggregatePermissionAnalysisFindings(rows);
    expect(agg.byCode[0].errorCount).toBe(0);
    expect(agg.byCode[0].warningCount).toBe(1);
  });

  it('falls back to the stored severity for a code the catalog no longer knows', () => {
    const rows: PermissionAnalysisFinding[] = [{ severity: 'error', code: 'RETIRED_LEGACY_CODE', objectApiName: 'Account', message: 'a' }];
    const agg = aggregatePermissionAnalysisFindings(rows);
    expect(agg.byCode[0].errorCount).toBe(1);
  });
});

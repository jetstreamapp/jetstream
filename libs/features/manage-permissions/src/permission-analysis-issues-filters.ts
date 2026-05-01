import { PermissionExportFindingCode } from '@jetstream/shared/constants';
import { useCallback, useMemo } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import {
  type PermissionAnalysisFinding,
  type PermissionExportRow,
  getFindingContainerId,
  getPermissionSetIdsWithDirectUserAssignment,
} from './permission-export-result-view';

export type IssuesSeverityFilter = 'all' | 'errors' | 'warnings';

/** Valid values for `issueSeverity` query param (anything else is treated as `all`). */
export function parseIssuesSeverityFilterFromSearchParams(searchParams: URLSearchParams): IssuesSeverityFilter {
  const raw = searchParams.get('issueSeverity');
  if (raw === 'errors' || raw === 'warnings') {
    return raw;
  }
  return 'all';
}

export type IssuesOlsFlsFilter = 'all' | 'ols' | 'fls';

/** Valid values for `issueOlsFls` query param (anything else is treated as `all`). */
export function parseIssuesOlsFlsFilterFromSearchParams(searchParams: URLSearchParams): IssuesOlsFlsFilter {
  const raw = searchParams.get('issueOlsFls');
  if (raw === 'ols' || raw === 'fls') {
    return raw;
  }
  return 'all';
}

export type IssuesDirectAssignmentFilter = 'all' | 'assigned' | 'unassigned';
export type IssuesGroupBy = 'none' | 'severity' | 'object' | 'code' | 'container';

/** Query param for filtering the Issues grid (and related views) to one finding code. */
export const PERMISSION_ANALYSIS_ISSUE_CODE_PARAM = 'issueCode';

export function readPermissionAnalysisSearchParam(searchParams: URLSearchParams, key: string, fallback: string): string {
  const value = searchParams.get(key);
  return value && value.length > 0 ? value : fallback;
}

export function mergePermissionAnalysisSearchParams(
  searchParams: URLSearchParams,
  updates: Record<string, string | null | undefined>,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next;
}

function normalizeSeverity(value: string | undefined): string {
  return (value ?? '').toLowerCase();
}

export function isErrorSeverity(value: string | undefined): boolean {
  const normalized = normalizeSeverity(value);
  return normalized === 'error' || normalized === 'errors';
}

export function isWarningSeverity(value: string | undefined): boolean {
  const normalized = normalizeSeverity(value);
  return normalized === 'warning' || normalized === 'warnings';
}

/**
 * Buckets a finding `code` for OLS vs FLS toolbar filters.
 * Matches {@link PermissionExportFindingCode} prefixes (OLS_… / FLS_…).
 * Meta codes such as FINDINGS_TRUNCATED and blank codes classify as `other` (visible only when filter is All).
 */
function findingCodeKind(code: string | undefined): 'ols' | 'fls' | 'other' {
  const upper = (code ?? '').trim().toUpperCase();
  if (upper.startsWith('OLS')) {
    return 'ols';
  }
  if (upper.startsWith('FLS')) {
    return 'fls';
  }
  return 'other';
}

export interface UsePermissionAnalysisIssuesFiltersArgs {
  findings: PermissionAnalysisFinding[];
  permissionSetAssignments: PermissionExportRow[];
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

export interface UsePermissionAnalysisIssuesFiltersResult {
  severityFilter: IssuesSeverityFilter;
  olsFlsFilter: IssuesOlsFlsFilter;
  directAssignmentFilter: IssuesDirectAssignmentFilter;
  groupBy: IssuesGroupBy;
  issueCodeFilter: string | null;
  hasAssignmentData: boolean;
  filteredFindings: PermissionAnalysisFinding[];
  issueCodeRows: { code: string; count: number }[];
  errorTotal: number;
  warningTotal: number;
  errorFiltered: number;
  warningFiltered: number;
  updateParams: (updates: Record<string, string | null | undefined>) => void;
  setIssueCodeFilter: (next: string | null) => void;
}

export function usePermissionAnalysisIssuesFilters({
  findings,
  permissionSetAssignments,
  searchParams,
  setSearchParams,
}: UsePermissionAnalysisIssuesFiltersArgs): UsePermissionAnalysisIssuesFiltersResult {
  const severityFilter = parseIssuesSeverityFilterFromSearchParams(searchParams);
  const olsFlsFilter = parseIssuesOlsFlsFilterFromSearchParams(searchParams);
  const directAssignmentFilter = readPermissionAnalysisSearchParam(
    searchParams,
    'issueDirectAssign',
    'all',
  ) as IssuesDirectAssignmentFilter;
  const groupBy = readPermissionAnalysisSearchParam(searchParams, 'cfGroup', 'none') as IssuesGroupBy;
  const issueCodeRaw = searchParams.get(PERMISSION_ANALYSIS_ISSUE_CODE_PARAM);
  const issueCodeFilter = issueCodeRaw != null && issueCodeRaw.length > 0 ? issueCodeRaw : null;

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      setSearchParams(mergePermissionAnalysisSearchParams(searchParams, updates), { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setIssueCodeFilter = useCallback(
    (next: string | null) => {
      updateParams({ [PERMISSION_ANALYSIS_ISSUE_CODE_PARAM]: next });
    },
    [updateParams],
  );

  const permissionSetsWithUsers = useMemo(
    () => getPermissionSetIdsWithDirectUserAssignment(permissionSetAssignments),
    [permissionSetAssignments],
  );
  const hasAssignmentData = permissionSetAssignments.length > 0;

  const filteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      const severityValue = finding.severity as string | undefined;
      if (severityFilter === 'errors' && !isErrorSeverity(severityValue)) {
        return false;
      }
      // Warnings-only: keep rows whose severity is warning/warnings (not errors, not unknown/other).
      if (severityFilter === 'warnings' && !isWarningSeverity(severityValue)) {
        return false;
      }
      if (olsFlsFilter === 'ols' && findingCodeKind(finding.code as string | undefined) !== 'ols') {
        return false;
      }
      if (olsFlsFilter === 'fls' && findingCodeKind(finding.code as string | undefined) !== 'fls') {
        return false;
      }
      if (directAssignmentFilter !== 'all' && hasAssignmentData) {
        const containerId = getFindingContainerId(finding);
        if (!containerId) {
          return false;
        }
        const assigned = permissionSetsWithUsers.has(containerId);
        if (directAssignmentFilter === 'assigned' && !assigned) {
          return false;
        }
        if (directAssignmentFilter === 'unassigned' && assigned) {
          return false;
        }
      }
      if (issueCodeFilter && String(finding.code ?? '') !== issueCodeFilter) {
        return false;
      }
      return true;
    });
  }, [findings, severityFilter, olsFlsFilter, directAssignmentFilter, hasAssignmentData, permissionSetsWithUsers, issueCodeFilter]);

  const issueCodeRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filteredFindings) {
      const code = String(row.code ?? '');
      const key = code.length > 0 ? code : '(no code)';
      if (key === PermissionExportFindingCode.FINDINGS_TRUNCATED) {
        continue;
      }
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  }, [filteredFindings]);

  const errorTotal = useMemo(() => findings.filter((f) => isErrorSeverity(f.severity as string | undefined)).length, [findings]);
  const warningTotal = useMemo(() => findings.filter((f) => isWarningSeverity(f.severity as string | undefined)).length, [findings]);
  const errorFiltered = useMemo(
    () => filteredFindings.filter((f) => isErrorSeverity(f.severity as string | undefined)).length,
    [filteredFindings],
  );
  const warningFiltered = useMemo(
    () => filteredFindings.filter((f) => isWarningSeverity(f.severity as string | undefined)).length,
    [filteredFindings],
  );

  return {
    severityFilter,
    olsFlsFilter,
    directAssignmentFilter,
    groupBy,
    issueCodeFilter,
    hasAssignmentData,
    filteredFindings,
    issueCodeRows,
    errorTotal,
    warningTotal,
    errorFiltered,
    warningFiltered,
    updateParams,
    setIssueCodeFilter,
  };
}

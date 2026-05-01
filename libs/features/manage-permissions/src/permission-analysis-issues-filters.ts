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

/** Issues grid column keys (order matches default grid). */
export const ISSUES_GRID_COLUMN_KEYS = [
  'severity',
  'code',
  'objectApiName',
  'fieldApiName',
  'message',
  'permissionSetId',
  'parentId',
  'containerId',
] as const;

export type IssuesGridColumnKey = (typeof ISSUES_GRID_COLUMN_KEYS)[number];

export const ISSUES_GRID_COLUMN_LABELS: Record<IssuesGridColumnKey, string> = {
  severity: 'Severity',
  code: 'Issue',
  objectApiName: 'Object',
  fieldApiName: 'Field',
  message: 'Message',
  permissionSetId: 'Permission set Id',
  parentId: 'Parent Id',
  containerId: 'Container Id',
};

/** Comma-separated keys in `issueHiddenCols`; unknown segments ignored. */
export function parseIssueHiddenColumnsFromSearchParams(searchParams: URLSearchParams): Set<IssuesGridColumnKey> {
  const raw = searchParams.get('issueHiddenCols');
  if (!raw) {
    return new Set();
  }
  const allowed = new Set<string>(ISSUES_GRID_COLUMN_KEYS);
  const result = new Set<IssuesGridColumnKey>();
  for (const part of raw.split(',')) {
    const key = part.trim();
    if (allowed.has(key)) {
      result.add(key as IssuesGridColumnKey);
    }
  }
  return result;
}

export type IssuesScopeFilter = 'all' | 'profiles' | 'permissionSets';

/** Valid values for `issueScope` when the export used explicit profile vs permission set scope. */
export function parseIssuesScopeFilterFromSearchParams(searchParams: URLSearchParams): IssuesScopeFilter {
  const raw = searchParams.get('issueScope');
  if (raw === 'profiles' || raw === 'permissionSets') {
    return raw;
  }
  return 'all';
}

export interface IssueScopeFilterContext {
  /**
   * True when the job selected both profile permission sets and standalone permission sets.
   * Export Scope filtering (and the toolbar control) applies only in that case.
   */
  supportsExportScopeFilter: boolean;
  profilePermissionSetIds: ReadonlySet<string>;
  permissionSetIds: ReadonlySet<string>;
}

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
 * Buckets an issue `code` for OLS vs FLS toolbar filters.
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
  /** When set, issues can be narrowed to profile permission sets vs standalone permission sets from the job scope. */
  issueScopeFilterContext?: IssueScopeFilterContext;
}

export interface UsePermissionAnalysisIssuesFiltersResult {
  severityFilter: IssuesSeverityFilter;
  olsFlsFilter: IssuesOlsFlsFilter;
  directAssignmentFilter: IssuesDirectAssignmentFilter;
  scopeFilter: IssuesScopeFilter;
  /** Same reference passed into the hook; used by the toolbar for Export Scope visibility. */
  issueScopeFilterContext: IssueScopeFilterContext | undefined;
  hiddenIssueGridColumns: ReadonlySet<IssuesGridColumnKey>;
  groupBy: IssuesGroupBy;
  hasAssignmentData: boolean;
  filteredFindings: PermissionAnalysisFinding[];
  errorTotal: number;
  warningTotal: number;
  errorFiltered: number;
  warningFiltered: number;
  updateParams: (updates: Record<string, string | null | undefined>) => void;
}

export function usePermissionAnalysisIssuesFilters({
  findings,
  permissionSetAssignments,
  searchParams,
  setSearchParams,
  issueScopeFilterContext,
}: UsePermissionAnalysisIssuesFiltersArgs): UsePermissionAnalysisIssuesFiltersResult {
  const severityFilter = parseIssuesSeverityFilterFromSearchParams(searchParams);
  const olsFlsFilter = parseIssuesOlsFlsFilterFromSearchParams(searchParams);
  const scopeFilter = parseIssuesScopeFilterFromSearchParams(searchParams);
  const hiddenIssueGridColumns = useMemo(() => parseIssueHiddenColumnsFromSearchParams(searchParams), [searchParams]);
  const directAssignmentFilter = readPermissionAnalysisSearchParam(
    searchParams,
    'issueDirectAssign',
    'all',
  ) as IssuesDirectAssignmentFilter;
  const groupBy = readPermissionAnalysisSearchParam(searchParams, 'cfGroup', 'none') as IssuesGroupBy;

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      setSearchParams(mergePermissionAnalysisSearchParams(searchParams, updates), { replace: true });
    },
    [searchParams, setSearchParams],
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
      if (issueScopeFilterContext?.supportsExportScopeFilter && scopeFilter !== 'all') {
        const containerId = getFindingContainerId(finding);
        if (!containerId) {
          return false;
        }
        if (scopeFilter === 'profiles' && !issueScopeFilterContext.profilePermissionSetIds.has(containerId)) {
          return false;
        }
        if (scopeFilter === 'permissionSets' && !issueScopeFilterContext.permissionSetIds.has(containerId)) {
          return false;
        }
      }
      return true;
    });
  }, [
    findings,
    severityFilter,
    olsFlsFilter,
    directAssignmentFilter,
    hasAssignmentData,
    permissionSetsWithUsers,
    issueScopeFilterContext,
    scopeFilter,
  ]);

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
    scopeFilter,
    issueScopeFilterContext,
    hiddenIssueGridColumns,
    groupBy,
    hasAssignmentData,
    filteredFindings,
    errorTotal,
    warningTotal,
    errorFiltered,
    warningFiltered,
    updateParams,
  };
}

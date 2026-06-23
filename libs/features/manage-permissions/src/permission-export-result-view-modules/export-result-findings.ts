import { getPermissionExportFindingDefinition, PermissionExportFindingCode } from '@jetstream/shared/constants';

import {
  FIELD_PERMISSION_BOOLEAN_COLUMN_KEYS,
  type PermissionAnalysisFinding,
  type PermissionExportRow,
} from './export-result-types-labels';

export function getFindingContainerId(finding: PermissionAnalysisFinding): string | null {
  const candidates = [finding.permissionSetId, finding.parentId, finding.containerId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

/** Matches {@link buildPermissionExportFindings} row keying: permission-set container + object API name. */
export function objectPermissionFindingRowKey(parentId: string, objectApiName: string): string {
  return `${parentId}::${objectApiName}`;
}

export type PermissionObjectFindingCellSeverity = 'error' | 'warning';

const OBJECT_FINDING_READ_PATH_COLUMNS = ['PermissionsRead', 'PermissionsViewAllRecords', 'PermissionsModifyAllRecords'] as const;
const OBJECT_FINDING_EDIT_PATH_COLUMNS = ['PermissionsEdit', 'PermissionsModifyAllRecords'] as const;

/**
 * Object-permission grid column keys highlighted for a given issue `code` (empty when none).
 */
export function getObjectPermissionHighlightColumnKeysForFindingCode(code: string): readonly string[] {
  const trimmed = code.trim();
  if (!trimmed || trimmed === PermissionExportFindingCode.FINDINGS_TRUNCATED) {
    return [];
  }
  if (trimmed === PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS) {
    return ['PermissionsRead'];
  }
  if (trimmed === PermissionExportFindingCode.OLS_EDIT_NO_FLS_ROWS) {
    return ['PermissionsEdit'];
  }
  if (trimmed === PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ) {
    return OBJECT_FINDING_READ_PATH_COLUMNS;
  }
  if (trimmed === PermissionExportFindingCode.FLS_EDIT_NO_OBJECT_EDIT) {
    return OBJECT_FINDING_EDIT_PATH_COLUMNS;
  }
  // Modify All Records implies View All Records, so highlight both columns for the (error) modify finding.
  if (trimmed === PermissionExportFindingCode.OBJECT_MODIFY_ALL_RECORDS) {
    return ['PermissionsModifyAllRecords', 'PermissionsViewAllRecords'];
  }
  if (trimmed === PermissionExportFindingCode.OBJECT_VIEW_ALL_RECORDS) {
    return ['PermissionsViewAllRecords'];
  }
  return [];
}

function severityForObjectPermissionFindingCode(code: string): PermissionObjectFindingCellSeverity | null {
  const def = getPermissionExportFindingDefinition(code);
  if (!def) {
    return null;
  }
  return def.severity === 'error' ? 'error' : 'warning';
}

/**
 * Issues that contribute to highlighting this leaf row cell on the Object Permissions tree.
 */
export function listFindingsForObjectPermissionCell(
  findings: readonly PermissionAnalysisFinding[],
  parentId: string,
  objectApiName: string,
  columnKey: string,
): PermissionAnalysisFinding[] {
  const normalizedParent = parentId.trim();
  const normalizedObject = objectApiName.trim();
  const normalizedColumn = columnKey.trim();
  const matches: PermissionAnalysisFinding[] = [];
  for (const finding of findings) {
    const findingParent = getFindingContainerId(finding)?.trim() ?? '';
    const findingObject = typeof finding.objectApiName === 'string' ? finding.objectApiName.trim() : '';
    if (!findingParent || !findingObject) {
      continue;
    }
    if (findingParent !== normalizedParent || findingObject !== normalizedObject) {
      continue;
    }
    const codeRaw = typeof finding.code === 'string' ? finding.code.trim() : '';
    const highlightColumns = getObjectPermissionHighlightColumnKeysForFindingCode(codeRaw);
    if (!highlightColumns.includes(normalizedColumn)) {
      continue;
    }
    matches.push(finding);
  }
  return matches;
}

/**
 * Maps object-permission export rows (ParentId + SobjectType) to permission boolean columns that
 * should be highlighted on the Object Permissions tree from analysis issues.
 *
 * @param findings Parsed `analysis_job.result.findings` (same issue rows as the Issues tab).
 * @returns Outer key: {@link objectPermissionFindingRowKey}; inner key: `Permissions*` column name.
 */
export function buildObjectPermissionFindingCellHighlights(
  findings: PermissionAnalysisFinding[],
): Map<string, Map<string, PermissionObjectFindingCellSeverity>> {
  const result = new Map<string, Map<string, PermissionObjectFindingCellSeverity>>();

  const mergeCell = (rowKey: string, columnKey: string, severity: PermissionObjectFindingCellSeverity): void => {
    let columnMap = result.get(rowKey);
    if (!columnMap) {
      columnMap = new Map();
      result.set(rowKey, columnMap);
    }
    const existing = columnMap.get(columnKey);
    const next: PermissionObjectFindingCellSeverity = existing === 'error' || severity === 'error' ? 'error' : severity;
    columnMap.set(columnKey, next);
  };

  for (const finding of findings) {
    const codeRaw = typeof finding.code === 'string' ? finding.code.trim() : '';
    const objectApi = typeof finding.objectApiName === 'string' ? finding.objectApiName.trim() : '';
    const parentId = getFindingContainerId(finding)?.trim() ?? '';
    if (!codeRaw || !objectApi || !parentId) {
      continue;
    }
    const highlightColumns = getObjectPermissionHighlightColumnKeysForFindingCode(codeRaw);
    if (highlightColumns.length === 0) {
      continue;
    }
    const severity = severityForObjectPermissionFindingCode(codeRaw);
    if (!severity) {
      continue;
    }
    const rowKey = objectPermissionFindingRowKey(parentId, objectApi);
    for (const columnKey of highlightColumns) {
      mergeCell(rowKey, columnKey, severity);
    }
  }

  return result;
}

/**
 * Sentinel field segment for {@link fieldPermissionFindingRowKey} when an issue applies to every
 * field-permission row for the same permission set + object (e.g. {@link PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW}).
 */
export const FIELD_PERMISSION_OBJECT_SCOPE_MARKER = '__FIELD_PERM_OBJECT_SCOPE__';

/** Row key for field-permission export highlights (`ParentId::SobjectType::Field` or scope marker). */
export function fieldPermissionFindingRowKey(parentId: string, objectApiName: string, fieldSegment: string): string {
  return `${parentId.trim()}::${objectApiName.trim()}::${fieldSegment.trim()}`;
}

/**
 * Field-permission grid column keys highlighted for a given issue `code` (empty when none on this surface).
 */
export function getFieldPermissionHighlightColumnKeysForFindingCode(code: string): readonly string[] {
  const trimmed = code.trim();
  if (!trimmed || trimmed === PermissionExportFindingCode.FINDINGS_TRUNCATED) {
    return [];
  }
  if (trimmed === PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ) {
    return ['PermissionsRead'];
  }
  if (trimmed === PermissionExportFindingCode.FLS_EDIT_NO_OBJECT_EDIT) {
    return ['PermissionsEdit'];
  }
  if (trimmed === PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW) {
    return [...FIELD_PERMISSION_BOOLEAN_COLUMN_KEYS];
  }
  return [];
}

function severityForFieldPermissionFindingCode(code: string): PermissionObjectFindingCellSeverity | null {
  return severityForObjectPermissionFindingCode(code);
}

/**
 * Issues that highlight this field-permission export cell (same `ParentId` / `SobjectType` / `Field` row).
 */
export function listFindingsForFieldPermissionCell(
  findings: readonly PermissionAnalysisFinding[],
  parentId: string,
  objectApiName: string,
  fieldApiName: string,
  columnKey: string,
): PermissionAnalysisFinding[] {
  const normalizedParent = parentId.trim();
  const normalizedObject = objectApiName.trim();
  const normalizedField = fieldApiName.trim();
  const normalizedColumn = columnKey.trim();
  const matches: PermissionAnalysisFinding[] = [];
  for (const finding of findings) {
    const findingParent = getFindingContainerId(finding)?.trim() ?? '';
    const findingObject = typeof finding.objectApiName === 'string' ? finding.objectApiName.trim() : '';
    if (!findingParent || !findingObject || findingParent !== normalizedParent || findingObject !== normalizedObject) {
      continue;
    }
    const codeRaw = typeof finding.code === 'string' ? finding.code.trim() : '';
    const highlightColumns = getFieldPermissionHighlightColumnKeysForFindingCode(codeRaw);
    if (!highlightColumns.includes(normalizedColumn)) {
      continue;
    }
    if (codeRaw === PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW) {
      matches.push(finding);
      continue;
    }
    const findingField = typeof finding.fieldApiName === 'string' ? finding.fieldApiName.trim() : '';
    if (findingField === normalizedField) {
      matches.push(finding);
    }
  }
  return matches;
}

/**
 * Maps field-permission export rows to cells that should highlight from analysis issues.
 *
 * @returns Outer key: {@link fieldPermissionFindingRowKey}; inner key: column name (e.g. `PermissionsRead`).
 */
export function buildFieldPermissionFindingCellHighlights(
  findings: PermissionAnalysisFinding[],
): Map<string, Map<string, PermissionObjectFindingCellSeverity>> {
  const result = new Map<string, Map<string, PermissionObjectFindingCellSeverity>>();

  const mergeCell = (rowKey: string, columnKey: string, severity: PermissionObjectFindingCellSeverity): void => {
    let columnMap = result.get(rowKey);
    if (!columnMap) {
      columnMap = new Map();
      result.set(rowKey, columnMap);
    }
    const existing = columnMap.get(columnKey);
    const next: PermissionObjectFindingCellSeverity = existing === 'error' || severity === 'error' ? 'error' : severity;
    columnMap.set(columnKey, next);
  };

  for (const finding of findings) {
    const codeRaw = typeof finding.code === 'string' ? finding.code.trim() : '';
    const objectApi = typeof finding.objectApiName === 'string' ? finding.objectApiName.trim() : '';
    const parentId = getFindingContainerId(finding)?.trim() ?? '';
    if (!codeRaw || !objectApi || !parentId) {
      continue;
    }
    const highlightColumns = getFieldPermissionHighlightColumnKeysForFindingCode(codeRaw);
    if (highlightColumns.length === 0) {
      continue;
    }
    const severity = severityForFieldPermissionFindingCode(codeRaw);
    if (!severity) {
      continue;
    }
    const fieldPart =
      codeRaw === PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW
        ? FIELD_PERMISSION_OBJECT_SCOPE_MARKER
        : typeof finding.fieldApiName === 'string'
          ? finding.fieldApiName.trim()
          : '';
    if (!fieldPart) {
      continue;
    }
    const rowKey = fieldPermissionFindingRowKey(parentId, objectApi, fieldPart);
    for (const columnKey of highlightColumns) {
      mergeCell(rowKey, columnKey, severity);
    }
  }

  return result;
}

export function fieldPermissionCellSeverity(
  highlights: Map<string, Map<string, PermissionObjectFindingCellSeverity>>,
  parentId: string,
  objectApiName: string,
  fieldApiName: string,
  columnKey: string,
): PermissionObjectFindingCellSeverity | undefined {
  const specificKey = fieldPermissionFindingRowKey(parentId, objectApiName, fieldApiName);
  const scopeKey = fieldPermissionFindingRowKey(parentId, objectApiName, FIELD_PERMISSION_OBJECT_SCOPE_MARKER);
  const fromSpecific = highlights.get(specificKey)?.get(columnKey);
  const fromScope = highlights.get(scopeKey)?.get(columnKey);
  if (fromSpecific === 'error' || fromScope === 'error') {
    return 'error';
  }
  return fromSpecific ?? fromScope;
}

function isErrorLikeSeverity(value: unknown): boolean {
  const normalized = String(value ?? '').toLowerCase();
  return normalized === 'error' || normalized === 'errors';
}

function isWarningLikeSeverity(value: unknown): boolean {
  const normalized = String(value ?? '').toLowerCase();
  return normalized === 'warning' || normalized === 'warnings';
}

/**
 * Severity used for container-level badges (permission set / profile rows), from catalog definition or row payload.
 */
function containerSeverityFromFinding(finding: PermissionAnalysisFinding, codeRaw: string): PermissionObjectFindingCellSeverity | null {
  const def = getPermissionExportFindingDefinition(codeRaw);
  if (def) {
    return def.severity === 'error' ? 'error' : 'warning';
  }
  if (isErrorLikeSeverity(finding.severity)) {
    return 'error';
  }
  if (isWarningLikeSeverity(finding.severity)) {
    return 'warning';
  }
  return null;
}

/**
 * Max severity per permission-set container Id for profile / permission-set / assignment export rows.
 */
export function buildContainerIdFindingSeverity(
  findings: readonly PermissionAnalysisFinding[],
): Map<string, PermissionObjectFindingCellSeverity> {
  const result = new Map<string, PermissionObjectFindingCellSeverity>();
  for (const finding of findings) {
    const codeRaw = typeof finding.code === 'string' ? finding.code.trim() : '';
    if (!codeRaw || codeRaw === PermissionExportFindingCode.FINDINGS_TRUNCATED) {
      continue;
    }
    const containerId = getFindingContainerId(finding)?.trim() ?? '';
    if (!containerId) {
      continue;
    }
    const next = containerSeverityFromFinding(finding, codeRaw);
    if (!next) {
      continue;
    }
    const existing = result.get(containerId);
    const merged: PermissionObjectFindingCellSeverity = existing === 'error' || next === 'error' ? 'error' : next;
    result.set(containerId, merged);
  }
  return result;
}

/**
 * All issues for a permission-set container (same list as Issues tab), excluding truncation rows.
 */
export function listFindingsForExportContainer(
  findings: readonly PermissionAnalysisFinding[],
  containerId: string,
): PermissionAnalysisFinding[] {
  const id = containerId.trim();
  if (!id) {
    return [];
  }
  return findings.filter((finding) => {
    const code = String(finding.code ?? '').trim();
    if (code === PermissionExportFindingCode.FINDINGS_TRUNCATED) {
      return false;
    }
    return getFindingContainerId(finding)?.trim() === id;
  });
}

/** Column keys on permission-set export rows that open the container issues modal (first match wins). */
export function pickPermissionSetExportClickableColumnKeys(sample: PermissionExportRow): string[] {
  const preferred = ['Label', 'Name', 'MasterLabel', 'DeveloperName', 'Profile', 'Id'] as const;
  return preferred.filter((key) => key in sample);
}

/** Column keys on assignment rows that open issues for the related permission set. */
export function pickAssignmentExportClickableColumnKeys(sample: PermissionExportRow): string[] {
  const preferred = ['PermissionSetId', 'AssigneeId', 'Id'] as const;
  return preferred.filter((key) => key in sample);
}

/** Column keys on PermissionSetTabSetting rows (`ParentId` = permission set). */
export function pickTabVisibilityExportClickableColumnKeys(sample: PermissionExportRow): string[] {
  const preferred = ['ParentId', 'Name', 'Visibility', 'Id'] as const;
  return preferred.filter((key) => key in sample);
}

export function getFindingLabelForCode(code: string | undefined): string {
  if (!code) {
    return '';
  }
  return getPermissionExportFindingDefinition(code)?.label ?? '';
}

export interface FindingCodeDisplayParts {
  /** Catalog label when the code is known; otherwise the raw value (or "(no code)"). */
  title: string;
  /** Raw exporter `code` for muted parentheses when a catalog label exists. */
  technicalCode: string | null;
}

/**
 * Splits an issue `code` into a user-facing title vs optional technical identifier.
 */
export function getFindingCodeDisplayParts(code: string | undefined): FindingCodeDisplayParts {
  const raw = typeof code === 'string' ? code.trim() : '';
  if (!raw) {
    return { title: '(no code)', technicalCode: null };
  }
  const catalogLabel = getFindingLabelForCode(raw);
  if (catalogLabel.length > 0) {
    return { title: catalogLabel, technicalCode: raw };
  }
  return { title: raw, technicalCode: null };
}

export interface PermissionFindingCodeRollup {
  code: string;
  count: number;
  errorCount: number;
  warningCount: number;
  label: string;
}

export interface PermissionFindingObjectRollup {
  objectApiName: string;
  count: number;
  errorCount: number;
  warningCount: number;
}

export interface AggregatePermissionFindingsResult {
  byCode: PermissionFindingCodeRollup[];
  byObject: PermissionFindingObjectRollup[];
}

/** Rolls up the current issue list for summary tiles. */
export function aggregatePermissionAnalysisFindings(findings: PermissionAnalysisFinding[]): AggregatePermissionFindingsResult {
  const byCodeMap = new Map<string, { count: number; errors: number; warnings: number }>();
  const byObjectMap = new Map<string, { count: number; errors: number; warnings: number }>();

  for (const row of findings) {
    const codeRaw = String(row.code ?? '').trim();
    const code = codeRaw.length > 0 ? codeRaw : '(no code)';
    if (code === PermissionExportFindingCode.FINDINGS_TRUNCATED) {
      continue;
    }
    const objectKeyRaw = String(row.objectApiName ?? '').trim();
    const objectKey = objectKeyRaw.length > 0 ? objectKeyRaw : '(no object)';
    const isError = isErrorLikeSeverity(row.severity);
    const isWarning = isWarningLikeSeverity(row.severity);

    const codeAgg = byCodeMap.get(code) ?? { count: 0, errors: 0, warnings: 0 };
    codeAgg.count += 1;
    if (isError) {
      codeAgg.errors += 1;
    }
    if (isWarning) {
      codeAgg.warnings += 1;
    }
    byCodeMap.set(code, codeAgg);

    const objectAgg = byObjectMap.get(objectKey) ?? { count: 0, errors: 0, warnings: 0 };
    objectAgg.count += 1;
    if (isError) {
      objectAgg.errors += 1;
    }
    if (isWarning) {
      objectAgg.warnings += 1;
    }
    byObjectMap.set(objectKey, objectAgg);
  }

  const byCode: PermissionFindingCodeRollup[] = [...byCodeMap.entries()]
    .map(([code, value]) => ({
      code,
      count: value.count,
      errorCount: value.errors,
      warningCount: value.warnings,
      label: getFindingLabelForCode(code === '(no code)' ? undefined : code),
    }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  const byObject: PermissionFindingObjectRollup[] = [...byObjectMap.entries()]
    .map(([objectApiName, value]) => ({
      objectApiName,
      count: value.count,
      errorCount: value.errors,
      warningCount: value.warnings,
    }))
    .sort((a, b) => b.count - a.count || a.objectApiName.localeCompare(b.objectApiName));

  return { byCode, byObject };
}

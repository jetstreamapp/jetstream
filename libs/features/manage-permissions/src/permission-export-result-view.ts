import { getPermissionExportFindingDefinition, PermissionExportFindingCode } from '@jetstream/shared/constants';
import type { ColumnWithFilter, RowWithKey } from '@jetstream/ui';
import { getRowTypeFromValue, setColumnFromType } from '@jetstream/ui';

/** Salesforce User Id prefix (15- or 18-char Ids). */
const USER_ID_PREFIX = '005';

export type PermissionExportRow = Record<string, unknown>;

export interface PermissionExportBundle {
  permissionSets: PermissionExportRow[];
  permissionSetAssignments: PermissionExportRow[];
  permissionSetGroups: PermissionExportRow[];
  permissionSetGroupComponents: PermissionExportRow[];
  mutingPermissionSets: PermissionExportRow[];
  objectPermissions: PermissionExportRow[];
  fieldPermissions: PermissionExportRow[];
  permissionSetTabSettings: PermissionExportRow[];
}

/** Describe + EntityDefinition metadata for permission export SobjectType cells. */
export interface SobjectExportDetail {
  apiName: string;
  label: string;
  description: string | null;
}

export function collectSobjectApiNamesFromPermissionExport(exportBundle: PermissionExportBundle): string[] {
  const names = new Set<string>();
  for (const row of exportBundle.objectPermissions) {
    const value = row.SobjectType;
    if (typeof value === 'string' && value.trim().length > 0) {
      names.add(value.trim());
    }
  }
  for (const row of exportBundle.fieldPermissions) {
    const value = row.SobjectType;
    if (typeof value === 'string' && value.trim().length > 0) {
      names.add(value.trim());
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export interface ParsedPermissionExportResult {
  phase: string | null;
  summary: string | null;
  truncated: boolean;
  counts: Record<string, number>;
  export: PermissionExportBundle;
  findings: PermissionAnalysisFinding[];
  issueCodeSummary: Record<string, unknown> | null;
}

export interface PermissionAnalysisFinding {
  severity?: string;
  code?: string;
  message?: string;
  objectApiName?: string;
  fieldApiName?: string;
  permissionSetId?: string;
  parentId?: string;
  containerId?: string;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function stringIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((id): id is string => typeof id === 'string');
}

/**
 * IDs from the job's `requestPayload` (see permission export analysis jobs).
 * `profileIds` are the profile **PermissionSet** Ids chosen on the selection screen, not Profile Ids.
 */
export interface PermissionExportRequestScope {
  profilePermissionSetIds: string[];
  permissionSetIds: string[];
}

export function parsePermissionExportRequestScope(jobResult: unknown): PermissionExportRequestScope {
  const root = asRecord(jobResult);
  if (!root) {
    return { profilePermissionSetIds: [], permissionSetIds: [] };
  }
  const payload = asRecord(root.requestPayload);
  if (!payload) {
    return { profilePermissionSetIds: [], permissionSetIds: [] };
  }
  return {
    profilePermissionSetIds: stringIdArray(payload.profileIds),
    permissionSetIds: stringIdArray(payload.permissionSetIds),
  };
}

export function filterPermissionSetExportRowsById(
  rows: PermissionExportRow[],
  permissionSetIds: ReadonlySet<string>,
): PermissionExportRow[] {
  if (permissionSetIds.size === 0) {
    return [];
  }
  return rows.filter((row) => typeof row.Id === 'string' && permissionSetIds.has(row.Id));
}

function asRowArray(value: unknown): PermissionExportRow[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((row): row is PermissionExportRow => row !== null && typeof row === 'object' && !Array.isArray(row));
}

/**
 * Normalizes `analysis_job.result` JSON for permission export jobs.
 */
export function parsePermissionExportResult(jobResult: unknown): ParsedPermissionExportResult | null {
  const root = asRecord(jobResult);
  if (!root) {
    return null;
  }

  const exportBlock = asRecord(root.export);
  if (!exportBlock) {
    return null;
  }

  const countsRaw = asRecord(root.counts);
  const counts: Record<string, number> = {};
  if (countsRaw) {
    for (const [key, value] of Object.entries(countsRaw)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        counts[key] = value;
      }
    }
  }

  const findingsRaw = root.findings;
  const findings: PermissionAnalysisFinding[] = Array.isArray(findingsRaw)
    ? findingsRaw.filter((item): item is PermissionAnalysisFinding => item !== null && typeof item === 'object')
    : [];

  return {
    phase: root.phase != null ? String(root.phase) : null,
    summary: root.summary != null ? String(root.summary) : null,
    truncated: Boolean(root.truncated),
    counts,
    export: {
      permissionSets: asRowArray(exportBlock.permissionSets),
      permissionSetAssignments: asRowArray(exportBlock.permissionSetAssignments),
      permissionSetGroups: asRowArray(exportBlock.permissionSetGroups),
      permissionSetGroupComponents: asRowArray(exportBlock.permissionSetGroupComponents),
      mutingPermissionSets: asRowArray(exportBlock.mutingPermissionSets),
      objectPermissions: asRowArray(exportBlock.objectPermissions),
      fieldPermissions: asRowArray(exportBlock.fieldPermissions),
      permissionSetTabSettings: asRowArray(exportBlock.permissionSetTabSettings),
    },
    findings,
    issueCodeSummary:
      root.issueCodeSummary != null && typeof root.issueCodeSummary === 'object' && !Array.isArray(root.issueCodeSummary)
        ? (root.issueCodeSummary as Record<string, unknown>)
        : null,
  };
}

const COLUMN_KEY_ORDER = ['Id', 'ParentId', 'PermissionSetId', 'PermissionSetGroupId', 'AssigneeId', 'SobjectType', 'Field'];

/** Column key order for export grids and the object-permissions tree (stable, readable columns). */
export function sortedExportColumnKeys(rows: PermissionExportRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }
  const ordered: string[] = [];
  for (const preferred of COLUMN_KEY_ORDER) {
    if (keys.has(preferred)) {
      ordered.push(preferred);
    }
  }
  const rest = [...keys].filter((key) => !COLUMN_KEY_ORDER.includes(key)).sort((a, b) => a.localeCompare(b));
  ordered.push(...rest);
  return ordered;
}

/**
 * Salesforce `ObjectPermissions` API fields in grid order: Create, Read, Edit, Delete,
 * View All Records, Modify All Records, View All Fields.
 */
export const OBJECT_PERMISSION_COLUMN_KEY_ORDER = [
  'PermissionsCreate',
  'PermissionsRead',
  'PermissionsEdit',
  'PermissionsDelete',
  'PermissionsViewAllRecords',
  'PermissionsModifyAllRecords',
  'PermissionsViewAllFields',
] as const;

function isObjectPermissionsExportSample(sample: PermissionExportRow): boolean {
  return 'PermissionsDelete' in sample;
}

/**
 * `Permissions*` keys present on rows, in {@link OBJECT_PERMISSION_COLUMN_KEY_ORDER}, then any extras (sorted).
 */
export function sortedObjectPermissionBooleanKeys(rows: PermissionExportRow[]): string[] {
  if (!rows.length) {
    return [];
  }
  const keySet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key.startsWith('Permissions')) {
        keySet.add(key);
      }
    }
  }
  const orderSet = new Set<string>(OBJECT_PERMISSION_COLUMN_KEY_ORDER);
  const primary = OBJECT_PERMISSION_COLUMN_KEY_ORDER.filter((key) => keySet.has(key));
  const rest = [...keySet].filter((key) => !orderSet.has(key)).sort((a, b) => a.localeCompare(b));
  return [...primary, ...rest];
}

/** Reorders a full export key list so `Permissions*` on object-permission rows follow {@link OBJECT_PERMISSION_COLUMN_KEY_ORDER}. */
export function reorderExportKeysForObjectPermissions(keys: string[]): string[] {
  const nonPerm = keys.filter((key) => !key.startsWith('Permissions'));
  const perm = keys.filter((key) => key.startsWith('Permissions'));
  const orderSet = new Set<string>(OBJECT_PERMISSION_COLUMN_KEY_ORDER);
  const primary = OBJECT_PERMISSION_COLUMN_KEY_ORDER.filter((key) => perm.includes(key));
  const rest = perm.filter((key) => !orderSet.has(key)).sort((a, b) => a.localeCompare(b));
  return [...nonPerm, ...primary, ...rest];
}

/** Split PascalCase API suffixes into spaced words for column titles (e.g. `ViewAllRecords` → "View All Records"). */
function splitPascalCaseToTitle(pascal: string): string {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

/**
 * Human-readable DataTable header for export SOQL field names.
 * Salesforce object/field permission booleans use `PermissionsRead`, `PermissionsEdit`, etc.; show "Read", "Edit", …
 *
 * @param fieldKey API field name from a row key.
 * @returns Label for the column header; `fieldKey` unchanged when not a `Permissions*` column.
 */
// Default boolean columns use a narrow width; OLS/FLS permission headers need more room (react-data-grid width/minWidth).
const PERMISSIONS_COLUMN_MIN_WIDTH_PX = 200;
const PERMISSIONS_COLUMN_HEADER_CHAR_PX = 9;
const PERMISSIONS_COLUMN_HEADER_PADDING_PX = 48;

function permissionsColumnWidthForLabel(headerLabel: string): number {
  const fromLabel = Math.ceil(headerLabel.length * PERMISSIONS_COLUMN_HEADER_CHAR_PX + PERMISSIONS_COLUMN_HEADER_PADDING_PX);
  return Math.max(PERMISSIONS_COLUMN_MIN_WIDTH_PX, fromLabel);
}

export function getExportColumnHeaderLabel(fieldKey: string): string {
  if (fieldKey === 'SobjectType') {
    return 'Object';
  }
  if (!fieldKey.startsWith('Permissions')) {
    return fieldKey;
  }
  const suffix = fieldKey.slice('Permissions'.length);
  if (!suffix) {
    return fieldKey;
  }
  const explicitLabels: Record<string, string> = {
    Read: 'Read',
    Create: 'Create',
    Edit: 'Edit',
    Delete: 'Delete',
    ViewAllRecords: 'View All Records',
    ModifyAllRecords: 'Modify All Records',
    ViewAllFields: 'View All Fields',
  };
  if (explicitLabels[suffix]) {
    return explicitLabels[suffix];
  }
  return splitPascalCaseToTitle(suffix);
}

export interface BuildDynamicExportColumnsOptions {
  /** Row keys to exclude from the grid (e.g. REST `attributes`, `Id`, `ParentId` on object permission rows). */
  omitColumnKeys?: ReadonlySet<string>;
}

/**
 * Builds read-only DataTable columns from heterogeneous SOQL rows (first row drives types).
 */
export function buildDynamicExportColumns(
  rows: PermissionExportRow[],
  options?: BuildDynamicExportColumnsOptions,
): ColumnWithFilter<RowWithKey>[] {
  if (!rows.length) {
    return [];
  }
  const omit = options?.omitColumnKeys ?? new Set<string>();
  let keys = sortedExportColumnKeys(rows).filter((key) => !omit.has(key));
  const firstRow = rows[0];
  if (isObjectPermissionsExportSample(firstRow)) {
    keys = reorderExportKeysForObjectPermissions(keys);
  }
  return keys.map((key) => {
    const fieldType = key === 'Id' || key === 'ParentId' || key.endsWith('Id') ? 'salesforceId' : getRowTypeFromValue(firstRow[key], false);
    const base = setColumnFromType(key, fieldType);
    const headerLabel = getExportColumnHeaderLabel(key);
    const permissionsWidthPx = key.startsWith('Permissions') ? permissionsColumnWidthForLabel(headerLabel) : undefined;
    return {
      ...base,
      name: headerLabel,
      key,
      field: key,
      resizable: true,
      ...(permissionsWidthPx !== undefined ? { width: permissionsWidthPx, minWidth: permissionsWidthPx } : {}),
    } as ColumnWithFilter<RowWithKey>;
  });
}

/**
 * Permission sets that have at least one direct assignment to a User (`AssigneeId` prefix `005`).
 */
export function getPermissionSetIdsWithDirectUserAssignment(assignments: PermissionExportRow[]): Set<string> {
  const result = new Set<string>();
  for (const row of assignments) {
    const permissionSetId = row.PermissionSetId;
    const assigneeId = row.AssigneeId;
    if (typeof permissionSetId !== 'string' || typeof assigneeId !== 'string') {
      continue;
    }
    if (assigneeId.startsWith(USER_ID_PREFIX)) {
      result.add(permissionSetId);
    }
  }
  return result;
}

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
 * Object-permission grid column keys highlighted for a given finding `code` (empty when none).
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
 * Findings that contribute to highlighting this leaf row cell on the Object Permissions tree.
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
 * should be highlighted on the Object Permissions tree from analysis findings.
 *
 * @param findings Parsed `analysis_job.result.findings` (same list as the Issues tab).
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
 * Splits a finding `code` into a user-facing title vs optional technical identifier.
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

function isErrorLikeSeverity(value: unknown): boolean {
  const normalized = String(value ?? '').toLowerCase();
  return normalized === 'error' || normalized === 'errors';
}

function isWarningLikeSeverity(value: unknown): boolean {
  const normalized = String(value ?? '').toLowerCase();
  return normalized === 'warning' || normalized === 'warnings';
}

/**
 * Rolls up the current finding list for summary tiles (Phase B — respects the same rows as the Issues grid filters).
 */
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

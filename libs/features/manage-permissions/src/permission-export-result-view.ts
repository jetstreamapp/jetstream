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

/** Object column copy in finding modals when describe metadata exists. */
export function formatObjectLabelForModalSummary(
  apiName: string,
  sobjectExportDetails: Record<string, SobjectExportDetail> | undefined,
): { displayLabel: string; showApiInParens: boolean } {
  const api = apiName.trim();
  if (!api) {
    return { displayLabel: '', showApiInParens: false };
  }
  const metadataLabel = sobjectExportDetails?.[api]?.label?.trim();
  if (metadataLabel && metadataLabel !== api) {
    return { displayLabel: metadataLabel, showApiInParens: true };
  }
  return { displayLabel: api, showApiInParens: false };
}

function permissionSetExportRowLabel(row: PermissionExportRow): string {
  const label = typeof row.Label === 'string' && row.Label.trim() ? row.Label.trim() : null;
  const name = typeof row.Name === 'string' && row.Name.trim() ? row.Name.trim() : null;
  const profileBlock = row.Profile;
  const profileName =
    profileBlock &&
    typeof profileBlock === 'object' &&
    profileBlock !== null &&
    typeof (profileBlock as { Name?: unknown }).Name === 'string'
      ? String((profileBlock as { Name: string }).Name).trim()
      : null;
  const isProfile = row.IsOwnedByProfile === true;
  if (isProfile && profileName) {
    return `Profile: ${profileName}`;
  }
  return label ?? name ?? (typeof row.Id === 'string' ? row.Id : 'Permission set');
}

/** Map permission set `Id` to a short display label (profiles, permission sets tab, modals). */
export function buildPermissionSetIdLabelMap(permissionSetRows: PermissionExportRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of permissionSetRows) {
    const id = row.Id;
    if (typeof id !== 'string' || id.trim().length === 0) {
      continue;
    }
    map.set(id.trim(), permissionSetExportRowLabel(row));
  }
  return map;
}

function isProfileOwnedPermissionSetRow(row: PermissionExportRow | undefined): boolean {
  return row?.IsOwnedByProfile === true;
}

/**
 * Sorts `ObjectPermissions` export rows for the analysis tree: profile-owned parents first (label order),
 * then other permission sets (label order), then rows for the same parent by object label (metadata label
 * when {@link sobjectExportDetails} has it, else `SobjectType` API name).
 */
export function sortObjectPermissionExportRowsForAnalysisTree(
  objectPermissionRows: PermissionExportRow[],
  permissionSetRows: PermissionExportRow[],
  sobjectExportDetails?: Readonly<Record<string, SobjectExportDetail>>,
): PermissionExportRow[] {
  const labelByParentId = buildPermissionSetIdLabelMap(permissionSetRows);
  const permissionSetById = new Map<string, PermissionExportRow>();
  for (const row of permissionSetRows) {
    const id = typeof row.Id === 'string' ? row.Id.trim() : '';
    if (id) {
      permissionSetById.set(id, row);
    }
  }

  function parentTier(parentId: string): number {
    if (!parentId) {
      return 2;
    }
    return isProfileOwnedPermissionSetRow(permissionSetById.get(parentId)) ? 0 : 1;
  }

  function parentLabelCompareKey(parentId: string): string {
    return labelByParentId.get(parentId) ?? parentId;
  }

  function objectSortCompareKey(sobjectType: string): string {
    const api = sobjectType.trim();
    if (!api) {
      return '';
    }
    const detail = sobjectExportDetails?.[api];
    const label = detail?.label?.trim() ? detail.label.trim() : api;
    const primary = label.toLocaleLowerCase();
    const secondary = api.toLocaleLowerCase();
    return `${primary}\0${secondary}`;
  }

  return [...objectPermissionRows].sort((rowA, rowB) => {
    const parentA = typeof rowA.ParentId === 'string' ? rowA.ParentId.trim() : '';
    const parentB = typeof rowB.ParentId === 'string' ? rowB.ParentId.trim() : '';
    if (parentA !== parentB) {
      const tierA = parentTier(parentA);
      const tierB = parentTier(parentB);
      if (tierA !== tierB) {
        return tierA - tierB;
      }
      const labelCmp = parentLabelCompareKey(parentA).localeCompare(parentLabelCompareKey(parentB), undefined, {
        sensitivity: 'base',
      });
      if (labelCmp !== 0) {
        return labelCmp;
      }
      return parentA.localeCompare(parentB, undefined, { sensitivity: 'base' });
    }
    const objA = typeof rowA.SobjectType === 'string' ? rowA.SobjectType.trim() : '';
    const objB = typeof rowB.SobjectType === 'string' ? rowB.SobjectType.trim() : '';
    return objectSortCompareKey(objA).localeCompare(objectSortCompareKey(objB), undefined, { sensitivity: 'base' });
  });
}

/**
 * User-facing copy for `PermissionSetTabSetting.Visibility` on analysis grids.
 */
export function formatTabSettingVisibilityDisplay(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === 'DefaultOn') {
    return 'Visible';
  }
  if (raw === 'DefaultOff') {
    return 'Hidden';
  }
  if (raw.length === 0) {
    return '—';
  }
  return raw;
}

/**
 * Sorts `PermissionSetTabSetting` export rows for the analysis tree: profile-owned parents first (label order),
 * then other permission sets (label order), then by tab display label (or {@link Name}) within the same {@link ParentId}.
 *
 * @param tabLabelBySettingName Optional `TabDefinition.Name` → `Label` map from Tooling (enriches sort when loaded).
 */
export function sortTabSettingExportRowsForAnalysisTree(
  tabSettingRows: PermissionExportRow[],
  permissionSetRows: PermissionExportRow[],
  tabLabelBySettingName?: ReadonlyMap<string, string>,
): PermissionExportRow[] {
  const labelByParentId = buildPermissionSetIdLabelMap(permissionSetRows);
  const permissionSetById = new Map<string, PermissionExportRow>();
  for (const row of permissionSetRows) {
    const id = typeof row.Id === 'string' ? row.Id.trim() : '';
    if (id) {
      permissionSetById.set(id, row);
    }
  }

  function parentTier(parentId: string): number {
    if (!parentId) {
      return 2;
    }
    return isProfileOwnedPermissionSetRow(permissionSetById.get(parentId)) ? 0 : 1;
  }

  function parentLabelCompareKey(parentId: string): string {
    return labelByParentId.get(parentId) ?? parentId;
  }

  function tabSortCompareKey(row: PermissionExportRow): string {
    const name = typeof row.Name === 'string' ? row.Name.trim() : '';
    const label = tabLabelBySettingName?.get(name)?.trim();
    const primary = (label && label.length > 0 ? label : name).toLocaleLowerCase();
    const secondary = name.toLocaleLowerCase();
    return `${primary}\0${secondary}`;
  }

  return [...tabSettingRows].sort((rowA, rowB) => {
    const parentA = typeof rowA.ParentId === 'string' ? rowA.ParentId.trim() : '';
    const parentB = typeof rowB.ParentId === 'string' ? rowB.ParentId.trim() : '';
    if (parentA !== parentB) {
      const tierA = parentTier(parentA);
      const tierB = parentTier(parentB);
      if (tierA !== tierB) {
        return tierA - tierB;
      }
      const labelCmp = parentLabelCompareKey(parentA).localeCompare(parentLabelCompareKey(parentB), undefined, {
        sensitivity: 'base',
      });
      if (labelCmp !== 0) {
        return labelCmp;
      }
      return parentA.localeCompare(parentB, undefined, { sensitivity: 'base' });
    }
    const keyA = tabSortCompareKey(rowA);
    const keyB = tabSortCompareKey(rowB);
    return keyA.localeCompare(keyB, undefined, { sensitivity: 'base' });
  });
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

/**
 * Unique tab API names from `PermissionSetTabSetting` rows (for Tooling `TabDefinition` enrichment).
 */
export function collectTabSettingNamesFromPermissionExport(exportBundle: PermissionExportBundle): string[] {
  const names = new Set<string>();
  for (const row of exportBundle.permissionSetTabSettings) {
    const value = row.Name;
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
  if (fieldKey === 'CreatedDate') {
    return 'Created Date';
  }
  if (fieldKey === 'LastModifiedDate') {
    return 'Last Modified Date';
  }
  if (fieldKey === 'CreatedBy') {
    return 'Created By';
  }
  if (fieldKey === 'LastModifiedBy') {
    return 'Last Modified By';
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
 * User Ids (`005…`) assigned to each permission set Id, deduped and sorted (for the Permission Sets tab).
 */
export function buildPermissionSetAssigneeIdsByPermissionSetId(assignments: PermissionExportRow[]): Map<string, string[]> {
  const idSets = new Map<string, Set<string>>();
  for (const row of assignments) {
    const permissionSetId = row.PermissionSetId;
    const assigneeId = row.AssigneeId;
    if (typeof permissionSetId !== 'string' || typeof assigneeId !== 'string') {
      continue;
    }
    const trimmedPermissionSetId = permissionSetId.trim();
    const trimmedAssigneeId = assigneeId.trim();
    if (!trimmedPermissionSetId || !trimmedAssigneeId.startsWith(USER_ID_PREFIX)) {
      continue;
    }
    let assigneeSet = idSets.get(trimmedPermissionSetId);
    if (!assigneeSet) {
      assigneeSet = new Set();
      idSets.set(trimmedPermissionSetId, assigneeSet);
    }
    assigneeSet.add(trimmedAssigneeId);
  }
  const result = new Map<string, string[]>();
  for (const [permissionSetId, assigneeSet] of idSets) {
    result.set(
      permissionSetId,
      [...assigneeSet].sort((a, b) => a.localeCompare(b)),
    );
  }
  return result;
}

/** Leaf rows for the Permission Sets analysis tree (user assignment or “no users” placeholder). */
export type PermissionSetAssignmentsTreeRow = PermissionExportRow & {
  _treePermissionSetGroupKey: string;
  /** Present on a synthetic leaf when there are no direct user (`005…`) assignments. */
  _noDirectUserAssignments?: boolean;
};

/** User-assignment leaf (excludes the “no direct user assignments” placeholder row). */
export type PermissionSetAssignmentsTreeUserLeafRow = PermissionSetAssignmentsTreeRow & {
  AssigneeId: string;
};

/**
 * Builds flat rows for a tree grouped by permission set Id: one leaf per assigned user, or one placeholder leaf.
 * Permission sets are ordered alphabetically by the same display label as {@link buildPermissionSetIdLabelMap}.
 */
export function buildPermissionSetAssignmentsTreeRows(
  permissionSetRows: PermissionExportRow[],
  assignments: PermissionExportRow[],
): PermissionSetAssignmentsTreeRow[] {
  const labelByPermissionSetId = buildPermissionSetIdLabelMap(permissionSetRows);
  const permissionSetRowsAlphabetical = [...permissionSetRows].sort((a, b) => {
    const idA = typeof a.Id === 'string' ? a.Id.trim() : '';
    const idB = typeof b.Id === 'string' ? b.Id.trim() : '';
    const labelA = idA ? (labelByPermissionSetId.get(idA) ?? idA) : '';
    const labelB = idB ? (labelByPermissionSetId.get(idB) ?? idB) : '';
    return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
  });
  const userIdsBySetId = buildPermissionSetAssigneeIdsByPermissionSetId(assignments);
  const result: PermissionSetAssignmentsTreeRow[] = [];
  for (const permSetRow of permissionSetRowsAlphabetical) {
    const id = typeof permSetRow.Id === 'string' ? permSetRow.Id.trim() : '';
    if (!id) {
      continue;
    }
    const userIds = userIdsBySetId.get(id) ?? [];
    if (userIds.length === 0) {
      result.push({
        _treePermissionSetGroupKey: id,
        _noDirectUserAssignments: true,
        Id: `__no_users__${id}`,
      });
    } else {
      for (const assigneeId of userIds) {
        result.push({
          _treePermissionSetGroupKey: id,
          PermissionSetId: id,
          AssigneeId: assigneeId,
          Id: `__user__${id}__${assigneeId}`,
        });
      }
    }
  }
  return result;
}

export function isPermissionSetAssignmentsTreeUserLeaf(row: unknown): row is PermissionSetAssignmentsTreeUserLeafRow {
  if (row === null || typeof row !== 'object') {
    return false;
  }
  const record = row as PermissionSetAssignmentsTreeRow;
  if (record._noDirectUserAssignments === true) {
    return false;
  }
  const assigneeId = record.AssigneeId;
  return typeof assigneeId === 'string' && assigneeId.startsWith(USER_ID_PREFIX);
}

export function isPermissionSetAssignmentsTreePlaceholderLeaf(row: unknown): row is PermissionSetAssignmentsTreeRow {
  if (row === null || typeof row !== 'object') {
    return false;
  }
  return (row as PermissionSetAssignmentsTreeRow)._noDirectUserAssignments === true;
}

/** Leaf kinds for the Assignments tab tree (grouped by user). */
export type UserAssignmentTreeLeafKind = 'permission_set' | 'permission_set_group' | 'profile' | 'permission_set_license';

/** One permission set license row for {@link buildUserAssignmentsTreeRows}. */
export interface UserLicenseLeafRecord {
  permissionSetLicenseId: string;
  label: string;
}

/** Flat row for a tree grouped by Salesforce User Id (`005…`). */
export type UserAssignmentsTreeRow = {
  Id: string;
  _treeUserGroupKey: string;
  _leafKind: UserAssignmentTreeLeafKind;
  /** Permission set Id when `_leafKind` is `permission_set`. */
  _permissionSetId?: string;
  /** Permission set group Id when `_leafKind` is `permission_set_group`. */
  _permissionSetGroupId?: string;
  /** Profile Id when `_leafKind` is `profile` (optional until enriched from `User`). */
  _profileId?: string;
  /** Permission Set License definition Id when `_leafKind` is `permission_set_license`. */
  _permissionSetLicenseId?: string;
  /** Display label for `permission_set_license` leaves. */
  _licenseLabel?: string;
};

export function buildPermissionSetGroupLabelMap(groups: PermissionExportRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of groups) {
    const id = typeof row.Id === 'string' ? row.Id.trim() : '';
    if (!id) {
      continue;
    }
    const masterLabel = typeof row.MasterLabel === 'string' && row.MasterLabel.trim() ? row.MasterLabel.trim() : '';
    const developerName = typeof row.DeveloperName === 'string' && row.DeveloperName.trim() ? row.DeveloperName.trim() : '';
    map.set(id, masterLabel || developerName || id);
  }
  return map;
}

export function buildPermissionSetIdToGroupIdsMap(components: PermissionExportRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of components) {
    const permissionSetId = typeof row.PermissionSetId === 'string' ? row.PermissionSetId.trim() : '';
    const groupId = typeof row.PermissionSetGroupId === 'string' ? row.PermissionSetGroupId.trim() : '';
    if (!permissionSetId || !groupId) {
      continue;
    }
    let groupSet = map.get(permissionSetId);
    if (!groupSet) {
      groupSet = new Set();
      map.set(permissionSetId, groupSet);
    }
    groupSet.add(groupId);
  }
  return map;
}

function buildUserIdToAssignedPermissionSetIds(assignments: PermissionExportRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of assignments) {
    const assigneeId = row.AssigneeId;
    const permissionSetId = row.PermissionSetId;
    if (typeof assigneeId !== 'string' || typeof permissionSetId !== 'string') {
      continue;
    }
    const trimmedUserId = assigneeId.trim();
    const trimmedPermissionSetId = permissionSetId.trim();
    if (!trimmedUserId.startsWith(USER_ID_PREFIX) || !trimmedPermissionSetId) {
      continue;
    }
    let permissionSetSet = map.get(trimmedUserId);
    if (!permissionSetSet) {
      permissionSetSet = new Set();
      map.set(trimmedUserId, permissionSetSet);
    }
    permissionSetSet.add(trimmedPermissionSetId);
  }
  return map;
}

/**
 * Builds flat rows for the Assignments analysis tree: group = user, leaves = profile first, then permission sets
 * (alphabetically by display label), then permission set groups, then permission set licenses (per user). Users are
 * ordered by `userId` here; use {@link sortUserAssignmentsTreeRowsByUserDisplay} after loading display names.
 */
export function buildUserAssignmentsTreeRows(options: {
  assignments: PermissionExportRow[];
  permissionSets: PermissionExportRow[];
  groupComponents: PermissionExportRow[];
  groups: PermissionExportRow[];
  licensesByUserId?: ReadonlyMap<string, readonly UserLicenseLeafRecord[]>;
}): UserAssignmentsTreeRow[] {
  const { assignments, permissionSets, groupComponents, groups, licensesByUserId = new Map() } = options;
  const labelByPermissionSetId = buildPermissionSetIdLabelMap(permissionSets);
  const labelByGroupId = buildPermissionSetGroupLabelMap(groups);
  const permissionSetIdToGroupIds = buildPermissionSetIdToGroupIdsMap(groupComponents);
  const userToPermissionSetIds = buildUserIdToAssignedPermissionSetIds(assignments);

  const userIds = [...userToPermissionSetIds.keys()].sort((a, b) => a.localeCompare(b));
  const result: UserAssignmentsTreeRow[] = [];

  for (const userId of userIds) {
    const permissionSetIds = [...(userToPermissionSetIds.get(userId) ?? [])].sort((firstId, secondId) => {
      const labelA = labelByPermissionSetId.get(firstId) ?? firstId;
      const labelB = labelByPermissionSetId.get(secondId) ?? secondId;
      return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
    });

    result.push({
      Id: `__profile__${userId}`,
      _treeUserGroupKey: userId,
      _leafKind: 'profile',
    });

    for (const permissionSetId of permissionSetIds) {
      result.push({
        Id: `__ps__${userId}__${permissionSetId}`,
        _treeUserGroupKey: userId,
        _leafKind: 'permission_set',
        _permissionSetId: permissionSetId,
      });
    }

    const groupIdsForUser = new Set<string>();
    for (const permissionSetId of permissionSetIds) {
      for (const groupId of permissionSetIdToGroupIds.get(permissionSetId) ?? []) {
        groupIdsForUser.add(groupId);
      }
    }
    const sortedGroupIds = [...groupIdsForUser].sort((firstId, secondId) => {
      const labelA = labelByGroupId.get(firstId) ?? firstId;
      const labelB = labelByGroupId.get(secondId) ?? secondId;
      return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
    });
    for (const groupId of sortedGroupIds) {
      result.push({
        Id: `__psg__${userId}__${groupId}`,
        _treeUserGroupKey: userId,
        _leafKind: 'permission_set_group',
        _permissionSetGroupId: groupId,
      });
    }

    const licenseRecords = licensesByUserId.get(userId) ?? [];
    const sortedLicenses = [...licenseRecords].sort((first, second) =>
      first.label.localeCompare(second.label, undefined, { sensitivity: 'base' }),
    );
    for (const license of sortedLicenses) {
      result.push({
        Id: `__psl__${userId}__${license.permissionSetLicenseId}`,
        _treeUserGroupKey: userId,
        _leafKind: 'permission_set_license',
        _permissionSetLicenseId: license.permissionSetLicenseId,
        _licenseLabel: license.label,
      });
    }
  }

  return result;
}

/**
 * Reorders {@link UserAssignmentsTreeRow} blocks so users appear alphabetically by display label.
 */
export function sortUserAssignmentsTreeRowsByUserDisplay(
  rows: UserAssignmentsTreeRow[],
  displayLabelByUserId: ReadonlyMap<string, string>,
): UserAssignmentsTreeRow[] {
  const rowsByUserId = new Map<string, UserAssignmentsTreeRow[]>();
  for (const row of rows) {
    const userId = row._treeUserGroupKey;
    const list = rowsByUserId.get(userId) ?? [];
    list.push(row);
    rowsByUserId.set(userId, list);
  }
  const sortedUserIds = [...rowsByUserId.keys()].sort((a, b) => {
    const labelA = displayLabelByUserId.get(a) ?? a;
    const labelB = displayLabelByUserId.get(b) ?? b;
    return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
  });
  const output: UserAssignmentsTreeRow[] = [];
  for (const userId of sortedUserIds) {
    output.push(...(rowsByUserId.get(userId) ?? []));
  }
  return output;
}

export function isUserAssignmentsTreePermissionSetLeaf(
  row: unknown,
): row is UserAssignmentsTreeRow & { _leafKind: 'permission_set'; _permissionSetId: string } {
  if (row === null || typeof row !== 'object') {
    return false;
  }
  const record = row as UserAssignmentsTreeRow;
  return record._leafKind === 'permission_set' && typeof record._permissionSetId === 'string' && record._permissionSetId.trim().length > 0;
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

/**
 * Sentinel field segment for {@link fieldPermissionFindingRowKey} when a finding applies to every
 * field-permission row for the same permission set + object (e.g. {@link PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW}).
 */
export const FIELD_PERMISSION_OBJECT_SCOPE_MARKER = '__FIELD_PERM_OBJECT_SCOPE__';

/** Row key for field-permission export highlights (`ParentId::SobjectType::Field` or scope marker). */
export function fieldPermissionFindingRowKey(parentId: string, objectApiName: string, fieldSegment: string): string {
  return `${parentId.trim()}::${objectApiName.trim()}::${fieldSegment.trim()}`;
}

/**
 * Field-permission grid column keys highlighted for a given finding `code` (empty when none on this surface).
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
    return ['Field', 'SobjectType'];
  }
  return [];
}

function severityForFieldPermissionFindingCode(code: string): PermissionObjectFindingCellSeverity | null {
  return severityForObjectPermissionFindingCode(code);
}

/**
 * Findings that highlight this field-permission export cell (same `ParentId` / `SobjectType` / `Field` row).
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
 * Maps field-permission export rows to cells that should highlight from analysis findings.
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
    const def = getPermissionExportFindingDefinition(codeRaw);
    if (!def) {
      continue;
    }
    const next: PermissionObjectFindingCellSeverity = def.severity === 'error' ? 'error' : 'warning';
    const existing = result.get(containerId);
    const merged: PermissionObjectFindingCellSeverity = existing === 'error' || next === 'error' ? 'error' : next;
    result.set(containerId, merged);
  }
  return result;
}

/**
 * All findings for a permission-set container (same list as Issues tab), excluding truncation rows.
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

/** Column keys on permission-set export rows that open the container findings modal (first match wins). */
export function pickPermissionSetExportClickableColumnKeys(sample: PermissionExportRow): string[] {
  const preferred = ['Label', 'Name', 'MasterLabel', 'DeveloperName', 'Profile', 'Id'] as const;
  return preferred.filter((key) => key in sample);
}

/** Column keys on assignment rows that open findings for the related permission set. */
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

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

/** Tooling `FieldDefinition` metadata for permission export field cells (label, setup link). */
export interface FieldExportDetail {
  objectApiName: string;
  qualifiedApiName: string;
  label: string;
  description: string | null;
  /** Tooling `FieldDefinition.DurableId` for Lightning Fields & Relationships deep link when present. */
  durableId: string | null;
}

/**
 * Stable lookup key for {@link FieldExportDetail} maps: `objectApiName::qualifiedApiName` (short field API name).
 */
export function fieldExportDetailLookupKey(objectApiName: string, qualifiedApiName: string): string {
  return `${objectApiName.trim()}::${qualifiedApiName.trim()}`;
}

/**
 * Short field API name from a `FieldPermissions` export row (`Field` is usually `ObjectApi.FieldApi`).
 */
export function fieldPermissionQualifiedFieldShortApi(row: PermissionExportRow): string {
  const obj = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
  const full = typeof row.Field === 'string' ? row.Field.trim() : '';
  if (!obj || !full) {
    return '';
  }
  const prefix = `${obj}.`;
  if (full.startsWith(prefix)) {
    return full.slice(prefix.length);
  }
  const dot = full.lastIndexOf('.');
  return dot >= 0 ? full.slice(dot + 1) : full;
}

/** Field-level permission booleans in the same order as the object-permissions subset (Read, Edit). */
export const FIELD_PERMISSION_BOOLEAN_COLUMN_KEYS: readonly string[] = ['PermissionsRead', 'PermissionsEdit'];

/** Object column copy in issue detail modals when describe metadata exists. */
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

export interface ParsedPermissionExportResult {
  phase: string | null;
  summary: string | null;
  truncated: boolean;
  counts: Record<string, number>;
  export: PermissionExportBundle;
  findings: PermissionAnalysisFinding[];
  issueCodeSummary: Record<string, unknown> | null;
}

/**
 * IDs from the job's `requestPayload` (see permission export analysis jobs).
 * `profileIds` are the profile **PermissionSet** Ids chosen on the selection screen, not Profile Ids.
 */
export interface PermissionExportRequestScope {
  profilePermissionSetIds: string[];
  permissionSetIds: string[];
  /** When non-empty, the export job limited ObjectPermissions / FieldPermissions rows to these `SobjectType` values. */
  objectApiNames: string[];
}

export interface BuildDynamicExportColumnsOptions {
  /** Row keys to exclude from the grid (e.g. REST `attributes`, `Id`, `ParentId` on object permission rows). */
  omitColumnKeys?: ReadonlySet<string>;
}

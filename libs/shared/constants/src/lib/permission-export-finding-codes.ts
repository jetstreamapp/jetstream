/**
 * Permission export analysis issue codes and severities (shared by the analysis job runner and UI).
 *
 * Severity model (2-tier, intentionally — the issues UI counts only error/warning):
 * - `error`   = EXPOSURE: real over-access a user can exploit (Modify All Records, Modify All Data, …).
 * - `warning` = INCONSISTENCY / DEAD-CONFIG / INCOMPLETE-SETUP / CLEANUP. Visible but not alarming.
 *
 * Note: field-level access that the object can never satisfy (FLS without OLS) is INERT — Salesforce
 * silently ignores it — so it is a `warning`, not an `error`. Errors are reserved for true exposure.
 */

export const PermissionExportFindingSeverity = {
  Error: 'error',
  Warning: 'warning',
} as const;

export type PermissionExportFindingSeverityValue = (typeof PermissionExportFindingSeverity)[keyof typeof PermissionExportFindingSeverity];

/**
 * Stored on each analysis row as `code` and referenced by `issueCodeSummary` keys.
 */
export const PermissionExportFindingCode = {
  // Inert / inconsistency (warning) — field access the object can't satisfy.
  FLS_EDIT_NO_OBJECT_EDIT: 'FLS_EDIT_NO_OBJECT_EDIT',
  FLS_READ_NO_OBJECT_READ: 'FLS_READ_NO_OBJECT_READ',
  FLS_WITHOUT_OLS_ROW: 'FLS_WITHOUT_OLS_ROW',
  // Incomplete setup (warning).
  OLS_READ_NO_FLS_ROWS: 'OLS_READ_NO_FLS_ROWS',
  OLS_EDIT_NO_FLS_ROWS: 'OLS_EDIT_NO_FLS_ROWS',
  // Exposure (error) / broad access (warning) — bypasses the sharing model for an object.
  OBJECT_MODIFY_ALL_RECORDS: 'OBJECT_MODIFY_ALL_RECORDS',
  OBJECT_VIEW_ALL_RECORDS: 'OBJECT_VIEW_ALL_RECORDS',
  // System permissions.
  SYSTEM_PERM_HIGH_RISK: 'SYSTEM_PERM_HIGH_RISK',
  SYSTEM_PERM_ELEVATED: 'SYSTEM_PERM_ELEVATED',
  // Cleanup / hygiene (warning).
  PERMSET_NO_ASSIGNMENTS: 'PERMSET_NO_ASSIGNMENTS',
  TAB_VISIBLE_NO_OBJECT_READ: 'TAB_VISIBLE_NO_OBJECT_READ',
  // Meta.
  FINDINGS_TRUNCATED: 'FINDINGS_TRUNCATED',
} as const;

export type PermissionExportFindingCodeValue = (typeof PermissionExportFindingCode)[keyof typeof PermissionExportFindingCode];

export type PermissionExportFindingDefinition = {
  readonly severity: PermissionExportFindingSeverityValue;
  /** Short label for Issue Codes / aggregated UI. */
  readonly label: string;
};

export const PERMISSION_EXPORT_FINDING_DEFINITIONS: Record<PermissionExportFindingCodeValue, PermissionExportFindingDefinition> = {
  [PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Field read granted, but the object grants no read — field access has no effect.',
  },
  [PermissionExportFindingCode.FLS_EDIT_NO_OBJECT_EDIT]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Field edit granted, but the object grants no edit — field access has no effect.',
  },
  [PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Field permissions exist for the object, but there is no object permissions row.',
  },
  [PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Object read granted with no field permissions configured (default field access applies).',
  },
  [PermissionExportFindingCode.OLS_EDIT_NO_FLS_ROWS]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Object edit granted with no field permissions configured (default field access applies).',
  },
  [PermissionExportFindingCode.OBJECT_MODIFY_ALL_RECORDS]: {
    severity: PermissionExportFindingSeverity.Error,
    label: 'Modify All Records — bypasses the sharing model (edit/delete every record) for this object.',
  },
  [PermissionExportFindingCode.OBJECT_VIEW_ALL_RECORDS]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'View All Records — bypasses the sharing model (read every record) for this object.',
  },
  [PermissionExportFindingCode.SYSTEM_PERM_HIGH_RISK]: {
    severity: PermissionExportFindingSeverity.Error,
    label: 'High-risk system permission granted.',
  },
  [PermissionExportFindingCode.SYSTEM_PERM_ELEVATED]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Elevated system permission granted.',
  },
  [PermissionExportFindingCode.PERMSET_NO_ASSIGNMENTS]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Permission set has no direct user assignments and is not part of a permission set group.',
  },
  [PermissionExportFindingCode.TAB_VISIBLE_NO_OBJECT_READ]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Tab is visible, but the permission set grants no read on the underlying object.',
  },
  [PermissionExportFindingCode.FINDINGS_TRUNCATED]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Additional issues were omitted to keep the export result size bounded.',
  },
};

export function isPermissionExportFindingCode(value: string): value is PermissionExportFindingCodeValue {
  return (Object.values(PermissionExportFindingCode) as readonly string[]).includes(value);
}

export function getPermissionExportFindingDefinition(code: string): PermissionExportFindingDefinition | undefined {
  return isPermissionExportFindingCode(code) ? PERMISSION_EXPORT_FINDING_DEFINITIONS[code] : undefined;
}

/**
 * Curated catalog of high-risk `PermissionSet.Permissions*` boolean fields surfaced as findings.
 *
 * Tier 1 → {@link PermissionExportFindingCode.SYSTEM_PERM_HIGH_RISK} (error): full data access / code authoring.
 * Tier 2/3 → {@link PermissionExportFindingCode.SYSTEM_PERM_ELEVATED} (warning): privilege escalation,
 * user/config control, and data egress.
 *
 * Shared by the PermissionSet SOQL builder (which columns to SELECT) and the findings builder.
 */
export interface HighRiskSystemPermission {
  /** `PermissionSet` boolean field API name. */
  readonly field: string;
  /** Human label for the finding message. */
  readonly label: string;
  readonly tier: 1 | 2 | 3;
}

export const HIGH_RISK_SYSTEM_PERMISSIONS: readonly HighRiskSystemPermission[] = [
  // Tier 1 — full data access / arbitrary code.
  { field: 'PermissionsModifyAllData', label: 'Modify All Data', tier: 1 },
  { field: 'PermissionsViewAllData', label: 'View All Data', tier: 1 },
  { field: 'PermissionsAuthorApex', label: 'Author Apex', tier: 1 },
  // Tier 2 — privilege escalation / user & config control.
  { field: 'PermissionsManageUsers', label: 'Manage Users', tier: 2 },
  { field: 'PermissionsManageInternalUsers', label: 'Manage Internal Users', tier: 2 },
  { field: 'PermissionsManageProfilesPermissionsets', label: 'Manage Profiles and Permission Sets', tier: 2 },
  { field: 'PermissionsAssignPermissionSets', label: 'Assign Permission Sets', tier: 2 },
  { field: 'PermissionsManageRoles', label: 'Manage Roles', tier: 2 },
  { field: 'PermissionsCustomizeApplication', label: 'Customize Application', tier: 2 },
  { field: 'PermissionsManageSharing', label: 'Manage Sharing', tier: 2 },
  // Tier 3 — data egress / setup visibility.
  { field: 'PermissionsExportReport', label: 'Export Reports', tier: 3 },
  { field: 'PermissionsApiEnabled', label: 'API Enabled', tier: 3 },
  { field: 'PermissionsViewAllUsers', label: 'View All Users', tier: 3 },
  { field: 'PermissionsManageDataIntegrations', label: 'Manage Data Integrations', tier: 3 },
  { field: 'PermissionsPasswordNeverExpires', label: 'Password Never Expires', tier: 3 },
  { field: 'PermissionsViewSetup', label: 'View Setup and Configuration', tier: 3 },
];

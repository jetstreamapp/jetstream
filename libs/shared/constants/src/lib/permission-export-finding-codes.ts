/**
 * Permission export analysis issue codes and severities (shared by API job processor and UI).
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
  OLS_READ_NO_FLS_ROWS: 'OLS_READ_NO_FLS_ROWS',
  OLS_EDIT_NO_FLS_ROWS: 'OLS_EDIT_NO_FLS_ROWS',
  FLS_EDIT_NO_OBJECT_EDIT: 'FLS_EDIT_NO_OBJECT_EDIT',
  FLS_READ_NO_OBJECT_READ: 'FLS_READ_NO_OBJECT_READ',
  FLS_WITHOUT_OLS_ROW: 'FLS_WITHOUT_OLS_ROW',
  FINDINGS_TRUNCATED: 'FINDINGS_TRUNCATED',
} as const;

export type PermissionExportFindingCodeValue = (typeof PermissionExportFindingCode)[keyof typeof PermissionExportFindingCode];

export type PermissionExportFindingDefinition = {
  readonly severity: PermissionExportFindingSeverityValue;
  /** Short label for Issue Codes / aggregated UI. */
  readonly label: string;
};

export const PERMISSION_EXPORT_FINDING_DEFINITIONS: Record<PermissionExportFindingCodeValue, PermissionExportFindingDefinition> = {
  [PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Object read is on, but there are no field permission rows for the object.',
  },
  [PermissionExportFindingCode.OLS_EDIT_NO_FLS_ROWS]: {
    severity: PermissionExportFindingSeverity.Warning,
    label: 'Object edit is on, but there are no field permission rows for the object.',
  },
  [PermissionExportFindingCode.FLS_EDIT_NO_OBJECT_EDIT]: {
    severity: PermissionExportFindingSeverity.Error,
    label: 'Field edit is on without object-level edit (or modify all records).',
  },
  [PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ]: {
    severity: PermissionExportFindingSeverity.Error,
    label: 'Field read is on without object-level read (or view/modify all records).',
  },
  [PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW]: {
    severity: PermissionExportFindingSeverity.Error,
    label: 'Field permissions exist for the object, but there is no object permissions row.',
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

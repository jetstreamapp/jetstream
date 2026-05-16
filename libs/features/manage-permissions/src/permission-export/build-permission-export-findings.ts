/** Derives permission analysis issues from exported ObjectPermissions and FieldPermissions rows. */

import { PERMISSION_EXPORT_FINDING_DEFINITIONS, PermissionExportFindingCode } from '@jetstream/shared/constants';

export const MAX_PERMISSION_EXPORT_FINDINGS = 8_000;

export type PermissionExportFindingRecord = Record<string, unknown>;

function readTrimmedString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readBooleanTrue(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  return value === true || value === 'true';
}

function objectPermissionKey(parentId: string, sobjectType: string): string {
  return `${parentId}::${sobjectType}`;
}

/**
 * Object-level read path for FLS alignment: Read, View All Records, or Modify All Records.
 */
function objectGrantsEffectiveRead(row: Record<string, unknown>): boolean {
  return (
    readBooleanTrue(row, 'PermissionsRead') ||
    readBooleanTrue(row, 'PermissionsViewAllRecords') ||
    readBooleanTrue(row, 'PermissionsModifyAllRecords')
  );
}

/**
 * Object-level edit path for FLS alignment: Edit or Modify All Records.
 */
function objectGrantsEffectiveEdit(row: Record<string, unknown>): boolean {
  return readBooleanTrue(row, 'PermissionsEdit') || readBooleanTrue(row, 'PermissionsModifyAllRecords');
}

/**
 * Builds deterministic issue rows from SOQL export payloads.
 *
 * @param objectPermissions ObjectPermissions rows keyed by ParentId + SobjectType.
 * @param fieldPermissions FieldPermissions rows for the same permission sets.
 * @returns Flat list suitable for `analysis_job.result.findings`.
 */
export function buildPermissionExportFindings(
  objectPermissions: Record<string, unknown>[],
  fieldPermissions: Record<string, unknown>[],
): PermissionExportFindingRecord[] {
  const findings: PermissionExportFindingRecord[] = [];
  let suppressedAfterCap = 0;

  const tryPush = (finding: PermissionExportFindingRecord): void => {
    if (findings.length < MAX_PERMISSION_EXPORT_FINDINGS) {
      findings.push(finding);
      return;
    }
    suppressedAfterCap += 1;
  };

  const objectRowByKey = new Map<string, Record<string, unknown>>();
  for (const row of objectPermissions) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const parentId = readTrimmedString(row, 'ParentId');
    const sobjectType = readTrimmedString(row, 'SobjectType');
    if (!parentId || !sobjectType) {
      continue;
    }
    objectRowByKey.set(objectPermissionKey(parentId, sobjectType), row);
  }

  const fieldCountByParentObject = new Map<string, number>();
  const fieldParentObjectKeys = new Set<string>();
  for (const row of fieldPermissions) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const parentId = readTrimmedString(row, 'ParentId');
    const sobjectType = readTrimmedString(row, 'SobjectType');
    if (!parentId || !sobjectType) {
      continue;
    }
    const key = objectPermissionKey(parentId, sobjectType);
    fieldParentObjectKeys.add(key);
    fieldCountByParentObject.set(key, (fieldCountByParentObject.get(key) ?? 0) + 1);
  }

  for (const key of fieldParentObjectKeys) {
    if (objectRowByKey.has(key)) {
      continue;
    }
    const separatorIdx = key.indexOf('::');
    if (separatorIdx <= 0 || separatorIdx === key.length - 2) {
      continue;
    }
    const parentId = key.slice(0, separatorIdx);
    const sobjectType = key.slice(separatorIdx + 2);
    const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW];
    tryPush({
      severity: def.severity,
      code: PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW,
      message: `Field permissions exist for ${sobjectType}, but there is no ObjectPermissions row for the same permission set and object.`,
      objectApiName: sobjectType,
      parentId,
      permissionSetId: parentId,
      containerId: parentId,
    });
  }

  for (const fRow of fieldPermissions) {
    if (!fRow || typeof fRow !== 'object') {
      continue;
    }
    const parentId = readTrimmedString(fRow, 'ParentId');
    const sobjectType = readTrimmedString(fRow, 'SobjectType');
    const field = readTrimmedString(fRow, 'Field');
    if (!parentId || !sobjectType || !field) {
      continue;
    }
    const objectRow = objectRowByKey.get(objectPermissionKey(parentId, sobjectType));
    if (!objectRow) {
      continue;
    }
    if (readBooleanTrue(fRow, 'PermissionsRead') && !objectGrantsEffectiveRead(objectRow)) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ];
      tryPush({
        severity: def.severity,
        code: PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ,
        message: `Field ${field} on ${sobjectType} has Read at field level, but the object permission does not grant Read, View All Records, or Modify All Records.`,
        objectApiName: sobjectType,
        fieldApiName: field,
        parentId,
        permissionSetId: parentId,
        containerId: parentId,
      });
    }
    if (readBooleanTrue(fRow, 'PermissionsEdit') && !objectGrantsEffectiveEdit(objectRow)) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.FLS_EDIT_NO_OBJECT_EDIT];
      tryPush({
        severity: def.severity,
        code: PermissionExportFindingCode.FLS_EDIT_NO_OBJECT_EDIT,
        message: `Field ${field} on ${sobjectType} has Edit at field level, but the object permission does not grant Edit or Modify All Records.`,
        objectApiName: sobjectType,
        fieldApiName: field,
        parentId,
        permissionSetId: parentId,
        containerId: parentId,
      });
    }
  }

  for (const oRow of objectPermissions) {
    if (!oRow || typeof oRow !== 'object') {
      continue;
    }
    const parentId = readTrimmedString(oRow, 'ParentId');
    const sobjectType = readTrimmedString(oRow, 'SobjectType');
    if (!parentId || !sobjectType) {
      continue;
    }
    const key = objectPermissionKey(parentId, sobjectType);
    const fieldCount = fieldCountByParentObject.get(key) ?? 0;

    if (readBooleanTrue(oRow, 'PermissionsRead') && fieldCount === 0) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS];
      tryPush({
        severity: def.severity,
        code: PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS,
        message: `Object read is on for ${sobjectType}, but there are no field permission rows for this object on the same permission set.`,
        objectApiName: sobjectType,
        parentId,
        permissionSetId: parentId,
        containerId: parentId,
      });
    }
    if (readBooleanTrue(oRow, 'PermissionsEdit') && fieldCount === 0) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.OLS_EDIT_NO_FLS_ROWS];
      tryPush({
        severity: def.severity,
        code: PermissionExportFindingCode.OLS_EDIT_NO_FLS_ROWS,
        message: `Object edit is on for ${sobjectType}, but there are no field permission rows for this object on the same permission set.`,
        objectApiName: sobjectType,
        parentId,
        permissionSetId: parentId,
        containerId: parentId,
      });
    }
  }

  if (suppressedAfterCap > 0) {
    const truncatedDef = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.FINDINGS_TRUNCATED];
    findings.push({
      severity: truncatedDef.severity,
      code: PermissionExportFindingCode.FINDINGS_TRUNCATED,
      message: `${suppressedAfterCap.toLocaleString()} additional issues were not included so the job result stays under ${MAX_PERMISSION_EXPORT_FINDINGS.toLocaleString()} rows. Narrow the permission set selection and re-run if you need full coverage.`,
      objectApiName: undefined,
      fieldApiName: undefined,
      parentId: undefined,
      permissionSetId: undefined,
      containerId: undefined,
    });
  }

  return findings;
}

export interface IssueCodeSummaryEntry {
  count: number;
  errors: number;
  warnings: number;
}

/**
 * Rolls up issues by `code` for `analysis_job.result.issueCodeSummary`.
 */
export function buildIssueCodeSummary(findings: PermissionExportFindingRecord[]): Record<string, IssueCodeSummaryEntry> {
  const summary: Record<string, IssueCodeSummaryEntry> = {};
  for (const row of findings) {
    const codeRaw = row.code;
    const code = typeof codeRaw === 'string' && codeRaw.trim().length > 0 ? codeRaw.trim() : '';
    if (!code || code === PermissionExportFindingCode.FINDINGS_TRUNCATED) {
      continue;
    }
    const existing = summary[code] ?? { count: 0, errors: 0, warnings: 0 };
    existing.count += 1;
    const severity = String(row.severity ?? '').toLowerCase();
    if (severity === 'error' || severity === 'errors') {
      existing.errors += 1;
    } else if (severity === 'warning' || severity === 'warnings') {
      existing.warnings += 1;
    }
    summary[code] = existing;
  }
  return summary;
}

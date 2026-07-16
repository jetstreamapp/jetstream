/** Derives permission analysis issues from exported permission rows (ObjectPermissions, FieldPermissions, …). */

import {
  HIGH_RISK_SYSTEM_PERMISSIONS,
  PERMISSION_EXPORT_FINDING_DEFINITIONS,
  PermissionExportFindingCode,
} from '@jetstream/shared/constants';

export const MAX_PERMISSION_EXPORT_FINDINGS = 8_000;

/** Direct User assignment ids start with `005`; permission set groups / queues do not. */
const USER_ID_PREFIX = '005';

export type PermissionExportFindingRecord = Record<string, unknown>;

/**
 * Optional context that unlocks group-aware suppression and the broader finding set. Every field is
 * optional so legacy 2-argument calls keep their original behavior (no group suppression, no new findings).
 */
export interface PermissionExportFindingsContext {
  permissionSets?: Record<string, unknown>[];
  permissionSetAssignments?: Record<string, unknown>[];
  permissionSetGroupComponents?: Record<string, unknown>[];
  mutingPermissionSets?: Record<string, unknown>[];
  permissionSetTabSettings?: Record<string, unknown>[];
  /** Categories that hit their row cap — used to suppress findings whose absence-of-rows signal is unreliable. */
  truncatedCategories?: ReadonlySet<string> | readonly string[];
  /**
   * Sobject scope of the export when the user narrowed it (`objectApiNames`). Object/field permission rows
   * were only fetched for these objects, so findings that join against those rows (e.g. tab-visibility)
   * must ignore out-of-scope objects to avoid false "no access" calls. Empty/absent = unscoped.
   */
  objectScope?: readonly string[];
}

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

/** Object-level read path for FLS alignment: Read, View All Records, or Modify All Records. */
function objectGrantsEffectiveRead(row: Record<string, unknown>): boolean {
  return (
    readBooleanTrue(row, 'PermissionsRead') ||
    readBooleanTrue(row, 'PermissionsViewAllRecords') ||
    readBooleanTrue(row, 'PermissionsModifyAllRecords')
  );
}

/** Object-level edit path for FLS alignment: Edit or Modify All Records. */
function objectGrantsEffectiveEdit(row: Record<string, unknown>): boolean {
  return readBooleanTrue(row, 'PermissionsEdit') || readBooleanTrue(row, 'PermissionsModifyAllRecords');
}

/**
 * Group-effective access lookup. A permission set that grants only FLS (or only OLS) is a valid building
 * block when combined in a Permission Set Group — so an FLS/OLS misalignment on a group member is a false
 * positive if a sibling member in the same group supplies the missing access.
 */
interface GroupContext {
  /** permissionSetId → group ids it belongs to. */
  readonly groupsByMember: Map<string, Set<string>>;
  /** group id → member permissionSetIds. */
  readonly membersByGroup: Map<string, Set<string>>;
  /** group ids that contain at least one muting permission set (effective access not fully evaluated). */
  readonly mutingGroupIds: Set<string>;
  /** permissionSetIds that are a component of any group (i.e. potentially assigned via a group). */
  readonly groupMemberIds: Set<string>;
}

function addToSetMap(map: Map<string, Set<string>>, key: string, value: string): void {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

function buildGroupContext(context: PermissionExportFindingsContext | undefined): GroupContext {
  const groupsByMember = new Map<string, Set<string>>();
  const membersByGroup = new Map<string, Set<string>>();
  const mutingGroupIds = new Set<string>();
  const groupMemberIds = new Set<string>();

  for (const row of context?.permissionSetGroupComponents ?? []) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const groupId = readTrimmedString(row, 'PermissionSetGroupId');
    const permissionSetId = readTrimmedString(row, 'PermissionSetId');
    if (!groupId || !permissionSetId) {
      continue;
    }
    groupMemberIds.add(permissionSetId);
    addToSetMap(groupsByMember, permissionSetId, groupId);
    addToSetMap(membersByGroup, groupId, permissionSetId);
  }

  for (const row of context?.mutingPermissionSets ?? []) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const groupId = readTrimmedString(row, 'PermissionSetGroupId');
    if (groupId) {
      mutingGroupIds.add(groupId);
    }
  }

  return { groupsByMember, membersByGroup, mutingGroupIds, groupMemberIds };
}

function permissionSetIdsWithDirectUserAssignment(context: PermissionExportFindingsContext | undefined): Set<string> {
  const assigned = new Set<string>();
  for (const row of context?.permissionSetAssignments ?? []) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const permissionSetId = readTrimmedString(row, 'PermissionSetId');
    const assigneeId = readTrimmedString(row, 'AssigneeId');
    if (permissionSetId && assigneeId.startsWith(USER_ID_PREFIX)) {
      assigned.add(permissionSetId);
    }
  }
  return assigned;
}

function categoryTruncated(context: PermissionExportFindingsContext | undefined, category: string): boolean {
  const categories = context?.truncatedCategories;
  if (!categories) {
    return false;
  }
  return categories instanceof Set ? categories.has(category) : (categories as readonly string[]).includes(category);
}

/**
 * Resolves the object API name a PermissionSetTabSetting refers to, or `null` for tabs not backed by a
 * queryable object (Visualforce / web / Lightning page tabs). Standard tabs are `standard-<Object>`;
 * custom-object tabs use the object API name (often `<Name>__c`).
 */
function tabSettingObjectApiName(tabName: string): string | null {
  const name = tabName.trim();
  if (!name) {
    return null;
  }
  if (name.startsWith('standard-')) {
    return name.slice('standard-'.length);
  }
  if (name.endsWith('__c')) {
    return name;
  }
  return null;
}

/**
 * Builds deterministic issue rows from SOQL export payloads.
 *
 * @param objectPermissions ObjectPermissions rows keyed by ParentId + SobjectType.
 * @param fieldPermissions FieldPermissions rows for the same permission sets.
 * @param context Optional extra rows (permission sets, assignments, group components, muting, tabs) that
 *   enable group-aware suppression and the broader finding set.
 * @returns Flat list suitable for `analysis_job.result.findings`.
 */
export function buildPermissionExportFindings(
  objectPermissions: Record<string, unknown>[],
  fieldPermissions: Record<string, unknown>[],
  context?: PermissionExportFindingsContext,
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

  const group = buildGroupContext(context);

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

  /** Whether a sibling permission set in a shared group supplies the object access this parent lacks. */
  const siblingSuppliesAccess = (parentId: string, sobjectType: string, mode: 'read' | 'edit'): boolean => {
    const groupIds = group.groupsByMember.get(parentId);
    if (!groupIds) {
      return false;
    }
    for (const groupId of groupIds) {
      for (const memberId of group.membersByGroup.get(groupId) ?? []) {
        if (memberId === parentId) {
          continue;
        }
        const row = objectRowByKey.get(objectPermissionKey(memberId, sobjectType));
        if (row && (mode === 'read' ? objectGrantsEffectiveRead(row) : objectGrantsEffectiveEdit(row))) {
          return true;
        }
      }
    }
    return false;
  };

  const firstGroupId = (parentId: string): string | undefined => {
    const groupIds = group.groupsByMember.get(parentId);
    return groupIds ? [...groupIds][0] : undefined;
  };

  const parentInGroupWithMuting = (parentId: string): boolean => {
    for (const groupId of group.groupsByMember.get(parentId) ?? []) {
      if (group.mutingGroupIds.has(groupId)) {
        return true;
      }
    }
    return false;
  };

  /**
   * Emits an FLS/OLS-alignment finding unless a group sibling already supplies the access. When the
   * group also contains muting permission sets we cannot be sure, so we emit a softened finding instead
   * of suppressing it (fail safe — show it, annotated).
   */
  const pushGroupAwareFlsFinding = (
    base: PermissionExportFindingRecord,
    parentId: string,
    sobjectType: string,
    mode: 'read' | 'edit',
  ): void => {
    const groupId = firstGroupId(parentId);
    if (siblingSuppliesAccess(parentId, sobjectType, mode)) {
      if (!parentInGroupWithMuting(parentId)) {
        return; // satisfied by the group — not a real issue
      }
      tryPush({
        ...base,
        ...(groupId ? { partOfGroupId: groupId } : {}),
        message: `${String(base.message ?? '')} It may be provided by another permission set in group ${groupId}, but a muting permission set is present so effective access was not fully evaluated.`,
      });
      return;
    }
    tryPush({ ...base, ...(groupId ? { partOfGroupId: groupId } : {}) });
  };

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

  // "Row is missing" findings are only trustworthy when the joined-against category was fully loaded —
  // a truncated category makes absence indistinguishable from "row was cut by the budget".
  const objectPermissionsTruncated = categoryTruncated(context, 'objectPermissions');
  const fieldPermissionsTruncated = categoryTruncated(context, 'fieldPermissions');

  for (const key of fieldParentObjectKeys) {
    if (objectPermissionsTruncated) {
      break;
    }
    if (objectRowByKey.has(key)) {
      continue;
    }
    const separatorIdx = key.indexOf('::');
    // Reject keys with no separator (indexOf === -1), an empty parentId, or an empty sobjectType
    // (separator at/after the second-to-last char leaves nothing after `::`).
    if (separatorIdx <= 0 || separatorIdx + 2 >= key.length) {
      continue;
    }
    const parentId = key.slice(0, separatorIdx);
    const sobjectType = key.slice(separatorIdx + 2);
    const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW];
    pushGroupAwareFlsFinding(
      {
        severity: def.severity,
        code: PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW,
        message: `Field permissions exist for ${sobjectType}, but there is no ObjectPermissions row for the same permission set and object.`,
        objectApiName: sobjectType,
        parentId,
        permissionSetId: parentId,
        containerId: parentId,
      },
      parentId,
      sobjectType,
      'read',
    );
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
    const editMisaligned = readBooleanTrue(fRow, 'PermissionsEdit') && !objectGrantsEffectiveEdit(objectRow);
    const readMisaligned = readBooleanTrue(fRow, 'PermissionsRead') && !objectGrantsEffectiveRead(objectRow);

    if (editMisaligned) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.FLS_EDIT_NO_OBJECT_EDIT];
      pushGroupAwareFlsFinding(
        {
          severity: def.severity,
          code: PermissionExportFindingCode.FLS_EDIT_NO_OBJECT_EDIT,
          message: `Field ${field} on ${sobjectType} has Edit at field level, but the object permission does not grant Edit or Modify All Records.`,
          objectApiName: sobjectType,
          fieldApiName: field,
          parentId,
          permissionSetId: parentId,
          containerId: parentId,
        },
        parentId,
        sobjectType,
        'edit',
      );
    }
    // Skip the read finding when edit is also misaligned for the same field — same root cause, avoids
    // double-counting one misconfiguration as two findings.
    if (readMisaligned && !editMisaligned) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ];
      pushGroupAwareFlsFinding(
        {
          severity: def.severity,
          code: PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ,
          message: `Field ${field} on ${sobjectType} has Read at field level, but the object permission does not grant Read, View All Records, or Modify All Records.`,
          objectApiName: sobjectType,
          fieldApiName: field,
          parentId,
          permissionSetId: parentId,
          containerId: parentId,
        },
        parentId,
        sobjectType,
        'read',
      );
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
    // fieldCount === 0 is only meaningful when FieldPermissions was fully loaded. View All Fields grants
    // read on every field, so "no FLS rows" is intentional (not incomplete setup) for the read path.
    const noFlsRowsReliable = fieldCount === 0 && !fieldPermissionsTruncated;

    if (readBooleanTrue(oRow, 'PermissionsRead') && noFlsRowsReliable && !readBooleanTrue(oRow, 'PermissionsViewAllFields')) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS];
      tryPush({
        severity: def.severity,
        code: PermissionExportFindingCode.OLS_READ_NO_FLS_ROWS,
        message: `Object read is on for ${sobjectType}, but there are no field permission rows for this object on the same permission set (default field access applies).`,
        objectApiName: sobjectType,
        parentId,
        permissionSetId: parentId,
        containerId: parentId,
      });
    }
    if (readBooleanTrue(oRow, 'PermissionsEdit') && noFlsRowsReliable) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.OLS_EDIT_NO_FLS_ROWS];
      tryPush({
        severity: def.severity,
        code: PermissionExportFindingCode.OLS_EDIT_NO_FLS_ROWS,
        message: `Object edit is on for ${sobjectType}, but there are no field permission rows for this object on the same permission set (default field access applies).`,
        objectApiName: sobjectType,
        parentId,
        permissionSetId: parentId,
        containerId: parentId,
      });
    }

    // Broad record access that bypasses the sharing model. Modify All Records implies View All Records, so
    // only the (higher-severity) Modify All finding is emitted when both are present.
    if (readBooleanTrue(oRow, 'PermissionsModifyAllRecords')) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.OBJECT_MODIFY_ALL_RECORDS];
      tryPush({
        severity: def.severity,
        code: PermissionExportFindingCode.OBJECT_MODIFY_ALL_RECORDS,
        message: `Modify All Records is granted for ${sobjectType} — this bypasses the sharing model (edit/delete every record).`,
        objectApiName: sobjectType,
        parentId,
        permissionSetId: parentId,
        containerId: parentId,
      });
    } else if (readBooleanTrue(oRow, 'PermissionsViewAllRecords')) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.OBJECT_VIEW_ALL_RECORDS];
      tryPush({
        severity: def.severity,
        code: PermissionExportFindingCode.OBJECT_VIEW_ALL_RECORDS,
        message: `View All Records is granted for ${sobjectType} — this bypasses the sharing model (read every record).`,
        objectApiName: sobjectType,
        parentId,
        permissionSetId: parentId,
        containerId: parentId,
      });
    }
  }

  // High-risk system permissions + orphaned permission sets (require the permission set rows).
  const permissionSets = context?.permissionSets ?? [];
  const assignedSet = permissionSetIdsWithDirectUserAssignment(context);
  const assignmentsTruncated = categoryTruncated(context, 'permissionSetAssignments');
  for (const psRow of permissionSets) {
    if (!psRow || typeof psRow !== 'object') {
      continue;
    }
    const id = readTrimmedString(psRow, 'Id');
    if (!id) {
      continue;
    }
    const isProfile = readBooleanTrue(psRow, 'IsOwnedByProfile');
    const label = readTrimmedString(psRow, 'Label') || readTrimmedString(psRow, 'Name') || id;
    const containerNoun = isProfile ? 'Profile' : 'Permission set';

    for (const perm of HIGH_RISK_SYSTEM_PERMISSIONS) {
      if (!readBooleanTrue(psRow, perm.field)) {
        continue;
      }
      const code = perm.tier === 1 ? PermissionExportFindingCode.SYSTEM_PERM_HIGH_RISK : PermissionExportFindingCode.SYSTEM_PERM_ELEVATED;
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[code];
      tryPush({
        severity: def.severity,
        code,
        message: `${containerNoun} "${label}" grants the system permission "${perm.label}".`,
        systemPermission: perm.field,
        parentId: id,
        permissionSetId: id,
        containerId: id,
      });
    }

    // Orphaned permission set: not profile-owned, no direct user assignment, and not a member of any group
    // (a group member may be assigned via its group). Skip when assignment data was truncated.
    if (!isProfile && !assignmentsTruncated && !assignedSet.has(id) && !group.groupMemberIds.has(id)) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.PERMSET_NO_ASSIGNMENTS];
      tryPush({
        severity: def.severity,
        code: PermissionExportFindingCode.PERMSET_NO_ASSIGNMENTS,
        message: `Permission set "${label}" has no direct user assignments and is not part of a permission set group — it may be safe to delete.`,
        parentId: id,
        permissionSetId: id,
        containerId: id,
      });
    }
  }

  // Tab visible without object read. Tab settings are always fetched for ALL tabs, but ObjectPermissions
  // rows are only fetched for in-scope objects — so out-of-scope tabs cannot be evaluated. Skip the whole
  // pass when ObjectPermissions was truncated (a missing row no longer proves "no access").
  const scopedObjectNames = new Set((context?.objectScope ?? []).map((objectApiName) => objectApiName.toLowerCase()));
  for (const tabRow of objectPermissionsTruncated ? [] : (context?.permissionSetTabSettings ?? [])) {
    if (!tabRow || typeof tabRow !== 'object') {
      continue;
    }
    const parentId = readTrimmedString(tabRow, 'ParentId');
    const tabName = readTrimmedString(tabRow, 'Name');
    const visibility = readTrimmedString(tabRow, 'Visibility');
    if (!parentId || !tabName || visibility === '' || visibility === 'None' || visibility === 'Hidden') {
      continue;
    }
    const objectApiName = tabSettingObjectApiName(tabName);
    if (!objectApiName) {
      continue; // VF / web / Lightning page tab — no queryable object to check
    }
    if (scopedObjectNames.size > 0 && !scopedObjectNames.has(objectApiName.toLowerCase())) {
      continue; // out-of-scope object — its ObjectPermissions rows were never fetched
    }
    const objectRow = objectRowByKey.get(objectPermissionKey(parentId, objectApiName));
    if (objectRow && objectGrantsEffectiveRead(objectRow)) {
      continue;
    }
    const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.TAB_VISIBLE_NO_OBJECT_READ];
    tryPush({
      severity: def.severity,
      code: PermissionExportFindingCode.TAB_VISIBLE_NO_OBJECT_READ,
      message: `Tab "${tabName}" is visible (${visibility}), but the permission set grants no read access to ${objectApiName}.`,
      objectApiName,
      parentId,
      permissionSetId: parentId,
      containerId: parentId,
    });
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

/** Derives permission analysis issues from exported permission rows (ObjectPermissions, FieldPermissions, …). */

import {
  HIGH_RISK_SYSTEM_PERMISSIONS,
  PERMISSION_EXPORT_FINDING_DEFINITIONS,
  PermissionExportFindingCode,
  type PermissionExportFindingCodeValue,
  PermissionExportFindingSeverity,
} from '@jetstream/shared/constants';

/**
 * Per-severity cap on emitted issue rows. Bounds the stored (gzipped) job result; the constraint is
 * browser memory / IndexedDB size, not a Salesforce limit. Errors and warnings are capped independently
 * so a flood of low-value warnings can never crowd out the exposure findings — see
 * {@link buildPermissionExportFindings} for the ordering guarantee.
 */
export const MAX_PERMISSION_EXPORT_FINDINGS = 50_000;

/** Direct User assignment ids start with `005`; permission set groups / queues do not. */
const USER_ID_PREFIX = '005';

/**
 * `PermissionSet.Type` values that are not user-manageable custom permission sets, so
 * {@link PermissionExportFindingCode.PERMSET_NO_ASSIGNMENTS} ("may be safe to delete") must never fire
 * for them. `Group` is the permission set backing a permission set group; `Session` is activated per
 * session rather than assigned; `Profile` is already excluded via `IsOwnedByProfile`.
 */
const NON_DELETABLE_PERMISSION_SET_TYPES = new Set(['Group', 'Session', 'Profile']);

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
  /**
   * Every sobject API name in the org (from a global describe). Used to tell a tab that is backed by a
   * real object from one that is not — `standard-home` / `standard-report` / `standard-Chatter` are tab
   * names, not objects, and would otherwise each produce a bogus "grants no read access to home" finding.
   * Absent = the describe was unavailable, in which case the tab-visibility pass is skipped entirely
   * rather than guessed at.
   */
  knownObjectApiNames?: ReadonlySet<string> | readonly string[];
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

/**
 * Direct (User) assignment graph. Salesforce effective access is the union across everything assigned to
 * a user, so this is what lets an alignment finding on one permission set be resolved by another.
 */
interface AssignmentContext {
  /** permissionSetId → assigned User ids. */
  readonly usersByPermissionSet: Map<string, Set<string>>;
  /** User id → permissionSetIds assigned to them. */
  readonly permissionSetsByUser: Map<string, Set<string>>;
  /** permissionSetIds with at least one direct User assignment. */
  readonly assignedPermissionSetIds: Set<string>;
}

function buildAssignmentContext(context: PermissionExportFindingsContext | undefined): AssignmentContext {
  const usersByPermissionSet = new Map<string, Set<string>>();
  const permissionSetsByUser = new Map<string, Set<string>>();
  const assignedPermissionSetIds = new Set<string>();

  for (const row of context?.permissionSetAssignments ?? []) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const permissionSetId = readTrimmedString(row, 'PermissionSetId');
    const assigneeId = readTrimmedString(row, 'AssigneeId');
    if (!permissionSetId || !assigneeId.startsWith(USER_ID_PREFIX)) {
      continue;
    }
    assignedPermissionSetIds.add(permissionSetId);
    addToSetMap(usersByPermissionSet, permissionSetId, assigneeId);
    addToSetMap(permissionSetsByUser, assigneeId, permissionSetId);
  }

  return { usersByPermissionSet, permissionSetsByUser, assignedPermissionSetIds };
}

function categoryTruncated(context: PermissionExportFindingsContext | undefined, category: string): boolean {
  const categories = context?.truncatedCategories;
  if (!categories) {
    return false;
  }
  return categories instanceof Set ? categories.has(category) : (categories as readonly string[]).includes(category);
}

/**
 * Resolves the object API name a PermissionSetTabSetting refers to, or `null` for tabs not backed by an
 * object. Standard tabs are `standard-<Object>`; custom-object tabs use the object API name (`<Name>__c`).
 *
 * The `standard-` prefix is NOT proof of an object — `standard-home`, `standard-report`,
 * `standard-Chatter`, `standard-File` and friends are tab names with no sobject behind them. The
 * candidate is therefore only accepted when it matches a real object from the org's global describe,
 * and the describe's canonical casing is returned so the `ObjectPermissions.SobjectType` join lines up.
 */
function tabSettingObjectApiName(tabName: string, canonicalObjectNamesByLower: ReadonlyMap<string, string>): string | null {
  const name = tabName.trim();
  if (!name) {
    return null;
  }
  const candidate = name.startsWith('standard-') ? name.slice('standard-'.length) : name;
  return canonicalObjectNamesByLower.get(candidate.toLowerCase()) ?? null;
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
  // Errors and warnings are collected separately and concatenated errors-first. The cap used to drop in
  // emission order, which meant a warning-heavy org (field permissions are emitted first, and there can
  // be hundreds of thousands of rows) exhausted the budget before the passes that emit the ONLY two
  // error codes — an org granting Modify All Data could report zero errors. Exposure findings must
  // survive truncation; that is the whole point of the report.
  const errorFindings: PermissionExportFindingRecord[] = [];
  const warningFindings: PermissionExportFindingRecord[] = [];
  let suppressedErrors = 0;
  let suppressedWarnings = 0;

  const tryPush = (finding: PermissionExportFindingRecord): void => {
    const isError = finding.severity === PermissionExportFindingSeverity.Error;
    const bucket = isError ? errorFindings : warningFindings;
    if (bucket.length < MAX_PERMISSION_EXPORT_FINDINGS) {
      bucket.push(finding);
      return;
    }
    if (isError) {
      suppressedErrors += 1;
    } else {
      suppressedWarnings += 1;
    }
  };

  const group = buildGroupContext(context);
  const assignment = buildAssignmentContext(context);

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
   * Whether EVERY user assigned this permission set also holds another permission set that supplies the
   * object access. Salesforce effective access is the union across a user's assignments, so in that case
   * the field access does resolve for every affected user and the finding is a false positive.
   *
   * Deliberately all-or-nothing: if even one assignee lacks the access elsewhere, the misalignment is
   * real for that user and the finding stands. A permission set with no assignees returns false —
   * nothing is proven (and `PERMSET_NO_ASSIGNMENTS` already covers that case).
   */
  const everyAssigneeCoveredElsewhere = (parentId: string, sobjectType: string, mode: 'read' | 'edit'): boolean => {
    const assignees = assignment.usersByPermissionSet.get(parentId);
    if (!assignees || assignees.size === 0) {
      return false;
    }
    for (const userId of assignees) {
      let covered = false;
      for (const otherPermissionSetId of assignment.permissionSetsByUser.get(userId) ?? []) {
        if (otherPermissionSetId === parentId) {
          continue;
        }
        const row = objectRowByKey.get(objectPermissionKey(otherPermissionSetId, sobjectType));
        if (row && (mode === 'read' ? objectGrantsEffectiveRead(row) : objectGrantsEffectiveEdit(row))) {
          covered = true;
          break;
        }
      }
      if (!covered) {
        return false;
      }
    }
    return true;
  };

  type AlignmentCoverage =
    /** No other container we can see supplies the access — the finding stands. */
    | 'not-covered'
    /** A group sibling or every assignee's other permission sets supply it — suppress. */
    | 'covered'
    /** A group sibling supplies it, but muting sets mean effective access is unproven — soften. */
    | 'group-covered-but-muted';

  /**
   * Coverage depends only on (permission set, object, mode) — never on the field — but the alignment
   * passes ask once per misaligned FIELD row. Without this memo the assignee scan is
   * O(findings × assignees × their permission sets), which on a wide object with a broadly assigned
   * permission set means re-walking the whole assignment graph for every column. Cached entries are
   * bounded by the (parent, object) pairs that actually produce findings.
   */
  const alignmentCoverageCache = new Map<string, AlignmentCoverage>();

  const resolveAlignmentCoverage = (parentId: string, sobjectType: string, mode: 'read' | 'edit'): AlignmentCoverage => {
    const cacheKey = `${parentId}::${sobjectType}::${mode}`;
    const cached = alignmentCoverageCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    let coverage: AlignmentCoverage;
    if (siblingSuppliesAccess(parentId, sobjectType, mode)) {
      coverage = parentInGroupWithMuting(parentId) ? 'group-covered-but-muted' : 'covered';
    } else {
      coverage = everyAssigneeCoveredElsewhere(parentId, sobjectType, mode) ? 'covered' : 'not-covered';
    }
    alignmentCoverageCache.set(cacheKey, coverage);
    return coverage;
  };

  /**
   * Emits an FLS/OLS-alignment finding unless another container that reaches the same users already
   * supplies the object access — a permission set group sibling, or another permission set assigned to
   * every one of this one's assignees. When the group also contains muting permission sets we cannot be
   * sure, so we emit a softened finding instead of suppressing it (fail safe — show it, annotated).
   *
   * Note the remaining blind spot, which is why the messages say "this permission set" rather than
   * "no effect": the assignees' PROFILE is not visible here (it needs `User.ProfileId`, which the export
   * does not query), and permission sets outside the exported selection are not visible either.
   */
  const pushAlignmentFinding = (
    base: PermissionExportFindingRecord,
    parentId: string,
    sobjectType: string,
    mode: 'read' | 'edit',
  ): void => {
    const coverage = resolveAlignmentCoverage(parentId, sobjectType, mode);
    if (coverage === 'covered') {
      return;
    }
    const groupId = firstGroupId(parentId);
    if (coverage === 'group-covered-but-muted') {
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
    pushAlignmentFinding(
      {
        severity: def.severity,
        code: PermissionExportFindingCode.FLS_WITHOUT_OLS_ROW,
        message: `Field permissions exist for ${sobjectType}, but this permission set has no object permissions row for it — object access must come from the user's profile or another permission set.`,
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
      pushAlignmentFinding(
        {
          severity: def.severity,
          code: PermissionExportFindingCode.FLS_EDIT_NO_OBJECT_EDIT,
          message: `Field ${field} on ${sobjectType} has Edit at field level, but this permission set's object permission does not grant Edit or Modify All Records — object access must come from the user's profile or another permission set.`,
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
      pushAlignmentFinding(
        {
          severity: def.severity,
          code: PermissionExportFindingCode.FLS_READ_NO_OBJECT_READ,
          message: `Field ${field} on ${sobjectType} has Read at field level, but this permission set's object permission does not grant Read, View All Records, or Modify All Records — object access must come from the user's profile or another permission set.`,
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

    // Orphaned permission set: no direct user assignment and not a member of any group (a group member
    // may be assigned via its group). Skip when assignment data was truncated.
    //
    // Managed-package (`NamespacePrefix`), Salesforce-standard (`IsCustom = false`), and
    // group/session-backing permission sets are excluded — several cannot be deleted at all, so calling
    // them "safe to delete" would be wrong advice. Those columns go through the org describe intersection
    // and could in principle be absent; Salesforce omits unselected fields from the row entirely, so an
    // `in` check tells us whether we can actually classify deletability. When we cannot, the finding is
    // still worth surfacing (the set really is unassigned) but the deletion advice is dropped rather than
    // guessed — same fail-safe posture as the muting-permission-set softening above.
    const canClassifyDeletability = 'NamespacePrefix' in psRow && 'IsCustom' in psRow && 'Type' in psRow;
    const isKnownNonDeletable =
      canClassifyDeletability &&
      (!!readTrimmedString(psRow, 'NamespacePrefix') ||
        psRow.IsCustom === false ||
        NON_DELETABLE_PERMISSION_SET_TYPES.has(readTrimmedString(psRow, 'Type')));
    if (
      !isProfile &&
      !isKnownNonDeletable &&
      !assignmentsTruncated &&
      !assignment.assignedPermissionSetIds.has(id) &&
      !group.groupMemberIds.has(id)
    ) {
      const def = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.PERMSET_NO_ASSIGNMENTS];
      tryPush({
        severity: def.severity,
        code: PermissionExportFindingCode.PERMSET_NO_ASSIGNMENTS,
        message: canClassifyDeletability
          ? `Permission set "${label}" has no direct user assignments and is not part of a permission set group — it may be safe to delete.`
          : `Permission set "${label}" has no direct user assignments and is not part of a permission set group. This org did not expose the columns needed to confirm it is a deletable custom permission set, so verify it is not managed or Salesforce-provided before removing it.`,
        parentId: id,
        permissionSetId: id,
        containerId: id,
      });
    }
  }

  // Tab visible without object read. Tab settings are always fetched for ALL tabs, but ObjectPermissions
  // rows are only fetched for in-scope objects — so out-of-scope tabs cannot be evaluated. Skip the whole
  // pass when ObjectPermissions was truncated (a missing row no longer proves "no access"), or when the
  // global describe is unavailable (without it a tab name cannot be told apart from an object name).
  const canonicalObjectNamesByLower = new Map<string, string>();
  for (const objectApiName of context?.knownObjectApiNames ?? []) {
    if (typeof objectApiName === 'string' && objectApiName.length > 0) {
      canonicalObjectNamesByLower.set(objectApiName.toLowerCase(), objectApiName);
    }
  }
  const canEvaluateTabs = !objectPermissionsTruncated && canonicalObjectNamesByLower.size > 0;
  const scopedObjectNames = new Set((context?.objectScope ?? []).map((objectApiName) => objectApiName.toLowerCase()));
  for (const tabRow of canEvaluateTabs ? (context?.permissionSetTabSettings ?? []) : []) {
    if (!tabRow || typeof tabRow !== 'object') {
      continue;
    }
    const parentId = readTrimmedString(tabRow, 'ParentId');
    const tabName = readTrimmedString(tabRow, 'Name');
    const visibility = readTrimmedString(tabRow, 'Visibility');
    if (!parentId || !tabName || visibility === '' || visibility === 'None' || visibility === 'Hidden') {
      continue;
    }
    const objectApiName = tabSettingObjectApiName(tabName, canonicalObjectNamesByLower);
    if (!objectApiName) {
      continue; // home / reports / Chatter / VF / web / Lightning page tab — no object behind it
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

  // Errors first — both so truncation drops warnings rather than exposure findings, and so the default
  // order of the Issues grid leads with what matters. The UI re-sorts on top of this.
  const findings = [...errorFindings, ...warningFindings];

  const suppressedAfterCap = suppressedErrors + suppressedWarnings;
  if (suppressedAfterCap > 0) {
    const truncatedDef = PERMISSION_EXPORT_FINDING_DEFINITIONS[PermissionExportFindingCode.FINDINGS_TRUNCATED];
    const errorCoverage =
      suppressedErrors === 0 ? 'Every error was included' : `${suppressedErrors.toLocaleString()} of the omitted issues are errors`;
    findings.push({
      severity: truncatedDef.severity,
      code: PermissionExportFindingCode.FINDINGS_TRUNCATED,
      message: `${suppressedAfterCap.toLocaleString()} additional issues were not included so the job result stays under ${MAX_PERMISSION_EXPORT_FINDINGS.toLocaleString()} rows per severity. ${errorCoverage}. Narrow the permission set or object selection and re-run if you need full coverage.`,
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
    // Catalog-first, matching the UI's `resolveFindingSeverity`, so the stored summary and the rendered
    // rollups can never disagree about the same row.
    const definition = PERMISSION_EXPORT_FINDING_DEFINITIONS[code as PermissionExportFindingCodeValue] as
      | (typeof PERMISSION_EXPORT_FINDING_DEFINITIONS)[PermissionExportFindingCodeValue]
      | undefined;
    const severity = definition?.severity ?? String(row.severity ?? '').toLowerCase();
    if (severity === PermissionExportFindingSeverity.Error) {
      existing.errors += 1;
    } else if (severity === PermissionExportFindingSeverity.Warning) {
      existing.warnings += 1;
    }
    summary[code] = existing;
  }
  return summary;
}

import { isUnmanagedCustomFieldApiName } from '@jetstream/shared/utils';
import type { ListMetadataResult } from '@jetstream/types';
import type { FieldUsageFieldMetaParsed } from './field-usage-result-parse';

export interface FieldUsageDeleteEligibilityArgs {
  isObjectErrorPlaceholder?: boolean;
  fieldApiName: string;
  meta?: FieldUsageFieldMetaParsed | null;
  /**
   * Whether THIS field's usage numbers may be incomplete. Pass the per-field flag when the job result
   * has one (COUNT-based fields are exact even when a sibling field's row scan truncated); fall back to
   * the object-level `queryTruncated` for legacy rows.
   */
  scanTruncated?: boolean;
  whereUsedDependencyCount?: number;
  /**
   * Whether THIS field's dependencies were proven complete (Tooling Id resolved AND dependency query
   * succeeded). Pass per-field — not the whole-run flag — so an unresolved field is never deletable.
   */
  whereUsedKnown?: boolean;
  /** Non-null populated record count from a non-truncated scan. Any data present blocks auto-eligibility. */
  filled?: number;
}

/** Why a field is NOT eligible for destructive delete; `null` means it IS eligible. Ordered by precedence. */
export type FieldUsageDeleteIneligibleReason =
  | 'object-error'
  | 'standard-field'
  | 'name-field'
  | 'packaged-field'
  | 'scan-truncated'
  | 'where-used-unknown'
  | 'has-dependencies'
  | 'has-data';

/** Human-readable explanations for the "why can't I delete this?" UI. */
export const FIELD_USAGE_DELETE_INELIGIBLE_LABELS: Record<FieldUsageDeleteIneligibleReason, string> = {
  'object-error': 'Object could not be analyzed',
  'standard-field': 'Standard fields cannot be deleted',
  'name-field': 'Name fields cannot be deleted',
  'packaged-field': 'Packaged (namespaced) fields cannot be deleted here',
  'scan-truncated': 'Scan was truncated — usage may be incomplete (run a full scan first)',
  'where-used-unknown': 'Dependencies could not be determined for this field',
  'has-dependencies': 'Referenced by a layout, automation, or Apex',
  'has-data': 'Field has data — deleting permanently destroys it',
};

/**
 * Returns why a field is NOT eligible for a destructive CustomField deploy, or `null` when it IS eligible.
 *
 * Safety gates (each, independently, prevents deleting a field that may be in use):
 * - Standard / name / packaged fields cannot be deleted by this tool.
 * - `scanTruncated` — this field's scan hit the row budget, so a 0%/low reading is NOT proof of disuse.
 * - `whereUsedKnown === false` — dependencies for this field could not be proven; treat as in-use (fail safe).
 *   This is now per-field: an unresolved field (Tooling Id not found, or its dependency query failed) is
 *   UNKNOWN, never "0 dependencies", closing the previous gap where partial failures looked delete-safe.
 * - `whereUsedDependencyCount > 0` — referenced by metadata (layout / automation / Apex).
 * - `filled > 0` — the field holds data; deleting a CustomField permanently destroys all of it, so a field
 *   with ANY populated records is never auto-eligible (the user can still delete via the normal metadata tools).
 *
 * Note: `MetadataComponentDependency` does NOT detect references in reports, list views, validation rules,
 * or email templates — so "no dependencies" means no *code/layout* reference, not "unreferenced". The UI
 * must communicate this before deletion.
 */
export function fieldUsageDestructiveDeleteIneligibleReason(
  args: FieldUsageDeleteEligibilityArgs,
): FieldUsageDeleteIneligibleReason | null {
  const { isObjectErrorPlaceholder, fieldApiName, meta, scanTruncated, whereUsedDependencyCount, whereUsedKnown, filled } = args;
  if (isObjectErrorPlaceholder) {
    return 'object-error';
  }
  if (!meta?.custom) {
    return 'standard-field';
  }
  if (meta.nameField) {
    return 'name-field';
  }
  if (!isUnmanagedCustomFieldApiName(fieldApiName)) {
    return 'packaged-field';
  }
  if (scanTruncated) {
    return 'scan-truncated';
  }
  if (whereUsedKnown === false) {
    return 'where-used-unknown';
  }
  if ((whereUsedDependencyCount ?? 0) > 0) {
    return 'has-dependencies';
  }
  if ((filled ?? 0) > 0) {
    return 'has-data';
  }
  return null;
}

/**
 * Whether a field usage row may be included in a destructive CustomField deploy (delete from org).
 * Thin wrapper over {@link fieldUsageDestructiveDeleteIneligibleReason}.
 */
export function fieldUsageRowEligibleForDestructiveDelete(args: FieldUsageDeleteEligibilityArgs): boolean {
  return fieldUsageDestructiveDeleteIneligibleReason(args) === null;
}

export interface FieldUsageDestructiveDeleteRow {
  objectApiName: string;
  fieldApiName: string;
  destructiveDeleteEligible?: boolean;
}

/**
 * Builds `selectedMetadata` for {@link DeleteMetadataModal} / destructive deploy (CustomField only).
 */
export function fieldUsageRowsToCustomFieldDeleteMetadata(
  rows: readonly FieldUsageDestructiveDeleteRow[],
): Record<string, ListMetadataResult[]> {
  const members: ListMetadataResult[] = [];
  for (const row of rows) {
    if (!row.destructiveDeleteEligible) {
      continue;
    }
    const fullName = `${row.objectApiName}.${row.fieldApiName}`;
    members.push({
      createdById: null,
      createdByName: null,
      createdDate: null,
      fileName: `objects/${row.objectApiName}/fields/${row.fieldApiName}.field-meta.xml`,
      fullName,
      id: null,
      lastModifiedById: null,
      lastModifiedByName: null,
      lastModifiedDate: null,
      manageableState: 'unmanaged',
      type: 'CustomField',
    });
  }
  if (members.length === 0) {
    return {};
  }
  return { CustomField: members };
}

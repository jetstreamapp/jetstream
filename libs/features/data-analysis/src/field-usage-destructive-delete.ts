import type { ListMetadataResult } from '@jetstream/types';
import { isUnmanagedCustomFieldApiName } from '@jetstream/shared/utils';
import type { FieldUsageFieldMetaParsed } from './field-usage-result-parse';

/**
 * Whether a field usage row may be included in a destructive CustomField deploy (delete from org).
 * Standard fields, packaged custom fields, and the object name field are excluded.
 *
 * Three safety gates prevent deleting a field that may actually be in use:
 * - `objectQueryTruncated` — the scan hit the row budget, so a 0%/low reading is NOT proof the field is
 *   unused (it could be populated in the rows that were never scanned).
 * - `whereUsedDependencyCount` — the field is referenced by metadata (layout / automation / Apex), a hard
 *   usage signal independent of data population.
 * - `whereUsedKnown` — when the Tooling where-used lookup failed entirely we cannot prove the field has no
 *   dependencies, so deletion is blocked (fail safe) rather than treating "no rows" as "no dependencies".
 *
 * Uses {@link isUnmanagedCustomFieldApiName} (same parse rules as Tooling `CustomField` and field usage where-used).
 */
export function fieldUsageRowEligibleForDestructiveDelete(args: {
  isObjectErrorPlaceholder?: boolean;
  fieldApiName: string;
  meta?: FieldUsageFieldMetaParsed | null;
  objectQueryTruncated?: boolean;
  whereUsedDependencyCount?: number;
  whereUsedKnown?: boolean;
}): boolean {
  const { isObjectErrorPlaceholder, fieldApiName, meta, objectQueryTruncated, whereUsedDependencyCount, whereUsedKnown } = args;
  if (isObjectErrorPlaceholder) {
    return false;
  }
  if (!meta?.custom) {
    return false;
  }
  if (meta.nameField) {
    return false;
  }
  if (!isUnmanagedCustomFieldApiName(fieldApiName)) {
    return false;
  }
  if (objectQueryTruncated) {
    return false;
  }
  if (whereUsedKnown === false) {
    return false;
  }
  if ((whereUsedDependencyCount ?? 0) > 0) {
    return false;
  }
  return true;
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

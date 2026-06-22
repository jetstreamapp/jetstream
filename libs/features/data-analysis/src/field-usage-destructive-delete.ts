import type { ListMetadataResult } from '@jetstream/types';
import { isUnmanagedCustomFieldApiName } from '@jetstream/shared/utils';
import type { FieldUsageFieldMetaParsed } from './field-usage-result-parse';

/**
 * Whether a field usage row may be included in a destructive CustomField deploy (delete from org).
 * Standard fields, packaged custom fields, and the object name field are excluded.
 *
 * Uses {@link isUnmanagedCustomFieldApiName} (same parse rules as Tooling `CustomField` and field usage where-used).
 */
export function fieldUsageRowEligibleForDestructiveDelete(args: {
  isObjectErrorPlaceholder?: boolean;
  fieldApiName: string;
  meta?: FieldUsageFieldMetaParsed | null;
}): boolean {
  const { isObjectErrorPlaceholder, fieldApiName, meta } = args;
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

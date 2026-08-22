import { Maybe } from '@jetstream/types';

/**
 * Optional audit columns on the field permissions table, in the order they appear in the grid and in exports.
 *
 * This is the single source of truth for the set - the grid columns, the export headers and the export values are
 * all derived from it, so a key added or reordered here cannot shift the exported values out from under their
 * headers. `type` drives both the grid column type and the export formatting.
 *
 * These keys are also property names on `PermissionTableFieldCell` - the columns are built with
 * `setColumnFromType`, which reads `row[column.key]`, so the two must stay in sync.
 */
export const FIELD_AUDIT_COLUMNS = [
  { key: 'createdDate', label: 'Created Date', type: 'date' },
  { key: 'createdBy', label: 'Created By', type: 'text' },
  { key: 'lastModifiedDate', label: 'Last Modified Date', type: 'date' },
  { key: 'lastModifiedBy', label: 'Last Modified By', type: 'text' },
] as const;

export type FieldAuditColumn = (typeof FIELD_AUDIT_COLUMNS)[number];
export type FieldAuditColumnKey = FieldAuditColumn['key'];

export const FIELD_AUDIT_COLUMN_KEYS: readonly FieldAuditColumnKey[] = FIELD_AUDIT_COLUMNS.map(({ key }) => key);

export const FIELD_AUDIT_COLUMN_KEY_SET: ReadonlySet<string> = new Set<string>(FIELD_AUDIT_COLUMN_KEYS);

/** Export headers, in grid order. Shared by the csv and xlsx field generators. */
export const FIELD_AUDIT_EXPORT_HEADERS: string[] = FIELD_AUDIT_COLUMNS.map(({ label }) => label);

/**
 * Reads the persisted set of visible audit columns, ignoring anything unrecognized so a stale or
 * hand-edited value degrades to "hidden" instead of breaking the table.
 */
export function parseVisibleFieldAuditColumns(raw: Maybe<string>): Set<FieldAuditColumnKey> {
  const visibleColumns = new Set<FieldAuditColumnKey>();
  if (!raw) {
    return visibleColumns;
  }
  raw.split(',').forEach((part) => {
    const columnKey = part.trim();
    if (FIELD_AUDIT_COLUMN_KEY_SET.has(columnKey)) {
      visibleColumns.add(columnKey as FieldAuditColumnKey);
    }
  });
  return visibleColumns;
}

/** Serialized in `FIELD_AUDIT_COLUMNS` order so the stored value is stable regardless of toggle order. */
export function serializeVisibleFieldAuditColumns(visibleColumns: ReadonlySet<FieldAuditColumnKey>): string {
  return FIELD_AUDIT_COLUMN_KEYS.filter((columnKey) => visibleColumns.has(columnKey)).join(',');
}

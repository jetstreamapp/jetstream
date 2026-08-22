import { FieldAuditMetadata, Maybe } from '@jetstream/types';

/**
 * Optional audit columns on the field permissions table, in the order they appear in the grid and in exports.
 *
 * This is the single source of truth for the set - the grid columns, the export headers and the export values are
 * all derived from it, so a key added or reordered here cannot shift the exported values out from under their
 * headers. `type` drives both the grid column type and the export formatting.
 *
 * The keys are constrained to `FieldAuditMetadata` properties because `PermissionTableFieldCell` flattens that
 * interface onto the row and the columns are built with `setColumnFromType`, which reads `row[column.key]`.
 */
export const FIELD_AUDIT_COLUMNS = [
  { key: 'createdDate', label: 'Created Date', type: 'date' },
  { key: 'createdBy', label: 'Created By', type: 'text' },
  { key: 'lastModifiedDate', label: 'Last Modified Date', type: 'date' },
  { key: 'lastModifiedBy', label: 'Last Modified By', type: 'text' },
] as const satisfies readonly { key: keyof FieldAuditMetadata; label: string; type: 'date' | 'text' }[];

export type FieldAuditColumn = (typeof FIELD_AUDIT_COLUMNS)[number];
export type FieldAuditColumnKey = FieldAuditColumn['key'];

export const FIELD_AUDIT_COLUMN_KEYS: readonly FieldAuditColumnKey[] = FIELD_AUDIT_COLUMNS.map(({ key }) => key);

const FIELD_AUDIT_COLUMN_KEY_SET: ReadonlySet<string> = new Set<string>(FIELD_AUDIT_COLUMN_KEYS);

export function isFieldAuditColumnKey(key: string): key is FieldAuditColumnKey {
  return FIELD_AUDIT_COLUMN_KEY_SET.has(key);
}

/**
 * Export headers, in grid order. Shared by the csv and xlsx field generators.
 *
 * Audit timestamps are exported in the browser's local timezone with nothing on the value to say so - Excel has no
 * concept of a timezone, and an ISO offset would land in the file as text rather than a date - so the zone is named
 * in the header instead. The IANA name rather than an abbreviation like CDT, which would be wrong for any row on
 * the other side of a daylight saving change.
 */
export function getFieldAuditExportHeaders(): string[] {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return FIELD_AUDIT_COLUMNS.map(({ label, type }) => (type === 'date' && timeZone ? `${label} (${timeZone})` : label));
}

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
    if (isFieldAuditColumnKey(columnKey)) {
      visibleColumns.add(columnKey);
    }
  });
  return visibleColumns;
}

/** Serialized in `FIELD_AUDIT_COLUMNS` order so the stored value is stable regardless of toggle order. */
export function serializeVisibleFieldAuditColumns(visibleColumns: ReadonlySet<FieldAuditColumnKey>): string {
  return FIELD_AUDIT_COLUMN_KEYS.filter((columnKey) => visibleColumns.has(columnKey)).join(',');
}

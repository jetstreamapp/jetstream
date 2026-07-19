import { decodeHtmlEntity, getIdFromRecordUrl } from '@jetstream/shared/utils';
import { SobjectCollectionResponse } from '@jetstream/types';
import { RowSalesforceRecordWithKey } from './data-table-types';

/**
 * Shared builders for the inline query-grid edit exports. These are the single source of truth for
 * the per-record change/result row shapes used by BOTH the Preview Changes modal (download) and the
 * Data History capture, so the shapes never drift. Pure over the grid row model — `libs/ui` must NOT
 * import the data-history service, so the capture flow reuses these builders via a callback wired
 * from the feature layer.
 */

export function getRecordId(row: RowSalesforceRecordWithKey): string {
  const fromUrl = row._record?.attributes?.url ? getIdFromRecordUrl(row._record.attributes.url) : undefined;
  return fromUrl ?? row._record?.Id ?? '';
}

/** True when this record actually changed `columnKey` (touched AND its value differs from the original). */
export function rowChangedColumn(row: RowSalesforceRecordWithKey, columnKey: string): boolean {
  return row._touchedColumns instanceof Set && row._touchedColumns.has(columnKey) && row[columnKey] !== row._record?.[columnKey];
}

/** Union of every column changed across the dirty rows, in first-seen order. */
function getEditedColumns(dirtyRows: RowSalesforceRecordWithKey[]): string[] {
  const editedColumns: string[] = [];
  const seen = new Set<string>();
  dirtyRows.forEach((row) => {
    if (!(row._touchedColumns instanceof Set)) {
      return;
    }
    row._touchedColumns.forEach((columnKey) => {
      if (rowChangedColumn(row, columnKey) && !seen.has(columnKey)) {
        seen.add(columnKey);
        editedColumns.push(columnKey);
      }
    });
  });
  return editedColumns;
}

/**
 * Build a loadable export of the pending edits: one row per record, columns = Id + the union of every
 * edited field across records. Each row emits a value ONLY for the fields IT actually changed — the other
 * union columns stay blank — so the file is a true per-record diff rather than a dump of every field.
 * Reloading via Load Records re-applies exactly these changes (blank cells are no-ops when "insert null
 * values" is off).
 */
export function buildEditedRecordsExport(dirtyRows: RowSalesforceRecordWithKey[]): { data: Record<string, unknown>[]; header: string[] } {
  const editedColumns = getEditedColumns(dirtyRows);
  const header = ['Id', ...editedColumns];
  const data = dirtyRows.map((row) => {
    const record: Record<string, unknown> = { Id: getRecordId(row) };
    // Only emit a value for the columns THIS row changed; the rest stay blank (omitted) so the file shows
    // just what each record actually modified.
    editedColumns.forEach((columnKey) => {
      if (rowChangedColumn(row, columnKey)) {
        record[columnKey] = row[columnKey] ?? '';
      }
    });
    return record;
  });
  return { data, header };
}

/**
 * Build the PRIOR-value counterpart of `buildEditedRecordsExport`: one row per record with the original
 * (pre-edit) value of each changed field, so Data History can show a true before → after diff. Uses the
 * same column selection as the edited export so the two line up by index and column.
 */
export function buildPriorRecordsExport(dirtyRows: RowSalesforceRecordWithKey[]): { data: Record<string, unknown>[]; header: string[] } {
  const editedColumns = getEditedColumns(dirtyRows);
  const header = ['Id', ...editedColumns];
  const data = dirtyRows.map((row) => {
    const record: Record<string, unknown> = { Id: getRecordId(row) };
    editedColumns.forEach((columnKey) => {
      if (rowChangedColumn(row, columnKey)) {
        record[columnKey] = row._record?.[columnKey] ?? '';
      }
    });
    return record;
  });
  return { data, header };
}

/**
 * Build the post-save results export: each record's save outcome (`_id`/`_success`/`_errors`, matching
 * the Load Records results file) followed by the record data from the "Download Changes" export (Id +
 * every edited field) at the end. Rows zip to `saveResults` by index — the order they were submitted in.
 */
export function buildResultsExport(
  editedExport: { data: Record<string, unknown>[]; header: string[] },
  saveResults: SobjectCollectionResponse,
): { data: Record<string, unknown>[]; header: string[] } {
  const header = ['_id', '_success', '_errors', ...editedExport.header];
  const data = editedExport.data.map((record, index) => {
    const result = saveResults[index];
    return {
      _id: result?.id || (record.Id as string) || '',
      _success: result?.success ?? false,
      _errors:
        result && !result.success
          ? (result.errors?.map((error) => `${error.statusCode}: ${decodeHtmlEntity(error.message)}`).join('\n') ?? '')
          : '',
      ...record,
    };
  });
  return { data, header };
}

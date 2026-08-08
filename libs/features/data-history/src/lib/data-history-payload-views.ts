import { DataHistoryFileKind, DataHistoryItem } from '@jetstream/types';
import { parse as parseCsv } from 'papaparse';

/**
 * Normalization layer that turns any stored Data History payload (CSV or JSON, in the per-source
 * shapes documented below) into one or more tabular "views" so downloads, copy-to-clipboard, and the
 * in-modal previews all work from the same rows + header regardless of how the payload was captured.
 *
 * Stored payload shapes by source:
 * - CSV files (load-records input/results, mass-update results, multi-object results): tabular as-is
 * - `query-table-edit` request: `{ header, edited, prior }` -> TWO views (modified vs previous values)
 * - `mass-update*` request, `query-table-edit` results: array of flat records -> one view
 * - `record-modal` request: a single record object -> one single-row view
 * - everything else (multi-object request groups, error payloads, create-record results): not
 *   tabular; callers fall back to the raw JSON
 */

export interface DataHistoryPayloadView {
  id: 'data' | 'edited' | 'prior';
  label: string;
  header: string[];
  /** Raw (unflattened) row objects — flatten with `flattenPayloadRows` for CSV/Excel/table display */
  rows: Record<string, unknown>[];
}

/** The `{header, edited, prior}` request payload captured by inline query-grid edits */
interface EditedPriorPayload {
  header: string[];
  edited: Record<string, unknown>[];
  prior?: Record<string, unknown>[];
}

export const DATA_HISTORY_EDITED_VIEW_LABEL = 'Modified Values';
export const DATA_HISTORY_PRIOR_VIEW_LABEL = 'Previous Values';

/**
 * Byte cap for parsing a payload for format conversion (download as CSV/Excel/JSON, copy to
 * clipboard). Beyond this the payload is served in its original stored format instead — parsing
 * hundreds of MB into row objects on the main thread would freeze the tab.
 */
export const DATA_HISTORY_EXPORT_PARSE_MAX_BYTES = 64 * 1024 * 1024;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPrimitive(value: unknown): boolean {
  return value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isEditedPriorPayload(payload: unknown): payload is EditedPriorPayload {
  return (
    isPlainObject(payload) &&
    Array.isArray(payload.header) &&
    payload.header.every((column) => typeof column === 'string') &&
    Array.isArray(payload.edited) &&
    payload.edited.every(isPlainObject) &&
    (payload.prior == null || (Array.isArray(payload.prior) && payload.prior.every(isPlainObject)))
  );
}

/** Union of row keys in first-seen order, excluding the Salesforce `attributes` envelope */
function getHeaderFromRows(rows: Record<string, unknown>[]): string[] {
  const header: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key !== 'attributes' && !seen.has(key)) {
        seen.add(key);
        header.push(key);
      }
    });
  });
  return header;
}

/** Sample-check that rows are flat (all primitive values) — nested payloads read better as JSON */
function rowsAreTabular(rows: Record<string, unknown>[]): boolean {
  return rows.slice(0, 50).every((row) => Object.entries(row).every(([key, value]) => key === 'attributes' || isPrimitive(value)));
}

/**
 * Parse a JSON payload into tabular views. Returns an empty array when the payload has no useful
 * tabular representation (nested structures, error envelopes, single-field objects).
 */
export function parseJsonPayloadToViews(payload: unknown): DataHistoryPayloadView[] {
  if (isEditedPriorPayload(payload)) {
    const views: DataHistoryPayloadView[] = [
      { id: 'edited', label: DATA_HISTORY_EDITED_VIEW_LABEL, header: payload.header, rows: payload.edited },
    ];
    if (payload.prior?.length) {
      views.push({ id: 'prior', label: DATA_HISTORY_PRIOR_VIEW_LABEL, header: payload.header, rows: payload.prior });
    }
    return views;
  }
  if (Array.isArray(payload) && payload.length > 0 && payload.every(isPlainObject) && rowsAreTabular(payload)) {
    return [{ id: 'data', label: 'Records', header: getHeaderFromRows(payload), rows: payload }];
  }
  // Single-record payloads (record modal saves). Requiring 2+ keys keeps error envelopes like
  // `{error}` in the JSON view, where a message reads better than a one-cell table.
  if (isPlainObject(payload) && rowsAreTabular([payload]) && getHeaderFromRows([payload]).length > 1) {
    return [{ id: 'data', label: 'Record', header: getHeaderFromRows([payload]), rows: [payload] }];
  }
  return [];
}

/**
 * Parse a payload's text into tabular views. CSV payloads always yield exactly one view; JSON
 * payloads yield 0-2 depending on shape (see `parseJsonPayloadToViews`).
 */
export function parseDataHistoryPayloadViews(
  text: string,
  contentType: 'text/csv' | 'application/json',
  options?: { maxCsvRows?: number },
): DataHistoryPayloadView[] {
  if (contentType === 'text/csv') {
    const { data, meta } = parseCsv<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      ...(options?.maxCsvRows ? { preview: options.maxCsvRows } : {}),
    });
    const header = meta.fields ?? [];
    if (header.length === 0) {
      return [];
    }
    return [{ id: 'data', label: 'Records', header, rows: data }];
  }
  try {
    return parseJsonPayloadToViews(JSON.parse(text));
  } catch {
    return [];
  }
}

/**
 * Flatten view rows for spreadsheet output or table display: nested objects/arrays become JSON
 * strings, null/undefined become empty strings, and only header columns are emitted (in header
 * order) so every row has the same columns.
 */
export function flattenPayloadRows(rows: Record<string, unknown>[], header: string[]): Record<string, unknown>[] {
  return rows.map((row) =>
    header.reduce<Record<string, unknown>>((acc, column) => {
      const value = row[column];
      if (value == null) {
        acc[column] = '';
      } else if (isPrimitive(value)) {
        acc[column] = value;
      } else {
        acc[column] = JSON.stringify(value);
      }
      return acc;
    }, {}),
  );
}

/**
 * The downloadable/copyable data choices for an entry — one per file kind, except the inline
 * query-grid edit request which is split into its modified/previous variants so users can re-load
 * the changes or recover the pre-edit values.
 */
export interface DataHistoryExportTarget {
  kind: DataHistoryFileKind;
  /** Which view within the payload (only set when a payload holds multiple, e.g. edited vs prior) */
  viewId?: 'edited' | 'prior';
  label: string;
  /** Filename fragment, e.g. `results` or `modified-values` */
  slug: string;
}

/** Resolve the view an export target refers to within a parsed payload */
export function findViewForTarget(views: DataHistoryPayloadView[], target: Pick<DataHistoryExportTarget, 'viewId'>) {
  return target.viewId ? views.find((view) => view.id === target.viewId) : views[0];
}

export function isQueryTableEditRequest(item: DataHistoryItem, kind: DataHistoryFileKind): boolean {
  return kind === 'request' && item.source === 'query-table-edit';
}

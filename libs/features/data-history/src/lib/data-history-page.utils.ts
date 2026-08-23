import {
  BadgeType,
  DataHistoryApi,
  DataHistoryFileKind,
  DataHistoryItem,
  DataHistoryOperation,
  DataHistorySource,
  DataHistoryStatus,
  Maybe,
} from '@jetstream/types';
import { ColumnWithFilter } from '@jetstream/ui';
import { formatDate } from 'date-fns/format';
import { filesize } from 'filesize';
import {
  DATA_HISTORY_EDITED_VIEW_LABEL,
  DATA_HISTORY_PRIOR_VIEW_LABEL,
  DataHistoryExportTarget,
  DataHistoryPayloadView,
  flattenPayloadRows,
  isQueryTableEditRequest,
} from './data-history-payload-views';

export const DATA_HISTORY_SOURCE_LABELS: Record<DataHistorySource, string> = {
  'load-records': 'Load Records',
  'load-multi-object': 'Load Records to Multiple Objects',
  'mass-update': 'Update Records Without a File',
  'mass-update-from-query': 'Bulk Update From Query',
  'query-table-edit': 'Query Results Edit',
  'record-modal': 'Record Modal',
  'create-record': 'Create Record',
};

export const DATA_HISTORY_STATUS_LABELS: Record<DataHistoryStatus, string> = {
  'in-progress': 'In Progress',
  success: 'Success',
  partial: 'Partial Success',
  failed: 'Failed',
  incomplete: 'Incomplete',
};

const DATA_HISTORY_FILE_KIND_LABELS: Record<DataHistoryFileKind, string> = {
  input: 'Input Data',
  request: 'Request',
  results: 'Output Data',
};

export const DATA_HISTORY_API_LABELS: Record<DataHistoryApi, string> = {
  'bulk-v1': 'Bulk API',
  'batch-composite': 'Batch API',
  'composite-graph': 'Composite Graph API',
  collections: 'Collections API',
};

export const DATA_HISTORY_OPERATION_LABELS: Record<DataHistoryOperation, string> = {
  insert: 'Insert',
  update: 'Update',
  upsert: 'Upsert',
  delete: 'Delete',
  create: 'Create',
  edit: 'Edit',
  clone: 'Clone',
  mixed: 'Mixed',
};

export interface DataHistoryTableRow {
  _dhRowKey: string;
  [column: string]: string;
}

export interface DataHistoryTableData {
  columns: ColumnWithFilter<DataHistoryTableRow>[];
  rows: DataHistoryTableRow[];
  /** True when the payload had more rows than the preview cap and only the head is shown */
  truncated: boolean;
}

/** Cap on rows shown in the in-modal preview — the full file is always available via download */
export const DATA_HISTORY_CSV_PREVIEW_MAX_ROWS = 5000;

/**
 * Cap on BYTES read from a payload for the in-modal preview. Request payloads contain every record
 * that was submitted (a large mass update runs to hundreds of MB), so the preview must never
 * materialize the whole file as a string — the row/char caps below only apply after that has already
 * happened. Downloads always read the full file.
 */
export const DATA_HISTORY_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Build rows + column definitions for the generic `DataTable` from a parsed payload view. Column
 * order matches the view header; a synthetic `_dhRowKey` is added for stable row identity (a column
 * literally named `_dhRowKey` would collide, which no Salesforce/results file produces).
 *
 * Rows are capped at `maxRows` so the preview on a huge payload never blocks the main thread
 * building hundreds of thousands of row objects — the download path reads the full, uncapped file.
 *
 * Pass `isPartialRead` when the view was parsed from only the head of the file (see
 * `DATA_HISTORY_PREVIEW_MAX_BYTES`): the last row is then almost certainly cut mid-record, so it is
 * dropped rather than shown as a row with missing values.
 */
/** Default width for a payload preview column — see the note in `buildTableFromPayloadView` */
export const DATA_HISTORY_PREVIEW_COLUMN_WIDTH = 220;
export const DATA_HISTORY_PREVIEW_COLUMN_MIN_WIDTH = 120;

export function buildTableFromPayloadView(
  view: DataHistoryPayloadView,
  maxRows: number = DATA_HISTORY_CSV_PREVIEW_MAX_ROWS,
  isPartialRead = false,
): DataHistoryTableData {
  const columns: ColumnWithFilter<DataHistoryTableRow>[] = view.header.map((field) => ({
    key: field,
    name: field,
    sortable: true,
    resizable: true,
    // Payload columns are arbitrary Salesforce fields, so nothing here can size them from content.
    // Without an explicit width a wide record splits into columns too narrow to read, and — because
    // the preview grid uses auto row height — a long value then wraps into a very tall row.
    width: DATA_HISTORY_PREVIEW_COLUMN_WIDTH,
    minWidth: DATA_HISTORY_PREVIEW_COLUMN_MIN_WIDTH,
    getValue: ({ row }) => row[field] ?? '',
  }));
  const overRowCap = view.rows.length > maxRows;
  let visibleRows = overRowCap ? view.rows.slice(0, maxRows) : view.rows;
  // A partially-read file ends mid-row; drop that fragment unless the row cap already cut it off
  if (isPartialRead && !overRowCap && visibleRows.length > 0) {
    visibleRows = visibleRows.slice(0, -1);
  }
  const rows: DataHistoryTableRow[] = flattenPayloadRows(visibleRows, view.header).map((row, index) => {
    const tableRow: DataHistoryTableRow = { _dhRowKey: String(index) };
    view.header.forEach((column) => {
      const value = row[column];
      tableRow[column] = typeof value === 'string' ? value : String(value);
    });
    return tableRow;
  });
  return { columns, rows, truncated: overRowCap || isPartialRead };
}

export function getDataHistoryStatusBadgeType(status: DataHistoryStatus): BadgeType {
  switch (status) {
    case 'success': {
      return 'success';
    }
    case 'partial': {
      return 'warning';
    }
    case 'failed': {
      return 'error';
    }
    case 'in-progress': {
      return 'light';
    }
    case 'incomplete': {
      return 'inverse';
    }
  }
}

export function formatDataHistoryCounts(item: DataHistoryItem): string {
  const { total, success, failure } = item.counts;
  if (total === 0) {
    return '—';
  }
  // No per-record outcome recorded — still running, abandoned/reclassified as `incomplete`, or
  // `fail()`ed before any result came back. Only the submitted total (`setSubmittedCount`) is known.
  if (success + failure === 0) {
    return `${total.toLocaleString()} submitted`;
  }
  let text = `${success.toLocaleString()} of ${total.toLocaleString()} succeeded`;
  if (failure > 0) {
    text += ` • ${failure.toLocaleString()} failed`;
  }
  return text;
}

export function formatDataHistorySize(sizeBytes: number): string {
  return sizeBytes > 0 ? String(filesize(sizeBytes, { round: 1 })) : '—';
}

export function formatDataHistoryDate(date: Maybe<Date>): string {
  return date ? formatDate(date, 'MMM d, yyyy h:mm a') : '—';
}

/**
 * On-disk folder holding an entry's files, relative to the history root — shown for user-visible
 * backends (user-chosen folder, desktop native) so entries can be matched to what the user sees in
 * their file manager. Null for OPFS entries, where the location is browser-internal.
 */
export function getDataHistoryEntryFolderPath(item: DataHistoryItem): string | null {
  if (item.storageBackend === 'opfs' || item.files.length === 0) {
    return null;
  }
  return item.files[0].path.split('/').slice(0, -1).join('/') || null;
}

/** Label for a payload kind, with a friendlier name for the inline query-grid edit request */
export function getDataHistoryFileKindLabel(item: DataHistoryItem, kind: DataHistoryFileKind): string {
  if (isQueryTableEditRequest(item, kind)) {
    return 'Changes';
  }
  return DATA_HISTORY_FILE_KIND_LABELS[kind];
}

/** The payload kinds that can be viewed/downloaded for an entry — one per stored file */
export function getAvailableFileKinds(item: DataHistoryItem): Array<{ kind: DataHistoryFileKind; label: string; bytes?: number }> {
  return item.files.map(({ kind, bytes }) => ({ kind, label: getDataHistoryFileKindLabel(item, kind), bytes }));
}

/**
 * Downloadable/copyable data choices for an entry. Most payloads are one target per kind; the
 * inline query-grid edit request splits into Modified Values (re-loadable to re-apply the changes)
 * and Previous Values (the pre-edit state, for recovery).
 */
export function getDataHistoryExportTargets(item: DataHistoryItem): DataHistoryExportTarget[] {
  return getAvailableFileKinds(item).flatMap<DataHistoryExportTarget>(({ kind, label }) => {
    if (isQueryTableEditRequest(item, kind)) {
      return [
        { kind, viewId: 'edited', label: DATA_HISTORY_EDITED_VIEW_LABEL, slug: 'modified-values' },
        { kind, viewId: 'prior', label: DATA_HISTORY_PRIOR_VIEW_LABEL, slug: 'previous-values' },
      ];
    }
    return [{ kind, label, slug: kind }];
  });
}

/**
 * Download name like `load-records_Account_2026-07-19_1305_results.csv` — the stored fileName has
 * its `.gz` suffix stripped because downloads are decompressed.
 */
export function getDataHistoryDownloadFileName(item: DataHistoryItem, fileName: string): string {
  const datePart = formatDate(item.createdAt, 'yyyy-MM-dd_HHmm');
  const objectPart = item.sobjects.slice(0, 2).join('_') || 'records';
  return `${item.source}_${objectPart}_${datePart}_${fileName.replace(/\.gz$/, '')}`;
}

export interface DataHistoryConfigDisplayItem {
  label: string;
  value: string;
}

function formatConfigValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return String(value);
}

/**
 * Allowlisted, labeled fields from an entry's raw `config` snapshot for the detail modal. Anything
 * not listed here is internal bookkeeping (analytics mirrors, header echoes, retry internals) and is
 * intentionally not displayed — the raw config stays stored on the entry untouched.
 */
const CONFIG_DISPLAY_FIELDS: Array<{
  key: string;
  label: string;
  /** Skip the row entirely (e.g. flags that are only interesting when true) */
  show?: (value: unknown, config: Record<string, unknown>) => boolean;
  format?: (value: unknown, config: Record<string, unknown>) => string;
}> = [
  {
    key: 'loadType',
    label: 'Load Type',
    format: (value) => DATA_HISTORY_OPERATION_LABELS[String(value).toLowerCase() as DataHistoryOperation] ?? String(value),
  },
  {
    key: 'apiMode',
    label: 'API Mode',
    format: (value) => (value === 'BULK' ? 'Bulk API' : value === 'BATCH' ? 'Batch API' : String(value)),
  },
  { key: 'batchSize', label: 'Batch Size' },
  { key: 'serialMode', label: 'Serial Mode' },
  { key: 'recordLimit', label: 'Record Limit' },
  { key: 'insertNulls', label: 'Insert Null Values' },
  // Only meaningful when a date field was part of the load
  { key: 'dateFormat', label: 'Date Format', show: (_, config) => config.hasDateFieldMapped !== false },
  { key: 'isTrialRun', label: 'Trial Run', show: (value) => value === true },
  { key: 'trialRunSize', label: 'Trial Run Records', show: (_, config) => config.isTrialRun === true },
  { key: 'hasZipAttachment', label: 'Includes ZIP Attachments', show: (value) => value === true },
  { key: 'isRetry', label: 'Retry of a Previous Load', show: (value) => value === true },
  { key: 'retryCount', label: 'Retry Attempt', show: (_, config) => config.isRetry === true },
  { key: 'numGroups', label: 'Record Groups' },
  {
    key: 'transformations',
    label: 'Updated Fields',
    show: (value) => Array.isArray(value) && value.length > 0,
    format: (value) =>
      (value as Array<{ field?: unknown }>)
        .map(({ field }) => field)
        .filter(Boolean)
        .join(', '),
  },
];

/** User-friendly rows for the detail modal's Configuration section; empty when nothing is worth showing */
export function getDataHistoryConfigDisplayItems(item: DataHistoryItem): DataHistoryConfigDisplayItem[] {
  const config = item.config ?? {};
  return CONFIG_DISPLAY_FIELDS.filter(({ key, show }) => config[key] != null && (!show || show(config[key], config))).map(
    ({ key, label, format }) => ({
      label,
      value: format ? format(config[key], config) : formatConfigValue(config[key]),
    }),
  );
}

const PREVIEW_MAX_LINES = 200;
const PREVIEW_MAX_CHARS = 100_000;

/** Head of a payload for on-demand preview — never renders unbounded content into the DOM */
export function buildDataHistoryPreviewText(content: string): { text: string; truncated: boolean } {
  let text = content;
  let truncated = false;
  if (text.length > PREVIEW_MAX_CHARS) {
    text = text.slice(0, PREVIEW_MAX_CHARS);
    truncated = true;
  }
  const lines = text.split('\n');
  if (lines.length > PREVIEW_MAX_LINES) {
    text = lines.slice(0, PREVIEW_MAX_LINES).join('\n');
    truncated = true;
  }
  return { text, truncated };
}

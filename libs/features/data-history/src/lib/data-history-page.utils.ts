import { BadgeType, DataHistoryFileKind, DataHistoryItem, DataHistorySource, DataHistoryStatus, ListItem, Maybe } from '@jetstream/types';
import { formatDate } from 'date-fns/format';
import { filesize } from 'filesize';

export const DATA_HISTORY_SOURCE_LABELS: Record<DataHistorySource, string> = {
  'load-records': 'Load Records',
  'load-custom-metadata': 'Load Custom Metadata',
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
  request: 'Request Payload',
  results: 'Results',
};

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

export function getDataHistorySourceListItems(): ListItem[] {
  return Object.entries(DATA_HISTORY_SOURCE_LABELS).map(([value, label]) => ({ id: value, label, value }));
}

export function getDataHistoryStatusListItems(): ListItem[] {
  return Object.entries(DATA_HISTORY_STATUS_LABELS).map(([value, label]) => ({ id: value, label, value }));
}

export function formatDataHistoryCounts(item: DataHistoryItem): string {
  const { total, success, failure } = item.counts;
  if (item.status === 'in-progress' || item.status === 'incomplete') {
    return total > 0 ? `${total.toLocaleString()} submitted` : '—';
  }
  if (total === 0) {
    return '—';
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
 * The payload kinds that can be viewed/downloaded for an entry — file-backed entries expose their
 * file refs; inline entries always expose request + results (decoded from `inlinePayload`).
 */
export function getAvailableFileKinds(item: DataHistoryItem): Array<{ kind: DataHistoryFileKind; label: string; bytes?: number }> {
  if (item.files.length > 0) {
    return item.files.map(({ kind, bytes }) => ({ kind, label: DATA_HISTORY_FILE_KIND_LABELS[kind], bytes }));
  }
  if (item.inlinePayload) {
    return [
      { kind: 'request', label: DATA_HISTORY_FILE_KIND_LABELS.request },
      { kind: 'results', label: DATA_HISTORY_FILE_KIND_LABELS.results },
    ];
  }
  return [];
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

export type DataHistorySortColumn = 'date' | 'org' | 'source' | 'sobjects' | 'status' | 'records';

export interface DataHistorySort {
  column: DataHistorySortColumn;
  direction: 'asc' | 'desc';
}

const SORT_VALUE_EXTRACTORS: Record<DataHistorySortColumn, (item: DataHistoryItem) => string | number> = {
  date: (item) => item.createdAt.getTime(),
  org: (item) => item.orgLabel.toLocaleLowerCase(),
  source: (item) => DATA_HISTORY_SOURCE_LABELS[item.source].toLocaleLowerCase(),
  sobjects: (item) => item.sobjects.join(',').toLocaleLowerCase(),
  status: (item) => DATA_HISTORY_STATUS_LABELS[item.status].toLocaleLowerCase(),
  records: (item) => item.counts.total,
};

/** Client-side sort of the (already limited) visible entries — non-mutating */
export function sortDataHistoryItems(items: DataHistoryItem[], sort: DataHistorySort): DataHistoryItem[] {
  const getValue = SORT_VALUE_EXTRACTORS[sort.column];
  const modifier = sort.direction === 'asc' ? 1 : -1;
  return [...items].sort((itemA, itemB) => {
    const valueA = getValue(itemA);
    const valueB = getValue(itemB);
    if (valueA < valueB) {
      return -1 * modifier;
    }
    if (valueA > valueB) {
      return 1 * modifier;
    }
    return 0;
  });
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

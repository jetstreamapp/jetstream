import { DataHistoryItem, DataHistorySource, DataHistoryStatus } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  buildDataHistoryPreviewText,
  DATA_HISTORY_SOURCE_LABELS,
  DATA_HISTORY_STATUS_LABELS,
  formatDataHistoryCounts,
  formatDataHistorySize,
  getAvailableFileKinds,
  getDataHistoryDownloadFileName,
  getDataHistorySourceListItems,
  getDataHistoryStatusBadgeType,
  sortDataHistoryItems,
} from '../data-history-page.utils';

function buildItem(overrides: Partial<DataHistoryItem> = {}): DataHistoryItem {
  const now = new Date(2026, 6, 19, 13, 5, 0);
  return {
    key: 'dh_test',
    org: 'org-1',
    orgLabel: 'Org 1',
    source: 'load-records',
    operation: 'insert',
    api: 'bulk-v1',
    sobjects: ['Account'],
    status: 'success',
    counts: { total: 10, success: 10, failure: 0 },
    config: {},
    files: [],
    storageBackend: 'opfs',
    sizeBytes: 0,
    inlinePayload: null,
    pinned: false,
    pinnedIdx: 'false',
    errorMessage: null,
    startedAt: now,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('labels and badges', () => {
  it('has a label for every source and status', () => {
    const sources: DataHistorySource[] = [
      'load-records',
      'load-custom-metadata',
      'load-multi-object',
      'mass-update',
      'mass-update-from-query',
      'query-table-edit',
      'record-modal',
      'create-record',
    ];
    sources.forEach((source) => expect(DATA_HISTORY_SOURCE_LABELS[source]).toBeTruthy());
    const statuses: DataHistoryStatus[] = ['in-progress', 'success', 'partial', 'failed', 'incomplete'];
    statuses.forEach((status) => {
      expect(DATA_HISTORY_STATUS_LABELS[status]).toBeTruthy();
      expect(getDataHistoryStatusBadgeType(status)).toBeTruthy();
    });
  });

  it('builds list items from labels', () => {
    const items = getDataHistorySourceListItems();
    expect(items.length).toBe(Object.keys(DATA_HISTORY_SOURCE_LABELS).length);
    expect(items[0]).toEqual({ id: 'load-records', label: 'Load Records', value: 'load-records' });
  });
});

describe('formatDataHistoryCounts', () => {
  it('formats success and mixed outcomes', () => {
    expect(formatDataHistoryCounts(buildItem())).toBe('10 of 10 succeeded');
    expect(formatDataHistoryCounts(buildItem({ status: 'partial', counts: { total: 10, success: 7, failure: 3 } }))).toBe(
      '7 of 10 succeeded • 3 failed',
    );
  });

  it('handles in-progress, incomplete, and empty counts', () => {
    expect(formatDataHistoryCounts(buildItem({ status: 'in-progress', counts: { total: 5, success: 0, failure: 0 } }))).toBe('5 submitted');
    expect(formatDataHistoryCounts(buildItem({ status: 'incomplete', counts: { total: 0, success: 0, failure: 0 } }))).toBe('—');
    expect(formatDataHistoryCounts(buildItem({ status: 'failed', counts: { total: 0, success: 0, failure: 0 } }))).toBe('—');
  });
});

describe('formatDataHistorySize', () => {
  it('formats bytes and treats zero as empty', () => {
    expect(formatDataHistorySize(0)).toBe('—');
    expect(formatDataHistorySize(1024 * 1024)).toContain('MB');
  });
});

describe('getAvailableFileKinds', () => {
  it('prefers file refs when present', () => {
    const item = buildItem({
      files: [
        { kind: 'input', path: 'o/e/input.csv.gz', fileName: 'input.csv.gz', contentType: 'text/csv', compressed: true, bytes: 10 },
        { kind: 'results', path: 'o/e/results.csv.gz', fileName: 'results.csv.gz', contentType: 'text/csv', compressed: true, bytes: 20 },
      ],
    });
    expect(getAvailableFileKinds(item).map(({ kind }) => kind)).toEqual(['input', 'results']);
  });

  it('exposes request+results for inline entries and nothing when no data', () => {
    expect(getAvailableFileKinds(buildItem({ inlinePayload: new Uint8Array([1]) })).map(({ kind }) => kind)).toEqual([
      'request',
      'results',
    ]);
    expect(getAvailableFileKinds(buildItem())).toEqual([]);
  });
});

describe('getDataHistoryDownloadFileName', () => {
  it('builds a descriptive name and strips .gz', () => {
    const item = buildItem({ sobjects: ['Account', 'Contact', 'Lead'] });
    expect(getDataHistoryDownloadFileName(item, 'results.csv.gz')).toBe('load-records_Account_Contact_2026-07-19_1305_results.csv');
  });

  it('falls back when no sobjects exist', () => {
    expect(getDataHistoryDownloadFileName(buildItem({ sobjects: [] }), 'request.json.gz')).toBe(
      'load-records_records_2026-07-19_1305_request.json',
    );
  });
});

describe('buildDataHistoryPreviewText', () => {
  it('passes small content through untouched', () => {
    expect(buildDataHistoryPreviewText('a\nb')).toEqual({ text: 'a\nb', truncated: false });
  });

  it('truncates by line count and by characters', () => {
    const manyLines = Array.from({ length: 500 }, (_, i) => `line-${i}`).join('\n');
    const byLines = buildDataHistoryPreviewText(manyLines);
    expect(byLines.truncated).toBe(true);
    expect(byLines.text.split('\n')).toHaveLength(200);

    const hugeSingleLine = 'x'.repeat(200_000);
    const byChars = buildDataHistoryPreviewText(hugeSingleLine);
    expect(byChars.truncated).toBe(true);
    expect(byChars.text.length).toBe(100_000);
  });
});

describe('sortDataHistoryItems', () => {
  it('sorts by date and label columns in both directions without mutating input', () => {
    const older = buildItem({ key: 'a', createdAt: new Date(2026, 0, 1), sizeBytes: 50, orgLabel: 'Zeta', sobjects: ['Lead'] });
    const newer = buildItem({ key: 'b', createdAt: new Date(2026, 5, 1), sizeBytes: 10, orgLabel: 'alpha', sobjects: ['Account'] });
    const items = [older, newer];

    expect(sortDataHistoryItems(items, { column: 'date', direction: 'desc' }).map(({ key }) => key)).toEqual(['b', 'a']);
    expect(sortDataHistoryItems(items, { column: 'date', direction: 'asc' }).map(({ key }) => key)).toEqual(['a', 'b']);
    // org label sorting is case-insensitive
    expect(sortDataHistoryItems(items, { column: 'org', direction: 'asc' }).map(({ key }) => key)).toEqual(['b', 'a']);
    expect(sortDataHistoryItems(items, { column: 'sobjects', direction: 'asc' }).map(({ key }) => key)).toEqual(['b', 'a']);
    // input untouched
    expect(items.map(({ key }) => key)).toEqual(['a', 'b']);
  });
});

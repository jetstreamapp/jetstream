import { DataHistoryApi, DataHistoryItem, DataHistoryOperation, DataHistorySource, DataHistoryStatus } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  buildDataHistoryPreviewText,
  buildTableFromPayloadView,
  DATA_HISTORY_API_LABELS,
  DATA_HISTORY_OPERATION_LABELS,
  DATA_HISTORY_PREVIEW_COLUMN_MIN_WIDTH,
  DATA_HISTORY_PREVIEW_COLUMN_WIDTH,
  DATA_HISTORY_SOURCE_LABELS,
  DATA_HISTORY_STATUS_LABELS,
  formatDataHistoryCounts,
  formatDataHistorySize,
  getAvailableFileKinds,
  getDataHistoryConfigDisplayItems,
  getDataHistoryDownloadFileName,
  getDataHistoryExportTargets,
  getDataHistoryStatusBadgeType,
} from '../data-history-page.utils';
import { flattenPayloadRows, parseDataHistoryPayloadViews, parseJsonPayloadToViews } from '../data-history-payload-views';

function parseCsvToTable(csvText: string, maxRows = 5000, isPartialRead = false) {
  // Preview flow: parse one extra row so truncation is detectable, then cap while building the table
  const [view] = parseDataHistoryPayloadViews(csvText, 'text/csv', { maxCsvRows: maxRows + 1 });
  return buildTableFromPayloadView(view, maxRows, isPartialRead);
}

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

  it('has a label for every api and operation', () => {
    const apis: DataHistoryApi[] = ['bulk-v1', 'batch-composite', 'composite-graph', 'collections'];
    apis.forEach((api) => expect(DATA_HISTORY_API_LABELS[api]).toBeTruthy());
    const operations: DataHistoryOperation[] = ['insert', 'update', 'upsert', 'delete', 'create', 'edit', 'clone', 'mixed'];
    operations.forEach((operation) => expect(DATA_HISTORY_OPERATION_LABELS[operation]).toBeTruthy());
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

  it('exposes nothing when the entry has no files', () => {
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

describe('parseJsonPayloadToViews', () => {
  it('splits the query-grid edit request into modified and previous views', () => {
    const views = parseJsonPayloadToViews({
      header: ['Id', 'Phone'],
      edited: [{ Id: '001', Phone: '555-5555' }],
      prior: [{ Id: '001', Phone: '(512) 757-6000' }],
    });
    expect(views.map(({ id }) => id)).toEqual(['edited', 'prior']);
    expect(views[0].label).toBe('Modified Values');
    expect(views[0].header).toEqual(['Id', 'Phone']);
    expect(views[0].rows).toEqual([{ Id: '001', Phone: '555-5555' }]);
    expect(views[1].label).toBe('Previous Values');
    expect(views[1].rows).toEqual([{ Id: '001', Phone: '(512) 757-6000' }]);
  });

  it('omits the previous-values view when prior data is empty', () => {
    const views = parseJsonPayloadToViews({ header: ['Id'], edited: [{ Id: '001' }], prior: [] });
    expect(views.map(({ id }) => id)).toEqual(['edited']);
  });

  it('builds a single view from an array of flat records with a union header (attributes excluded)', () => {
    const views = parseJsonPayloadToViews([
      { attributes: { type: 'Account' }, Id: '001', Name: 'Acme' },
      { Id: '002', Industry: 'Tech' },
    ]);
    expect(views).toHaveLength(1);
    expect(views[0].header).toEqual(['Id', 'Name', 'Industry']);
    expect(views[0].rows).toHaveLength(2);
  });

  it('builds a single-row view from a flat record object', () => {
    const views = parseJsonPayloadToViews({ Id: '001', Name: 'Acme' });
    expect(views).toHaveLength(1);
    expect(views[0].rows).toEqual([{ Id: '001', Name: 'Acme' }]);
  });

  it('returns nothing for nested or non-tabular payloads', () => {
    // Multi-object request groups hold nested data — a table of JSON blobs reads worse than JSON
    expect(parseJsonPayloadToViews([{ groupId: 'g1', data: [{ Id: '001' }] }])).toEqual([]);
    // Error envelopes and single-field objects read better as JSON
    expect(parseJsonPayloadToViews({ error: 'It broke' })).toEqual([]);
    expect(parseJsonPayloadToViews('not an object')).toEqual([]);
    expect(parseJsonPayloadToViews([])).toEqual([]);
  });
});

describe('flattenPayloadRows', () => {
  it('emits header columns in order, JSON-stringifies nested values, and blanks null/undefined', () => {
    const rows = flattenPayloadRows([{ b: { nested: true }, a: 1, c: null }], ['a', 'b', 'c', 'd']);
    expect(rows).toEqual([{ a: 1, b: '{"nested":true}', c: '', d: '' }]);
  });
});

describe('getDataHistoryExportTargets', () => {
  it('returns one target per kind for normal entries', () => {
    const item = buildItem({
      files: [
        { kind: 'input', path: 'o/e/input.csv.gz', fileName: 'input.csv.gz', contentType: 'text/csv', compressed: true, bytes: 10 },
        { kind: 'results', path: 'o/e/results.csv.gz', fileName: 'results.csv.gz', contentType: 'text/csv', compressed: true, bytes: 20 },
      ],
    });
    expect(getDataHistoryExportTargets(item)).toEqual([
      { kind: 'input', label: 'Input Data', slug: 'input' },
      { kind: 'results', label: 'Output Data', slug: 'results' },
    ]);
  });

  it('splits the query-grid edit request into modified and previous targets', () => {
    const item = buildItem({
      source: 'query-table-edit',
      files: [
        {
          kind: 'request',
          path: 'o/e/request.json.gz',
          fileName: 'request.json.gz',
          contentType: 'application/json',
          compressed: true,
          bytes: 10,
        },
        {
          kind: 'results',
          path: 'o/e/results.json.gz',
          fileName: 'results.json.gz',
          contentType: 'application/json',
          compressed: true,
          bytes: 20,
        },
      ],
    });
    expect(getDataHistoryExportTargets(item)).toEqual([
      { kind: 'request', viewId: 'edited', label: 'Modified Values', slug: 'modified-values' },
      { kind: 'request', viewId: 'prior', label: 'Previous Values', slug: 'previous-values' },
      { kind: 'results', label: 'Output Data', slug: 'results' },
    ]);
  });
});

describe('getDataHistoryConfigDisplayItems', () => {
  it('labels known load-records config fields and hides internal ones', () => {
    const item = buildItem({
      config: {
        loadType: 'UPDATE',
        apiMode: 'BULK',
        numRecords: 1,
        batchSize: 10000,
        insertNulls: false,
        serialMode: false,
        hasDateFieldMapped: false,
        dateFormat: 'MM/DD/YYYY',
        trialRun: false,
        trialRunSize: 1,
        hasZipAttachment: false,
        timesSameDataSubmitted: 1,
        numStaticFields: 0,
      },
    });
    expect(getDataHistoryConfigDisplayItems(item)).toEqual([
      { label: 'Load Type', value: 'Update' },
      { label: 'API Mode', value: 'Bulk API' },
      { label: 'Batch Size', value: '10,000' },
      { label: 'Serial Mode', value: 'No' },
      { label: 'Insert Null Values', value: 'No' },
    ]);
  });

  it('shows the date format only when a date field was mapped', () => {
    const item = buildItem({ config: { hasDateFieldMapped: true, dateFormat: 'MM/DD/YYYY' } });
    expect(getDataHistoryConfigDisplayItems(item)).toEqual([{ label: 'Date Format', value: 'MM/DD/YYYY' }]);
  });

  it('summarizes mass-update transformations as the list of updated fields', () => {
    const item = buildItem({
      source: 'mass-update',
      config: {
        serialMode: true,
        batchSize: 5000,
        numRecords: 7,
        transformations: [
          { field: 'Phone', option: 'staticValue', criteria: 'all' },
          { field: 'Fax', option: 'anotherField', criteria: 'onlyIfBlankOrNull' },
        ],
      },
    });
    expect(getDataHistoryConfigDisplayItems(item)).toEqual([
      { label: 'Batch Size', value: '5,000' },
      { label: 'Serial Mode', value: 'Yes' },
      { label: 'Updated Fields', value: 'Phone, Fax' },
    ]);
  });

  it('returns nothing for configs with no user-meaningful fields', () => {
    // query-table-edit config only echoes numRecords + header, neither of which is worth a row
    expect(getDataHistoryConfigDisplayItems(buildItem({ config: { numRecords: 7, header: ['Id', 'Phone'] } }))).toEqual([]);
    expect(getDataHistoryConfigDisplayItems(buildItem({ config: {} }))).toEqual([]);
  });
});

describe('parseCsvToTable', () => {
  it('builds columns from the header and rows with stable synthetic keys', () => {
    const { columns, rows } = parseCsvToTable('Name,Industry\nAcme,Tech\n"Globex, Inc",Energy');
    expect(columns.map(({ key }) => key)).toEqual(['Name', 'Industry']);
    expect(columns.map(({ name }) => name)).toEqual(['Name', 'Industry']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ Name: 'Acme', Industry: 'Tech', _dhRowKey: '0' });
    expect(rows[1]).toMatchObject({ Name: 'Globex, Inc', Industry: 'Energy', _dhRowKey: '1' });
    // getValue reads the row's value for the column
    expect(columns[0].getValue?.({ row: rows[0], column: columns[0] })).toBe('Acme');
  });

  it('handles a header-only CSV with no data rows', () => {
    const { columns, rows, truncated } = parseCsvToTable('_id,_success,_errors\n');
    expect(columns.map(({ key }) => key)).toEqual(['_id', '_success', '_errors']);
    expect(rows).toHaveLength(0);
    expect(truncated).toBe(false);
  });

  it('caps rows at the preview limit and flags truncation', () => {
    const csv = ['Name', ...Array.from({ length: 10 }, (_unused, index) => `row-${index}`)].join('\n');
    const { rows, truncated } = parseCsvToTable(csv, 4);
    expect(rows).toHaveLength(4);
    expect(truncated).toBe(true);
  });

  it('does not flag truncation when the row count is within the limit', () => {
    const csv = ['Name', 'a', 'b', 'c'].join('\n');
    const { rows, truncated } = parseCsvToTable(csv, 4);
    expect(rows).toHaveLength(3);
    expect(truncated).toBe(false);
  });

  it('drops the trailing partial row and flags truncation when only the head of the file was read', () => {
    // 'Wid' is a row cut mid-value by the byte cap — showing it would misrepresent the saved data
    const { rows, truncated } = parseCsvToTable('Name,Industry\nAcme,Tech\nWid', 4, true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ Name: 'Acme', Industry: 'Tech' });
    expect(truncated).toBe(true);
  });

  it('still reports truncation on a partial read when the row cap already cut the data off', () => {
    const csv = ['Name', ...Array.from({ length: 10 }, (_unused, index) => `row-${index}`)].join('\n');
    const { rows, truncated } = parseCsvToTable(csv, 4, true);
    expect(rows).toHaveLength(4);
    expect(truncated).toBe(true);
  });
});

describe('payload preview column sizing', () => {
  /**
   * Without an explicit width a wide record splits into columns too narrow to read, and because the
   * preview grid uses auto row height, a long value then wraps into a row taller than the viewport.
   */
  it('gives every payload column a readable default width', () => {
    const { columns } = parseCsvToTable('Id,Name,Description\n001,Acme,Some description');
    expect(columns).toHaveLength(3);
    columns.forEach((column) => {
      expect(column.width).toBe(DATA_HISTORY_PREVIEW_COLUMN_WIDTH);
      expect(column.minWidth).toBe(DATA_HISTORY_PREVIEW_COLUMN_MIN_WIDTH);
    });
  });

  it('keeps the full value on the row — the preview clips visually, it does not truncate the data', () => {
    const longValue = 'x'.repeat(40_000);
    const { rows } = parseCsvToTable(`Id,Notes\n001,${longValue}`);
    expect(rows[0].Notes).toHaveLength(40_000);
  });
});

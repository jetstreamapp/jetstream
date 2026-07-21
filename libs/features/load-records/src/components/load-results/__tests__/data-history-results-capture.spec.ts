import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';

import { BulkJobResultRecord, RecordResultWithRecord, SalesforceOrgUi } from '@jetstream/types';
import {
  DataHistoryEntryHandle,
  FakeFileStore,
  initDataHistory,
  readDataHistoryFile,
  setHistoryFileStoreForTests,
  startDataHistoryEntry,
} from '@jetstream/ui/data-history';
import { dataHistoryDb, dexieDb } from '@jetstream/ui/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildBatchApiResultRow, buildBulkApiResultRow, getLoadResultsHeader } from '../load-results-utils';

// jsdom's Blob does not interoperate with Node's CompressionStream (cross-realm web streams);
// Node's Blob shares a realm with the stream globals the capture code uses.
globalThis.Blob = NodeBlob as unknown as typeof Blob;

const org = { uniqueId: 'org-unique-id-1', label: 'My Dev Org' } as SalesforceOrgUi;

/**
 * Integration coverage for the Load Records → Data History wiring: the shared result-row builders
 * feed a real `DataHistoryEntryHandle` (backed by the in-memory FakeFileStore) and the persisted
 * results.csv / entry counts are asserted end-to-end.
 */
describe('Load Records Data History capture wiring', () => {
  beforeAll(async () => {
    await initDataHistory({ hasPaidPlan: true });
  });

  beforeEach(async () => {
    await dexieDb.data_history.clear();
    await dexieDb.data_history_config.clear();
    setHistoryFileStoreForTests(new FakeFileStore());
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('captures BATCH results streamed batch-by-batch with a single header row', async () => {
    const handle = (await startDataHistoryEntry({
      org,
      source: 'load-records',
      operation: 'insert',
      api: 'batch-composite',
      sobjects: ['Account'],
      config: { apiMode: 'BATCH' },
    })) as DataHistoryEntryHandle;
    expect(handle).toBeTruthy();

    const fields = ['Name', 'Industry'];
    const header = getLoadResultsHeader(fields);

    handle.writeInputRows(
      [
        { Name: 'Acme', Industry: 'Tech' },
        { Name: 'Globex', Industry: 'Energy' },
        { Name: 'Bad', Industry: '' },
      ],
      fields,
    );

    // First batch (two successes), appended as it "completes"
    const firstBatch: RecordResultWithRecord[] = [
      { success: true, id: '001', record: { Name: 'Acme', Industry: 'Tech' } },
      { success: true, id: '002', record: { Name: 'Globex', Industry: 'Energy' } },
    ];
    handle.appendResultsRows(
      firstBatch.map((record) => buildBatchApiResultRow(record, fields)),
      header,
    );

    // Second batch (a failure), appended separately
    const secondBatch: RecordResultWithRecord[] = [
      {
        success: false,
        errors: [{ statusCode: 'REQUIRED_FIELD_MISSING', message: 'Name required', fields: ['Name'] }],
        record: { Name: '', Industry: '' },
      },
    ];
    handle.appendResultsRows(
      secondBatch.map((record) => buildBatchApiResultRow(record, fields)),
      header,
    );

    await handle.finish({ counts: { total: 3, success: 2, failure: 1, processingErrors: 0 } });
    await handle.flush();

    const entry = await dataHistoryDb.getEntry(handle.key);
    expect(entry?.status).toBe('partial');
    expect(entry?.counts).toEqual({ total: 3, success: 2, failure: 1, processingErrors: 0 });
    expect(entry?.files.map(({ kind }) => kind).sort()).toEqual(['input', 'results']);

    const results = await readDataHistoryFile(entry!, 'results');
    const lines = (await results!.blob.text()).split('\n');
    expect(lines[0]).toBe('_id,_success,_errors,Name,Industry');
    // header + 3 data rows, and the header appears exactly once despite two appends
    expect(lines).toHaveLength(4);
    expect(lines.filter((line) => line === lines[0])).toHaveLength(1);
    expect(lines[3]).toBe(',false,REQUIRED_FIELD_MISSING: Name required,,');
  });

  it('captures BULK results combined from Salesforce result records + submitted records', async () => {
    const handle = (await startDataHistoryEntry({
      org,
      source: 'load-records',
      operation: 'update',
      api: 'bulk-v1',
      sobjects: ['Contact'],
      config: { apiMode: 'BULK' },
    })) as DataHistoryEntryHandle;

    const fields = ['Id', 'LastName'];
    const header = getLoadResultsHeader(fields);
    const submittedRecords = [
      { Id: '003A', LastName: 'Smith' },
      { Id: '003B', LastName: 'Jones' },
    ];
    const resultRecords: BulkJobResultRecord[] = [
      { Id: '003A', Success: true, Created: false, Error: null },
      { Id: '003B', Success: false, Created: false, Error: 'FIELD_INTEGRITY_EXCEPTION' },
    ];

    handle.appendResultsRows(
      resultRecords.map((resultRecord, index) => buildBulkApiResultRow(resultRecord, submittedRecords[index])),
      header,
    );
    await handle.finish({ counts: { total: 2, success: 1, failure: 1 }, jobId: '750XX' });
    await handle.flush();

    const entry = await dataHistoryDb.getEntry(handle.key);
    expect(entry?.status).toBe('partial');
    expect(entry?.jobId).toBe('750XX');

    const results = await readDataHistoryFile(entry!, 'results');
    const lines = (await results!.blob.text()).split('\n');
    expect(lines[0]).toBe('_id,_success,_errors,Id,LastName');
    expect(lines[1]).toBe('003A,true,,003A,Smith');
    expect(lines[2]).toBe('003B,false,FIELD_INTEGRITY_EXCEPTION,003B,Jones');
  });
});

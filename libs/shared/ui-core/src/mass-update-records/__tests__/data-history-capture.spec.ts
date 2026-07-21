import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';

import { BulkJobResultRecord, BulkJobWithBatches, SalesforceOrgUi } from '@jetstream/types';
import { FakeFileStore, initDataHistory, readDataHistoryFile, setHistoryFileStoreForTests } from '@jetstream/ui/data-history';
import { dataHistoryDb, dexieDb } from '@jetstream/ui/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureMassUpdateResults, startMassUpdateHistory, writeMassUpdateRequestJson } from '../data-history-capture';
import { MetadataRowConfiguration } from '../mass-update-records.types';

// vitest hoists vi.hoisted + vi.mock above these imports at transform time, so `@jetstream/shared/data`
// is mocked before the module under test resolves it (the textual order below is only for the linter).
const { bulkApiGetRecordsMock } = vi.hoisted(() => ({ bulkApiGetRecordsMock: vi.fn() }));
vi.mock('@jetstream/shared/data', () => ({ bulkApiGetRecords: bulkApiGetRecordsMock }));

// jsdom's Blob does not interoperate with Node's CompressionStream (cross-realm web streams).
globalThis.Blob = NodeBlob as unknown as typeof Blob;

const org = { uniqueId: 'org-mass-1', label: 'Mass Org' } as SalesforceOrgUi;
const configuration: MetadataRowConfiguration[] = [
  { selectedField: 'Industry', transformationOptions: { option: 'staticValue', staticValue: 'Tech', criteria: 'all', whereClause: '' } },
];

/**
 * `captureMassUpdateResults` is intentionally fire-and-forget (it resolves the handle via async
 * indexeddb/crypto, then fetches results, then finishes), so a fixed delay can't reliably observe
 * the finish. Poll the Dexie row until it leaves `in-progress` instead.
 */
async function waitForEntryFinished(key: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const entry = await dataHistoryDb.getEntry(key);
    if (entry && entry.status !== 'in-progress') {
      return entry;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Data History entry never finished');
}

describe('mass-update Data History capture wiring', () => {
  beforeAll(async () => {
    await initDataHistory({ hasPaidPlan: true });
  });

  beforeEach(async () => {
    await dexieDb.data_history.clear();
    await dexieDb.data_history_config.clear();
    setHistoryFileStoreForTests(new FakeFileStore());
    bulkApiGetRecordsMock.mockReset();
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('writes the submitted records + streams per-batch results and finishes with counts', async () => {
    const records = [
      { Id: '001', Industry: 'Tech' },
      { Id: '002', Industry: 'Tech' },
      { Id: '003', Industry: 'Tech' },
    ];
    const resultRecords: BulkJobResultRecord[] = [
      { Id: '001', Success: true, Created: false, Error: null },
      { Id: '002', Success: true, Created: false, Error: null },
      { Id: '003', Success: false, Created: false, Error: 'FIELD_INTEGRITY_EXCEPTION' },
    ];
    bulkApiGetRecordsMock.mockResolvedValue(resultRecords);

    const handle = startMassUpdateHistory({
      org,
      source: 'STAND-ALONE',
      sobject: 'Account',
      jobId: 'job1',
      records,
      batchSize: 200,
      serialMode: false,
      configuration,
    });
    writeMassUpdateRequestJson(handle, records);

    const jobInfo = {
      id: 'job1',
      numberRecordsProcessed: 3,
      numberRecordsFailed: 1,
      batches: [{ id: 'batchA', state: 'Completed' }],
    } as unknown as BulkJobWithBatches;

    const resolvedHandle = await handle;
    captureMassUpdateResults({
      handle,
      org,
      jobInfo,
      records,
      batchIdToIndex: { batchA: 0 },
      batchSize: 200,
      configuration,
      processingErrorCount: 0,
    });

    const entry = await waitForEntryFinished(resolvedHandle!.key);
    expect(entry.source).toBe('mass-update');
    expect(entry.operation).toBe('update');
    expect(entry.api).toBe('bulk-v1');
    expect(entry.jobId).toBe('job1');
    expect(entry.status).toBe('partial');
    expect(entry.counts).toEqual({ total: 3, success: 2, failure: 1, processingErrors: 0 });
    expect(entry.files.map(({ kind }) => kind).sort()).toEqual(['request', 'results']);

    const results = await readDataHistoryFile(entry, 'results');
    const lines = (await results!.blob.text()).split('\n');
    expect(lines[0]).toBe('_id,_success,_errors,Id,Industry');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('003,false,FIELD_INTEGRITY_EXCEPTION,003,Tech');

    const request = await readDataHistoryFile(entry, 'request');
    expect(JSON.parse(await request!.blob.text())).toHaveLength(3);
  });

  it('counts client-side processing errors as failures', async () => {
    bulkApiGetRecordsMock.mockResolvedValue([{ Id: '001', Success: true, Created: false, Error: null }] as BulkJobResultRecord[]);
    const handle = startMassUpdateHistory({
      org,
      source: 'QUERY',
      sobject: 'Account',
      jobId: 'job2',
      records: [{ Id: '001', Industry: 'Tech' }],
      batchSize: 200,
      serialMode: false,
      configuration,
    });
    const jobInfo = {
      id: 'job2',
      numberRecordsProcessed: 1,
      numberRecordsFailed: 0,
      batches: [{ id: 'b', state: 'Completed' }],
    } as unknown as BulkJobWithBatches;

    const resolvedHandle = await handle;
    captureMassUpdateResults({
      handle,
      org,
      jobInfo,
      records: [{ Id: '001', Industry: 'Tech' }],
      batchIdToIndex: { b: 0 },
      batchSize: 200,
      configuration,
      processingErrorCount: 2,
    });
    const entry = await waitForEntryFinished(resolvedHandle!.key);
    expect(entry.source).toBe('mass-update-from-query');
    expect(entry.counts).toEqual({ total: 3, success: 1, failure: 2, processingErrors: 2 });
    expect(entry.status).toBe('partial');
  });
});

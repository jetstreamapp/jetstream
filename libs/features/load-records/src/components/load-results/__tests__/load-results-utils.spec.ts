import { bulkApiGetRecords } from '@jetstream/shared/data';
import { BULK_RESULTS_BASE_HEADER, buildBulkResultRow } from '@jetstream/shared/utils';
import {
  BulkJobBatchInfo,
  BulkJobResultRecord,
  BulkJobWithBatches,
  LoadDataBulkApiStatusPayload,
  PrepareDataResponse,
  RecordResultWithRecord,
  SalesforceOrgUi,
} from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  alignBatchSourceRecordsToResults,
  buildBatchApiResultRow,
  collectFailedRecordsForRetry,
  createBatchResultsFetcher,
  getCompletedBatchSourceRecords,
  getLoadResultsHeader,
} from '../load-results-utils';

vi.mock('@jetstream/shared/data', () => ({
  bulkApiGetRecords: vi.fn(),
  bulkApiGetRecordsFromAllBatches: vi.fn(),
}));
const bulkApiGetRecordsMock = vi.mocked(bulkApiGetRecords);

describe('getLoadResultsHeader', () => {
  it('prefixes the mapped field headers with the standard result columns', () => {
    expect(getLoadResultsHeader(['Name', 'Industry'])).toEqual(['_id', '_success', '_errors', 'Name', 'Industry']);
  });

  it('returns just the base header when there are no mapped fields', () => {
    expect(getLoadResultsHeader([])).toEqual(BULK_RESULTS_BASE_HEADER);
  });
});

describe('buildBatchApiResultRow', () => {
  it('builds a success row using the returned record id and an empty error', () => {
    const record = { success: true, id: '001AAA', record: { Name: 'Acme', Industry: 'Tech' } } as RecordResultWithRecord;
    expect(buildBatchApiResultRow(record, ['Name', 'Industry'])).toEqual({
      _id: '001AAA',
      _success: true,
      _errors: '',
      Name: 'Acme',
      Industry: 'Tech',
    });
  });

  it('builds a failure row joining status codes with messages', () => {
    const record = {
      success: false,
      errors: [
        { statusCode: 'REQUIRED_FIELD_MISSING', message: 'Required fields are missing: [Name]', fields: ['Name'] },
        { statusCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION', message: 'Nope', fields: [] },
      ],
      record: { Name: '', Industry: 'Energy' },
    } as RecordResultWithRecord;
    expect(buildBatchApiResultRow(record, ['Name', 'Industry'])).toEqual({
      _id: '',
      _success: false,
      _errors: 'REQUIRED_FIELD_MISSING: Required fields are missing: [Name]\nFIELD_CUSTOM_VALIDATION_EXCEPTION: Nope',
      Name: '',
      Industry: 'Energy',
    });
  });

  it('decodes HTML entities embedded in error messages', () => {
    const record = {
      success: false,
      errors: [{ statusCode: 'DUPLICATE_VALUE', message: 'duplicate &amp; invalid', fields: [] }],
      record: { Name: 'Dup' },
    } as RecordResultWithRecord;
    expect(buildBatchApiResultRow(record, ['Name'])._errors).toBe('DUPLICATE_VALUE: duplicate & invalid');
  });
});

describe('buildBulkResultRow (shared with Mass Update)', () => {
  it('combines the Salesforce result with the submitted source record', () => {
    const resultRecord: BulkJobResultRecord = { Id: '001BBB', Success: true, Created: false, Error: null };
    expect(buildBulkResultRow(resultRecord, { Name: 'Globex', Industry: 'Energy' })).toEqual({
      _id: '001BBB',
      _success: true,
      _errors: '',
      Name: 'Globex',
      Industry: 'Energy',
    });
  });

  it('falls back to the source record Id and decodes the error', () => {
    const resultRecord: BulkJobResultRecord = { Id: null, Success: false, Created: false, Error: 'INVALID_FIELD:bad &amp; wrong' };
    expect(buildBulkResultRow(resultRecord, { Id: '001CCC', Name: 'Broken' })).toEqual({
      _id: '001CCC',
      _success: false,
      _errors: 'INVALID_FIELD:bad & wrong',
      Id: '001CCC',
      Name: 'Broken',
    });
  });

  it('uses a null id when neither the result nor the source record has one', () => {
    const resultRecord: BulkJobResultRecord = { Id: null, Success: false, Created: false, Error: 'boom' };
    expect(buildBulkResultRow(resultRecord, { Name: 'NoId' })._id).toBeNull();
  });
});

describe('getCompletedBatchSourceRecords', () => {
  const splitRecords = [
    [{ Name: 'Batch1-A' }, { Name: 'Batch1-B' }],
    [{ Name: 'Batch2-A' }, { Name: 'Batch2-B' }],
  ];

  function batch(id: string, state: BulkJobBatchInfo['state']): Pick<BulkJobBatchInfo, 'id' | 'state'> {
    return { id, state };
  }

  it('skips non-completed batches so a failed batch never shifts the pairing of a later batch', () => {
    const batchNumberById = new Map([
      ['batch-1', 0],
      ['batch-2', 1],
    ]);
    const { batchIds, recordsByBatch } = getCompletedBatchSourceRecords(
      [batch('batch-1', 'Failed'), batch('batch-2', 'Completed')],
      batchNumberById,
      splitRecords,
    );
    expect(batchIds).toEqual(['batch-2']);
    expect(recordsByBatch).toEqual([[{ Name: 'Batch2-A' }, { Name: 'Batch2-B' }]]);
  });

  it('returns every batch slice in order when all batches completed', () => {
    const batchNumberById = new Map([
      ['batch-1', 0],
      ['batch-2', 1],
    ]);
    const { batchIds, recordsByBatch } = getCompletedBatchSourceRecords(
      [batch('batch-1', 'Completed'), batch('batch-2', 'Completed')],
      batchNumberById,
      splitRecords,
    );
    expect(batchIds).toEqual(['batch-1', 'batch-2']);
    expect(recordsByBatch).toEqual(splitRecords);
  });

  it('skips completed batches whose original position cannot be resolved', () => {
    const batchNumberById = new Map([['batch-2', 1]]);
    const { batchIds, recordsByBatch } = getCompletedBatchSourceRecords(
      [batch('batch-1', 'Completed'), batch('batch-2', 'Completed')],
      batchNumberById,
      splitRecords,
    );
    expect(batchIds).toEqual(['batch-2']);
    expect(recordsByBatch).toEqual([[{ Name: 'Batch2-A' }, { Name: 'Batch2-B' }]]);
  });
});

describe('alignBatchSourceRecordsToResults', () => {
  it('flattens batch slices in order for non-delete loads', () => {
    const recordsByBatch = [[{ Id: '1' }], [{ Id: '2' }, { Id: '3' }]];
    expect(alignBatchSourceRecordsToResults(recordsByBatch, 3, false)).toEqual([{ Id: '1' }, { Id: '2' }, { Id: '3' }]);
  });

  it('filters records without an Id for delete loads when the result count matches the Id-only count', () => {
    const recordsByBatch = [[{ Id: '1' }, { Name: 'missing-id' }], [{ Id: '2' }]];
    expect(alignBatchSourceRecordsToResults(recordsByBatch, 2, true)).toEqual([{ Id: '1' }, { Id: '2' }]);
  });

  it('keeps all records for delete loads when the result count matches the full record count', () => {
    const recordsByBatch = [[{ Id: '1' }, { Name: 'missing-id' }], [{ Id: '2' }]];
    expect(alignBatchSourceRecordsToResults(recordsByBatch, 3, true)).toEqual([{ Id: '1' }, { Name: 'missing-id' }, { Id: '2' }]);
  });
});

describe('bulk result pairing end-to-end (failed batch 1, completed batch 2)', () => {
  it('pairs batch 2 results with batch 2 source records', () => {
    const splitRecords = [
      [
        { Id: '001A', Name: 'Batch1-A' },
        { Id: '001B', Name: 'Batch1-B' },
      ],
      [
        { Id: '001C', Name: 'Batch2-A' },
        { Id: '001D', Name: 'Batch2-B' },
      ],
    ];
    const batchNumberById = new Map([
      ['batch-1', 0],
      ['batch-2', 1],
    ]);
    // Only batch 2 completed — Salesforce returns result rows only for its two records
    const results: BulkJobResultRecord[] = [
      { Id: '001C', Success: true, Created: false, Error: null },
      { Id: '001D', Success: false, Created: false, Error: 'FIELD_INTEGRITY_EXCEPTION' },
    ];

    const { recordsByBatch } = getCompletedBatchSourceRecords(
      [
        { id: 'batch-1', state: 'Failed' },
        { id: 'batch-2', state: 'Completed' },
      ],
      batchNumberById,
      splitRecords,
    );
    const records = alignBatchSourceRecordsToResults(recordsByBatch, results.length, false);
    const rows = results.map((resultRecord, index) => buildBulkResultRow(resultRecord, records[index]));

    expect(rows).toEqual([
      { _id: '001C', _success: true, _errors: '', Id: '001C', Name: 'Batch2-A' },
      { _id: '001D', _success: false, _errors: 'FIELD_INTEGRITY_EXCEPTION', Id: '001D', Name: 'Batch2-B' },
    ]);
  });
});

describe('createBatchResultsFetcher', () => {
  const org = { uniqueId: 'org-1' } as SalesforceOrgUi;

  beforeEach(() => {
    bulkApiGetRecordsMock.mockReset();
  });

  it('downloads each batch once even when two consumers ask for it concurrently', async () => {
    bulkApiGetRecordsMock.mockResolvedValue([{ Id: '001A', Success: true, Created: false, Error: null }]);
    const fetchBatchResults = createBatchResultsFetcher(org, 'job-1');

    const [first, second] = await Promise.all([fetchBatchResults('batch-1'), fetchBatchResults('batch-1')]);
    await fetchBatchResults('batch-2');

    expect(first).toBe(second);
    expect(bulkApiGetRecordsMock).toHaveBeenCalledTimes(2);
    expect(bulkApiGetRecordsMock).toHaveBeenCalledWith(org, 'job-1', 'batch-1', 'result');
    expect(bulkApiGetRecordsMock).toHaveBeenCalledWith(org, 'job-1', 'batch-2', 'result');
  });

  it('evicts a rejected fetch so the next consumer retries for real', async () => {
    bulkApiGetRecordsMock.mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce([]);
    const fetchBatchResults = createBatchResultsFetcher(org, 'job-1');

    await expect(fetchBatchResults('batch-1')).rejects.toThrow('transient');
    await expect(fetchBatchResults('batch-1')).resolves.toEqual([]);
    expect(bulkApiGetRecordsMock).toHaveBeenCalledTimes(2);
  });
});

describe('collectFailedRecordsForRetry', () => {
  const records = [
    { Id: '001A', Name: 'Batch1-A' },
    { Id: '001B', Name: 'Batch1-B' },
    { Id: '001C', Name: 'Batch2-A' },
    { Id: '001D', Name: 'Batch2-B' },
  ];
  const preparedData = { data: records, errors: [] } as unknown as PrepareDataResponse;
  const batchSummary = {
    batchSummary: [
      { id: 'batch-1', batchNumber: 0, startIndex: 0, recordCount: 2 },
      { id: 'batch-2', batchNumber: 1, startIndex: 2, recordCount: 2 },
    ],
  } as LoadDataBulkApiStatusPayload;
  const jobWith = (states: BulkJobBatchInfo['state'][]): BulkJobWithBatches =>
    ({ id: 'job-1', batches: states.map((state, index) => ({ id: `batch-${index + 1}`, state })) }) as BulkJobWithBatches;
  const success = (Id: string): BulkJobResultRecord => ({ Id, Success: true, Created: false, Error: null });
  const failure = (Id: string): BulkJobResultRecord => ({ Id, Success: false, Created: false, Error: 'ERR' });

  it('returns nothing when there were no failures and skips the fetch entirely', async () => {
    const fetchBatchResults = vi.fn();
    const failed = await collectFailedRecordsForRetry({
      numFailure: 0,
      jobInfo: jobWith(['Completed', 'Completed']),
      batchSummary,
      preparedData,
      loadType: 'INSERT',
      fetchBatchResults,
    });
    expect(failed).toEqual([]);
    expect(fetchBatchResults).not.toHaveBeenCalled();
  });

  it('returns the failed records of every completed batch, in batch order', async () => {
    const fetchBatchResults = vi.fn(async (batchId: string) =>
      batchId === 'batch-1' ? [failure('001A'), success('001B')] : [success('001C'), failure('001D')],
    );
    const failed = await collectFailedRecordsForRetry({
      numFailure: 2,
      jobInfo: jobWith(['Completed', 'Completed']),
      batchSummary,
      preparedData,
      loadType: 'UPDATE',
      fetchBatchResults,
    });
    expect(failed).toEqual([records[0], records[3]]);
  });

  it('treats every record of a batch whose results could not be fetched as failed', async () => {
    const fetchBatchResults = vi.fn(async (batchId: string) => {
      if (batchId === 'batch-1') {
        throw new Error('transient');
      }
      return [success('001C'), success('001D')];
    });
    const failed = await collectFailedRecordsForRetry({
      numFailure: 1,
      jobInfo: jobWith(['Completed', 'Completed']),
      batchSummary,
      preparedData,
      loadType: 'UPDATE',
      fetchBatchResults,
    });
    expect(failed).toEqual([records[0], records[1]]);
  });

  it('includes every record of a batch that never completed, after the resolved failures', async () => {
    const fetchBatchResults = vi.fn(async () => [success('001C'), failure('001D')]);
    const failed = await collectFailedRecordsForRetry({
      numFailure: 3,
      jobInfo: jobWith(['Failed', 'Completed']),
      batchSummary,
      preparedData,
      loadType: 'UPDATE',
      fetchBatchResults,
    });
    expect(fetchBatchResults).toHaveBeenCalledTimes(1);
    expect(fetchBatchResults).toHaveBeenCalledWith('batch-2');
    expect(failed).toEqual([records[3], records[0], records[1]]);
  });

  it('falls back to every record when no batch completed', async () => {
    const fetchBatchResults = vi.fn();
    const failed = await collectFailedRecordsForRetry({
      numFailure: 4,
      jobInfo: jobWith(['Failed', 'NotProcessed']),
      batchSummary,
      preparedData,
      loadType: 'UPDATE',
      fetchBatchResults,
    });
    expect(failed).toEqual(records);
    expect(failed).not.toBe(records);
    expect(fetchBatchResults).not.toHaveBeenCalled();
  });

  it('handles hundreds of thousands of unresolved records without overflowing the call stack', async () => {
    // Regression test: `failedRecords.push(...records)` blew the max call stack when a large batch
    // never completed, since every one of its records is spread as an argument
    const largeRecordCount = 200_000;
    const largeRecords = [
      { Id: '001A', Name: 'Completed-A' },
      { Id: '001B', Name: 'Completed-B' },
      ...Array.from({ length: largeRecordCount }, (_, i) => ({ Id: `002${i}`, Name: `Unresolved-${i}` })),
    ];
    const largePreparedData = { data: largeRecords, errors: [] } as unknown as PrepareDataResponse;
    const largeSummary = {
      batchSummary: [
        { id: 'batch-1', batchNumber: 0, startIndex: 0, recordCount: 2 },
        { id: 'batch-2', batchNumber: 1, startIndex: 2, recordCount: largeRecordCount },
      ],
    } as LoadDataBulkApiStatusPayload;
    const fetchBatchResults = vi.fn(async () => [success('001A'), failure('001B')]);
    const failed = await collectFailedRecordsForRetry({
      numFailure: largeRecordCount + 1,
      jobInfo: jobWith(['Completed', 'Failed']),
      batchSummary: largeSummary,
      preparedData: largePreparedData,
      loadType: 'UPDATE',
      fetchBatchResults,
    });
    expect(failed).toHaveLength(largeRecordCount + 1);
    expect(failed[0]).toBe(largeRecords[1]);
    expect(failed[1]).toBe(largeRecords[2]);
  });

  it('on a delete, pairs results with the Id-bearing records and counts the omitted ones as failed', async () => {
    const deleteRecords = [{ Id: '001A' }, { Name: 'no-id' }, { Id: '001B' }];
    const deletePreparedData = { data: deleteRecords, errors: [] } as unknown as PrepareDataResponse;
    const deleteSummary = {
      batchSummary: [{ id: 'batch-1', batchNumber: 0, startIndex: 0, recordCount: 3 }],
    } as LoadDataBulkApiStatusPayload;
    // Salesforce returns result rows only for the two records that had an Id
    const fetchBatchResults = vi.fn(async () => [success('001A'), failure('001B')]);
    const failed = await collectFailedRecordsForRetry({
      numFailure: 1,
      jobInfo: jobWith(['Completed']),
      batchSummary: deleteSummary,
      preparedData: deletePreparedData,
      loadType: 'DELETE',
      fetchBatchResults,
    });
    expect(failed).toEqual([deleteRecords[2], deleteRecords[1]]);
  });
});

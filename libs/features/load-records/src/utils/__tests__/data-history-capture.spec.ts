import { FieldMapping } from '@jetstream/types';
import { DataHistoryEntryHandle } from '@jetstream/ui/data-history';
import { describe, expect, it, vi } from 'vitest';
import {
  apiModeToDataHistoryApi,
  buildLoadRecordsHistoryConfig,
  loadTypeToDataHistoryOperation,
  settleHistoryForFailedLoad,
} from '../data-history-capture';

const fieldMapping = {
  Name: { type: 'CSV' },
  Industry: { type: 'STATIC' },
  Rating: { type: 'STATIC' },
} as unknown as FieldMapping;

const baseConfigArgs = {
  loadType: 'INSERT',
  apiMode: 'BULK',
  numRecords: 100,
  batchSize: 5000,
  insertNulls: false,
  serialMode: false,
  hasDateFieldMapped: true,
  dateFormat: 'MM-DD-YYYY',
  fieldMapping,
  hasZipAttachment: false,
  timesSameDataSubmitted: 1,
} as const;

describe('loadTypeToDataHistoryOperation', () => {
  it.each([
    ['INSERT', 'insert'],
    ['UPDATE', 'update'],
    ['UPSERT', 'upsert'],
    ['DELETE', 'delete'],
    ['HARD_DELETE', 'delete'],
  ] as const)('maps %s to %s', (loadType, expected) => {
    expect(loadTypeToDataHistoryOperation(loadType)).toBe(expected);
  });
});

describe('apiModeToDataHistoryApi', () => {
  it('maps BULK to bulk-v1 and BATCH to batch-composite', () => {
    expect(apiModeToDataHistoryApi('BULK')).toBe('bulk-v1');
    expect(apiModeToDataHistoryApi('BATCH')).toBe('batch-composite');
  });
});

describe('settleHistoryForFailedLoad', () => {
  function createHandle() {
    return { finish: vi.fn(), fail: vi.fn() } as unknown as DataHistoryEntryHandle & {
      finish: ReturnType<typeof vi.fn>;
      fail: ReturnType<typeof vi.fn>;
    };
  }

  it("records every attempted record as failed when nothing reached Salesforce ('none')", () => {
    const handle = createHandle();
    settleHistoryForFailedLoad(handle, { reached: 'none', attemptedCount: 25, errorMessage: 'Pre-processing records failed' });
    expect(handle.finish).toHaveBeenCalledWith({
      counts: { total: 25, success: 0, failure: 25 },
      status: 'failed',
      errorMessage: 'Pre-processing records failed',
    });
    expect(handle.fail).not.toHaveBeenCalled();
  });

  it("fails the entry without inventing per-record failures when the outcome is unknown ('unknown')", () => {
    const handle = createHandle();
    settleHistoryForFailedLoad(handle, { reached: 'unknown', attemptedCount: 25, errorMessage: 'Job status read timed out' });
    expect(handle.fail).toHaveBeenCalledWith('Job status read timed out');
    expect(handle.finish).not.toHaveBeenCalled();
  });
});

describe('buildLoadRecordsHistoryConfig', () => {
  it('snapshots the load options and counts the static field mappings', () => {
    expect(buildLoadRecordsHistoryConfig(baseConfigArgs)).toEqual({
      loadType: 'INSERT',
      apiMode: 'BULK',
      numRecords: 100,
      batchSize: 5000,
      insertNulls: false,
      serialMode: false,
      hasDateFieldMapped: true,
      dateFormat: 'MM-DD-YYYY',
      isTrialRun: false,
      trialRunSize: undefined,
      hasZipAttachment: false,
      timesSameDataSubmitted: 1,
      numStaticFields: 2,
    });
  });

  it('records the trial-run size when this is a trial run', () => {
    expect(buildLoadRecordsHistoryConfig({ ...baseConfigArgs, isTrialRun: true, trialRunSize: 10 })).toMatchObject({
      isTrialRun: true,
      trialRunSize: 10,
    });
  });

  it('adds the retry fields only for a retry run', () => {
    const config = buildLoadRecordsHistoryConfig({
      ...baseConfigArgs,
      retry: { retryCount: 2, retrySource: 'selected', totalFailedCount: 7 },
    });
    expect(config).toMatchObject({ isRetry: true, retryCount: 2, retrySource: 'selected', totalFailedCount: 7 });
    expect(buildLoadRecordsHistoryConfig(baseConfigArgs).isRetry).toBeUndefined();
  });
});

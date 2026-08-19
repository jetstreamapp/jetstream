import { FieldMapping } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { apiModeToDataHistoryApi, buildLoadRecordsHistoryConfig, loadTypeToDataHistoryOperation } from '../data-history-capture';

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

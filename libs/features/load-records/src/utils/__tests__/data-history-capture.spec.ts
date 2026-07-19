import { describe, expect, it, vi } from 'vitest';
import {
  apiModeToDataHistoryApi,
  appendHistoryResultsRows,
  buildLoadRecordsInputSource,
  failHistoryEntry,
  finishHistoryEntry,
  loadTypeToDataHistoryOperation,
  writeHistoryInputRows,
} from '../data-history-capture';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeHandle() {
  return {
    key: 'dh_test',
    writeInputRows: vi.fn().mockResolvedValue(undefined),
    writeRequestJson: vi.fn().mockResolvedValue(undefined),
    appendResultsRows: vi.fn().mockResolvedValue(undefined),
    finish: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
  };
}

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

describe('buildLoadRecordsInputSource', () => {
  it('describes a local file source', () => {
    expect(buildLoadRecordsInputSource({ filename: 'accounts.csv', filenameType: 'local', googleFileId: null })).toEqual({
      type: 'local',
      fileName: 'accounts.csv',
      googleFileId: undefined,
    });
  });

  it('describes a google file source and retains the file id', () => {
    expect(buildLoadRecordsInputSource({ filename: 'Sheet1', filenameType: 'google', googleFileId: 'gfile-123' })).toEqual({
      type: 'google',
      fileName: 'Sheet1',
      googleFileId: 'gfile-123',
    });
  });

  it('defaults to local and omits the google id when the type is unknown', () => {
    expect(buildLoadRecordsInputSource({ filename: null, filenameType: null, googleFileId: 'ignored' })).toEqual({
      type: 'local',
      fileName: undefined,
      googleFileId: undefined,
    });
  });
});

describe('fire-and-forget capture wrappers', () => {
  it('forwards input/result rows, finish, and fail to the resolved handle', async () => {
    const handle = fakeHandle();
    const promise: any = Promise.resolve(handle);

    writeHistoryInputRows(promise, [{ Name: 'Acme' }], ['Name']);
    appendHistoryResultsRows(promise, [{ _id: '1' }], ['_id']);
    finishHistoryEntry(promise, { counts: { total: 1, success: 1, failure: 0 } });
    failHistoryEntry(promise, 'boom');
    await flushMicrotasks();

    expect(handle.writeInputRows).toHaveBeenCalledWith([{ Name: 'Acme' }], ['Name']);
    expect(handle.appendResultsRows).toHaveBeenCalledWith([{ _id: '1' }], ['_id']);
    expect(handle.finish).toHaveBeenCalledWith({ counts: { total: 1, success: 1, failure: 0 } });
    expect(handle.fail).toHaveBeenCalledWith('boom');
  });

  it('is a no-op when the handle promise resolves to null (capture disabled/opted out)', async () => {
    const nullPromise: any = Promise.resolve(null);
    // None of these should throw even though there is no handle to act on
    writeHistoryInputRows(nullPromise, [{ Name: 'Acme' }], ['Name']);
    appendHistoryResultsRows(nullPromise, [{ _id: '1' }], ['_id']);
    finishHistoryEntry(nullPromise, { counts: { total: 1, success: 1, failure: 0 } });
    failHistoryEntry(nullPromise, 'boom');
    await expect(flushMicrotasks()).resolves.toBeUndefined();
  });

  it('skips empty row sets and missing handles without touching the handle', async () => {
    const handle = fakeHandle();
    const promise: any = Promise.resolve(handle);

    writeHistoryInputRows(promise, [], ['Name']);
    writeHistoryInputRows(promise, [{ Name: 'Acme' }], []);
    appendHistoryResultsRows(promise, [], ['_id']);
    writeHistoryInputRows(null, [{ Name: 'Acme' }], ['Name']);
    appendHistoryResultsRows(undefined, [{ _id: '1' }], ['_id']);
    finishHistoryEntry(null, { counts: { total: 0, success: 0, failure: 0 } });
    failHistoryEntry(undefined, 'boom');
    await flushMicrotasks();

    expect(handle.writeInputRows).not.toHaveBeenCalled();
    expect(handle.appendResultsRows).not.toHaveBeenCalled();
  });

  it('never rejects into the caller even if a handle method throws', async () => {
    const handle = fakeHandle();
    handle.appendResultsRows.mockRejectedValueOnce(new Error('store died'));
    const promise: any = Promise.resolve(handle);

    expect(() => appendHistoryResultsRows(promise, [{ _id: '1' }], ['_id'])).not.toThrow();
    await expect(flushMicrotasks()).resolves.toBeUndefined();
  });
});

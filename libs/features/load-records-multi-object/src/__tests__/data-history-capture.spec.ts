import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';

import { SalesforceOrgUi } from '@jetstream/types';
import {
  FakeFileStore,
  initDataHistory,
  readDataHistoryFile,
  setHistoryFileStoreForTests,
  startDataHistoryEntry,
} from '@jetstream/ui/data-history';
import { dataHistoryDb, dexieDb } from '@jetstream/ui/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildMultiObjectInputSource,
  DataHistoryHandlePromise,
  finalizeMultiObjectHistory,
  getMultiObjectDistinctSobjects,
  getMultiObjectOperations,
  writeMultiObjectRequestJson,
} from '../data-history-capture';
import { LoadMultiObjectRequestWithResult } from '../load-records-multi-object-types';

// jsdom's Blob does not interoperate with Node's CompressionStream (cross-realm web streams).
globalThis.Blob = NodeBlob as unknown as typeof Blob;

const org = { uniqueId: 'org-multi-1', label: 'Multi Org' } as SalesforceOrgUi;

function buildRequest(
  key: string,
  errorMessage: string | undefined,
  records: { referenceId: string; sobject: string; operation: 'INSERT' | 'UPDATE' | 'UPSERT'; body: Record<string, unknown> | null }[],
): LoadMultiObjectRequestWithResult {
  return {
    key,
    loading: false,
    started: null,
    finished: null,
    errorMessage,
    data: [],
    results: errorMessage
      ? null
      : [
          {
            graphId: `${key}-graph`,
            isSuccessful: records.every((record) => record.body?.success !== false),
            graphResponse: {
              compositeResponse: records.map(({ referenceId, body }) => ({ referenceId, body, httpHeaders: {}, httpStatusCode: 200 })),
            },
          } as any,
        ],
    dataWithResultsByGraphId: {
      [`${key}-graph`]: { graphId: `${key}-graph`, isSuccess: true, compositeRequest: [], compositeResponse: null },
    },
    recordWithResponseByRefId: Object.fromEntries(
      records.map(({ referenceId, sobject, operation }) => [
        referenceId,
        { referenceId, sobject, operation, request: {} as any, response: null },
      ]),
    ) as any,
  };
}

describe('multi-object derivation helpers', () => {
  const data = [
    buildRequest('g1', undefined, [
      { referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: { id: '1', success: true } },
      { referenceId: 'r2', sobject: 'Contact', operation: 'INSERT', body: { id: '2', success: true } },
    ]),
    buildRequest('g2', undefined, [{ referenceId: 'r3', sobject: 'Account', operation: 'UPDATE', body: { id: '3', success: true } }]),
  ];

  it('collects distinct sobjects across all graphs', () => {
    expect(getMultiObjectDistinctSobjects(data).sort()).toEqual(['Account', 'Contact']);
  });

  it('marks operations mixed and defaults to insert, recording per-object operations', () => {
    const operations = getMultiObjectOperations(data);
    expect(operations.mixed).toBe(true);
    expect(operations.operation).toBe('insert');
    expect(operations.byObject.Account).toContain('INSERT');
    expect(operations.byObject.Account).toContain('UPDATE');
  });

  it('uses the single shared operation when not mixed', () => {
    const single = [
      buildRequest('g1', undefined, [{ referenceId: 'r1', sobject: 'Account', operation: 'UPDATE', body: { id: '1', success: true } }]),
    ];
    expect(getMultiObjectOperations(single)).toMatchObject({ mixed: false, operation: 'update' });
  });

  it('builds a google input source with the file id', () => {
    expect(buildMultiObjectInputSource({ filename: 'sheet', filenameType: 'google', googleFileId: 'gid' })).toEqual({
      type: 'google',
      fileName: 'sheet',
      googleFileId: 'gid',
    });
  });
});

describe('multi-object Data History capture wiring', () => {
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

  it('writes the request json, streams result rows, and finishes with derived counts', async () => {
    const data = [
      buildRequest('g1', undefined, [
        { referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: { id: '001', success: true, created: true } },
        { referenceId: 'r2', sobject: 'Account', operation: 'INSERT', body: { success: false, errorCode: 'DUP', message: 'dupe' } },
      ]),
    ];

    const handle = startDataHistoryEntry({
      org,
      source: 'load-multi-object',
      operation: getMultiObjectOperations(data).operation,
      api: 'composite-graph',
      sobjects: getMultiObjectDistinctSobjects(data),
    }) as DataHistoryHandlePromise;

    writeMultiObjectRequestJson(handle, [{ groupId: 'g1', data: [{ some: 'request' }] }]);
    finalizeMultiObjectHistory(handle, data);
    await (await handle)?.flush();

    const [entry] = await dataHistoryDb.getAllEntries();
    expect(entry.source).toBe('load-multi-object');
    expect(entry.status).toBe('partial');
    expect(entry.counts).toEqual({ total: 2, success: 1, failure: 1 });
    expect(entry.files.map(({ kind }) => kind).sort()).toEqual(['request', 'results']);

    const results = await readDataHistoryFile(entry, 'results');
    const lines = (await results!.blob.text()).split('\n');
    expect(lines[0]).toBe('Group,Object,Operation,External Id,Reference Id,Id,Success,Created,Error');
    expect(lines).toHaveLength(3);

    const request = await readDataHistoryFile(entry, 'request');
    expect(JSON.parse(await request!.blob.text())[0].groupId).toBe('g1');
  });

  it('marks the entry failed when every group failed outright', async () => {
    const data = [buildRequest('g1', 'network down', [{ referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: null }])];
    const handle = startDataHistoryEntry({
      org,
      source: 'load-multi-object',
      operation: 'insert',
      api: 'composite-graph',
      sobjects: ['Account'],
    }) as DataHistoryHandlePromise;
    finalizeMultiObjectHistory(handle, data);
    await (await handle)?.flush();

    const [entry] = await dataHistoryDb.getAllEntries();
    expect(entry.status).toBe('failed');
    expect(entry.errorMessage).toBe('network down');
  });
});

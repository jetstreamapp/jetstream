import { Blob as NodeBlob } from 'node:buffer';

import { SalesforceOrgUi } from '@jetstream/types';
import { initDataHistory, readDataHistoryFile, setHistoryFileStoreForTests, startDataHistoryEntry } from '@jetstream/ui/data-history';
import { FakeFileStore } from '@jetstream/ui/data-history/testing';
import { dataHistoryDb, getDexieDb } from '@jetstream/ui/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { finalizeMultiObjectHistory, getMultiObjectDistinctSobjects, getMultiObjectOperations } from '../data-history-capture';
import { LoadMultiObjectRequestWithResult, LoadMultiObjectRun } from '../load-records-multi-object-types';
import { buildRecordResultRows } from '../load/load-results-utils';

const SPEC_USER_ID = 'spec-user-id';

// jsdom's Blob does not interoperate with Node's CompressionStream (cross-realm web streams).
globalThis.Blob = NodeBlob as unknown as typeof Blob;

const org = { uniqueId: 'org-multi-1', label: 'Multi Org' } as SalesforceOrgUi;

interface TestRecord {
  referenceId: string;
  sobject: string;
  operation: 'INSERT' | 'UPDATE' | 'UPSERT';
  body: Record<string, unknown> | null;
}

function buildRequest(key: string, errorMessage: string | undefined, records: TestRecord[]): LoadMultiObjectRequestWithResult {
  const graphId = `${key}-graph`;
  const isSuccess = records.every((record) => record.body?.success !== false);
  return {
    key,
    loading: false,
    started: null,
    finished: null,
    errorMessage,
    data: [],
    results: errorMessage ? null : ([{ graphId, isSuccessful: isSuccess, graphResponse: { compositeResponse: [] } }] as any),
    dataWithResultsByGraphId: {
      [graphId]: { graphId, isSuccess: errorMessage ? null : isSuccess, compositeRequest: [], compositeResponse: null },
    },
    recordWithResponseByRefId: Object.fromEntries(
      records.map(({ referenceId, sobject, operation, body }, index) => [
        referenceId,
        {
          referenceId,
          sobject,
          operation,
          worksheet: sobject,
          rowIndex: index,
          graphId,
          request: {} as any,
          response: body ? { referenceId, body } : null,
        },
      ]),
    ) as any,
  };
}

function buildRun(requests: LoadMultiObjectRequestWithResult[]): LoadMultiObjectRun {
  return { runId: 0, type: 'initial', requests, startedAt: null, finishedAt: null, cancelled: false };
}

/** The same per-record rows the results tables and the results download are built from */
function buildRows(requests: LoadMultiObjectRequestWithResult[]) {
  return buildRecordResultRows([buildRun(requests)], {});
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

  it('records the mixed operation when operations differ, recording per-object operations', () => {
    const operations = getMultiObjectOperations(data);
    expect(operations.mixed).toBe(true);
    expect(operations.operation).toBe('mixed');
    expect(operations.byObject.Account).toContain('INSERT');
    expect(operations.byObject.Account).toContain('UPDATE');
  });

  it('uses the single shared operation when not mixed', () => {
    const single = [
      buildRequest('g1', undefined, [{ referenceId: 'r1', sobject: 'Account', operation: 'UPDATE', body: { id: '1', success: true } }]),
    ];
    expect(getMultiObjectOperations(single)).toMatchObject({ mixed: false, operation: 'update' });
  });
});

describe('multi-object Data History capture wiring', () => {
  beforeAll(async () => {
    await initDataHistory({ userId: SPEC_USER_ID, hasPaidPlan: true });
  });

  beforeEach(async () => {
    await getDexieDb().data_history.clear();
    await getDexieDb().data_history_config.clear();
    setHistoryFileStoreForTests(new FakeFileStore());
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('writes the request json, streams result rows, and finishes with derived counts', async () => {
    // Separate requests — a group is atomic, so a failing record would take its whole group down with it
    const data = [
      buildRequest('g1', undefined, [
        { referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: { id: '001', success: true, created: true } },
      ]),
      buildRequest('g2', undefined, [
        { referenceId: 'r2', sobject: 'Account', operation: 'INSERT', body: { success: false, errorCode: 'DUP', message: 'dupe' } },
      ]),
    ];

    const handle = startDataHistoryEntry({
      org,
      source: 'load-multi-object',
      operation: getMultiObjectOperations(data).operation,
      api: 'composite-graph',
      sobjects: getMultiObjectDistinctSobjects(data),
    });

    handle.writeRequestJson([{ groupId: 'g1', data: [{ some: 'request' }] }]);
    await finalizeMultiObjectHistory(handle, { rows: buildRows(data), requests: data });

    const [entry] = await dataHistoryDb.getAllEntries();
    expect(entry.source).toBe('load-multi-object');
    expect(entry.status).toBe('partial');
    expect(entry.counts).toEqual({ total: 2, success: 1, failure: 1 });
    expect(entry.files.map(({ kind }) => kind).sort()).toEqual(['request', 'results']);

    const results = await readDataHistoryFile(entry, 'results');
    const lines = (await results!.blob.text()).split('\n');
    expect(lines[0]).toBe('Worksheet,Row,Group,Object,Operation,Reference Id,Id,Success,Created,Error');
    expect(lines).toHaveLength(3);

    const request = await readDataHistoryFile(entry, 'request');
    expect(JSON.parse(await request!.blob.text())[0].groupId).toBe('g1');
  });

  it('marks the entry failed with the attempted record counts when every request failed outright', async () => {
    const data = [
      buildRequest('g1', 'network down', [
        { referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: null },
        { referenceId: 'r2', sobject: 'Contact', operation: 'INSERT', body: null },
      ]),
    ];
    const handle = startDataHistoryEntry({
      org,
      source: 'load-multi-object',
      operation: 'insert',
      api: 'composite-graph',
      sobjects: ['Account'],
    });
    handle.writeRequestJson([{ groupId: 'g1', data: [{ some: 'request' }] }]);
    await finalizeMultiObjectHistory(handle, { rows: buildRows(data), requests: data });

    const [entry] = await dataHistoryDb.getAllEntries();
    expect(entry.status).toBe('failed');
    expect(entry.errorMessage).toBe('network down');
    expect(entry.counts).toEqual({ total: 2, success: 0, failure: 2 });
    // Finishing (rather than failing) the entry keeps the request file and its manifest intact
    expect(entry.files.map(({ kind }) => kind).sort()).toEqual(['request', 'results']);
  });

  it('keeps the failed status when a request fails before any record is mapped', async () => {
    const data = [buildRequest('g1', 'network down', [])];
    const handle = startDataHistoryEntry({
      org,
      source: 'load-multi-object',
      operation: 'insert',
      api: 'composite-graph',
      sobjects: [],
    });
    await finalizeMultiObjectHistory(handle, { rows: buildRows(data), requests: data });

    const [entry] = await dataHistoryDb.getAllEntries();
    expect(entry.status).toBe('failed');
    expect(entry.counts).toEqual({ total: 0, success: 0, failure: 0 });
  });

  it('marks a cancelled run failed (not partial) when every attempted record failed and nothing succeeded', async () => {
    const failedRequest = buildRequest('g1', 'network down', [{ referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: null }]);
    // Never sent — the run was cancelled before this request started, so its record stays pending
    const pendingRequest = buildRequest('g2', undefined, [{ referenceId: 'r2', sobject: 'Account', operation: 'INSERT', body: null }]);
    pendingRequest.results = null;
    pendingRequest.dataWithResultsByGraphId['g2-graph'].isSuccess = null;
    const data = [failedRequest, pendingRequest];

    const handle = startDataHistoryEntry({
      org,
      source: 'load-multi-object',
      operation: 'insert',
      api: 'composite-graph',
      sobjects: ['Account'],
    });
    await finalizeMultiObjectHistory(handle, { rows: buildRows(data), requests: data });

    const [entry] = await dataHistoryDb.getAllEntries();
    expect(entry.status).toBe('failed');
    expect(entry.counts).toEqual({ total: 1, success: 0, failure: 1 });
    expect(entry.errorMessage).toContain('cancelled');
  });
});

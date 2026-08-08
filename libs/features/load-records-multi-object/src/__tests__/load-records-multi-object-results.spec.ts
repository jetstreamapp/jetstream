import { describe, expect, it } from 'vitest';
import {
  buildMultiObjectRequestExport,
  buildMultiObjectResultRows,
  getMultiObjectCounts,
  MULTI_OBJECT_RESULTS_HEADER,
} from '../load-records-multi-object-results';
import { LoadMultiObjectRequestWithResult } from '../load-records-multi-object-types';

/**
 * Build a single multi-object request-with-result fixture. `records` maps a reference id to the
 * per-record {sobject, operation} plus the composite response body (null body = a group that failed
 * before any response, driven separately via `errorMessage`).
 */
function buildRequest(
  key: string,
  {
    isSuccessful = true,
    errorMessage,
    records,
  }: {
    isSuccessful?: boolean;
    errorMessage?: string;
    records: { referenceId: string; sobject: string; operation: 'INSERT' | 'UPDATE' | 'UPSERT'; body: Record<string, unknown> | null }[];
  },
): LoadMultiObjectRequestWithResult {
  const recordWithResponseByRefId = Object.fromEntries(
    records.map(({ referenceId, sobject, operation }) => [
      referenceId,
      { referenceId, sobject, operation, request: {} as any, response: null },
    ]),
  );
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
            isSuccessful,
            graphResponse: {
              compositeResponse: records.map(({ referenceId, body }) => ({
                referenceId,
                body,
                httpHeaders: {},
                httpStatusCode: 200,
              })),
            },
          } as any,
        ],
    dataWithResultsByGraphId: {
      [`${key}-graph`]: { graphId: `${key}-graph`, isSuccess: isSuccessful, compositeRequest: [], compositeResponse: null },
    },
    recordWithResponseByRefId: recordWithResponseByRefId as any,
  };
}

describe('buildMultiObjectResultRows', () => {
  it('flattens each per-record composite response into a result row', () => {
    const data = [
      buildRequest('g1', {
        records: [
          { referenceId: 'ref1', sobject: 'Account', operation: 'INSERT', body: { id: '001A', success: true, created: true } },
          { referenceId: 'ref2', sobject: 'Contact', operation: 'UPDATE', body: { id: '003B', success: true } },
        ],
      }),
    ];
    const rows = buildMultiObjectResultRows(data, 'results');
    expect(rows).toEqual([
      {
        Group: 'g1-graph',
        Object: 'Account',
        Operation: 'INSERT',
        'External Id': undefined,
        'Reference Id': 'ref1',
        Id: '001A',
        Success: true,
        Created: true,
        Error: '',
      },
      {
        Group: 'g1-graph',
        Object: 'Contact',
        Operation: 'UPDATE',
        'External Id': undefined,
        'Reference Id': 'ref2',
        Id: '003B',
        Success: true,
        Created: false,
        Error: '',
      },
    ]);
  });

  it('derives Created for a successful INSERT even without a created flag', () => {
    const data = [
      buildRequest('g1', {
        records: [{ referenceId: 'ref1', sobject: 'Account', operation: 'INSERT', body: { id: '001A', success: true } }],
      }),
    ];
    expect(buildMultiObjectResultRows(data, 'results')[0].Created).toBe(true);
  });

  it('formats an error row and defaults a 204 (null body) to success', () => {
    const data = [
      buildRequest('g1', {
        isSuccessful: false,
        records: [
          {
            referenceId: 'ref1',
            sobject: 'Account',
            operation: 'UPDATE',
            body: { success: false, errorCode: 'FIELD_INTEGRITY', message: 'bad' },
          },
          { referenceId: 'ref2', sobject: 'Account', operation: 'UPDATE', body: null },
        ],
      }),
    ];
    const rows = buildMultiObjectResultRows(data, 'results');
    expect(rows[0].Error).toBe('FIELD_INTEGRITY: bad');
    expect(rows[0].Success).toBe(false);
    // null body (PATCH 204) is treated as a success with an empty id
    expect(rows[1]).toMatchObject({ Success: true, Id: '', Error: '' });
  });

  it('keeps only unsuccessful graphs when which=failures', () => {
    const data = [
      buildRequest('ok', {
        isSuccessful: true,
        records: [{ referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: { id: '1', success: true } }],
      }),
      buildRequest('bad', {
        isSuccessful: false,
        records: [{ referenceId: 'r2', sobject: 'Account', operation: 'INSERT', body: { success: false, errorCode: 'X', message: 'y' } }],
      }),
    ];
    const rows = buildMultiObjectResultRows(data, 'failures');
    expect(rows).toHaveLength(1);
    expect(rows[0]['Reference Id']).toBe('r2');
  });

  it('produces no rows for a group that failed outright (results null)', () => {
    const data = [
      buildRequest('g1', { errorMessage: 'boom', records: [{ referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: null }] }),
    ];
    expect(buildMultiObjectResultRows(data, 'results')).toEqual([]);
  });
});

describe('getMultiObjectCounts', () => {
  it('counts per-record successes and failures across groups', () => {
    const data = [
      buildRequest('g1', {
        isSuccessful: false,
        records: [
          { referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: { id: '1', success: true } },
          { referenceId: 'r2', sobject: 'Account', operation: 'INSERT', body: { success: false, errorCode: 'X', message: 'y' } },
        ],
      }),
    ];
    expect(getMultiObjectCounts(data)).toEqual({ total: 2, success: 1, failure: 1 });
  });

  it('counts every record of an outright-failed group as a failure', () => {
    const data = [
      buildRequest('g1', {
        errorMessage: 'network down',
        records: [
          { referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: null },
          { referenceId: 'r2', sobject: 'Account', operation: 'INSERT', body: null },
        ],
      }),
    ];
    expect(getMultiObjectCounts(data)).toEqual({ total: 2, success: 0, failure: 2 });
  });
});

describe('buildMultiObjectRequestExport', () => {
  it('maps each group to { groupId, data } from dataWithResultsByGraphId', () => {
    const data = [
      buildRequest('g1', { records: [{ referenceId: 'r1', sobject: 'Account', operation: 'INSERT', body: { id: '1', success: true } }] }),
    ];
    const exported = buildMultiObjectRequestExport(data);
    expect(exported).toHaveLength(1);
    expect(exported[0].groupId).toBe('g1');
    expect(Array.isArray(exported[0].data)).toBe(true);
  });
});

describe('MULTI_OBJECT_RESULTS_HEADER', () => {
  it('matches the flattened result row keys', () => {
    expect(MULTI_OBJECT_RESULTS_HEADER).toEqual([
      'Group',
      'Object',
      'Operation',
      'External Id',
      'Reference Id',
      'Id',
      'Success',
      'Created',
      'Error',
    ]);
  });
});

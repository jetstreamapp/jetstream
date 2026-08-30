import type { ApexTestRunResultRecord } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { mergeRuns } from '../useApexTestRunsList';

function buildRun(
  overrides: Partial<ApexTestRunResultRecord> & Pick<ApexTestRunResultRecord, 'Id' | 'AsyncApexJobId'>,
): ApexTestRunResultRecord {
  return {
    Status: 'Completed',
    ClassesEnqueued: 1,
    ClassesCompleted: 1,
    MethodsEnqueued: 2,
    MethodsCompleted: 2,
    MethodsFailed: 0,
    StartTime: null,
    EndTime: null,
    TestTime: null,
    UserId: '005000000000001AAA',
    User: null,
    CreatedDate: '2026-08-26T00:00:00.000Z',
    ...overrides,
  };
}

function buildOptimisticRun(asyncApexJobId: string, createdDate: string): ApexTestRunResultRecord {
  return buildRun({
    Id: `optimistic-${asyncApexJobId}`,
    AsyncApexJobId: asyncApexJobId,
    Status: 'Queued',
    ClassesCompleted: null,
    MethodsEnqueued: null,
    MethodsCompleted: null,
    MethodsFailed: null,
    CreatedDate: createdDate,
  });
}

describe('mergeRuns', () => {
  it('drops an optimistic placeholder once the real record for the same job arrives', () => {
    // Optimistic ids come from runTestsAsynchronous (15-char), fetched records have 18-char ids
    const optimistic = buildOptimisticRun('707000000000001', '2026-08-26T01:00:00.000Z');
    const realRun = buildRun({
      Id: '707000000000002XYZ',
      AsyncApexJobId: '707000000000001ABC',
      Status: 'Processing',
      CreatedDate: '2026-08-26T01:00:01.000Z',
    });

    const merged = mergeRuns([optimistic], [realRun]);

    expect(merged).toEqual([realRun]);
  });

  it('retains an optimistic placeholder until its job shows up in the fetched list', () => {
    const optimistic = buildOptimisticRun('707000000000001', '2026-08-26T02:00:00.000Z');
    const unrelatedRun = buildRun({
      Id: '707000000000009XYZ',
      AsyncApexJobId: '707000000000008ABC',
      CreatedDate: '2026-08-26T01:00:00.000Z',
    });

    const merged = mergeRuns([optimistic], [unrelatedRun]);

    expect(merged).toEqual([optimistic, unrelatedRun]);
  });

  it('retains prior real rows that fell out of the fetch window', () => {
    const olderRun = buildRun({
      Id: '707000000000001XYZ',
      AsyncApexJobId: '707000000000011ABC',
      CreatedDate: '2026-08-25T00:00:00.000Z',
    });
    const newerRun = buildRun({
      Id: '707000000000002XYZ',
      AsyncApexJobId: '707000000000012ABC',
      CreatedDate: '2026-08-26T00:00:00.000Z',
    });

    const merged = mergeRuns([olderRun], [newerRun]);

    expect(merged).toEqual([newerRun, olderRun]);
  });

  it('replaces a prior row with the freshly fetched version of the same record', () => {
    const priorVersion = buildRun({
      Id: '707000000000001XYZ',
      AsyncApexJobId: '707000000000011ABC',
      Status: 'Processing',
      MethodsCompleted: 1,
    });
    const fetchedVersion = { ...priorVersion, Status: 'Completed' as const, MethodsCompleted: 2 };

    const merged = mergeRuns([priorVersion], [fetchedVersion]);

    expect(merged).toEqual([fetchedVersion]);
  });

  it('sorts the merged list by CreatedDate descending', () => {
    const oldest = buildRun({
      Id: '707000000000001XYZ',
      AsyncApexJobId: '707000000000011ABC',
      CreatedDate: '2026-08-24T00:00:00.000Z',
    });
    const middle = buildRun({
      Id: '707000000000002XYZ',
      AsyncApexJobId: '707000000000012ABC',
      CreatedDate: '2026-08-25T00:00:00.000Z',
    });
    const newest = buildRun({
      Id: '707000000000003XYZ',
      AsyncApexJobId: '707000000000013ABC',
      CreatedDate: '2026-08-26T00:00:00.000Z',
    });

    const merged = mergeRuns([middle, oldest], [newest]);

    expect(merged).toEqual([newest, middle, oldest]);
  });
});

import type { SalesforceOrgUi } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runFieldUsageQueryForObjects } from '../run-field-usage';

const { describeMock, queryMock, queryMoreMock } = vi.hoisted(() => ({
  describeMock: vi.fn(),
  queryMock: vi.fn(),
  queryMoreMock: vi.fn(),
}));

vi.mock('@jetstream/shared/data', () => {
  async function queryWithRecordBudget(
    org: unknown,
    soql: string,
    isTooling: boolean,
    budget: { remaining: number },
    onPage: (records: Record<string, unknown>[]) => void,
  ): Promise<{ truncated: boolean }> {
    let response = await queryMock(org, soql, isTooling);
    while (true) {
      const records = response.queryResults.records as Record<string, unknown>[];
      if (budget.remaining <= 0) {
        return { truncated: true };
      }
      if (records.length > budget.remaining) {
        onPage(records.slice(0, budget.remaining));
        budget.remaining = 0;
        return { truncated: true };
      }
      onPage(records);
      budget.remaining -= records.length;
      if (response.queryResults.done) {
        break;
      }
      const nextUrl = response.queryResults.nextRecordsUrl;
      if (!nextUrl) {
        break;
      }
      response = await queryMoreMock(org, nextUrl, isTooling);
    }
    return { truncated: false };
  }
  return {
    describeSObject: describeMock,
    query: queryMock,
    queryMore: queryMoreMock,
    queryWithRecordBudget,
  };
});

const fakeOrg = { uniqueId: 'org-1' } as unknown as SalesforceOrgUi;

function buildDescribe() {
  return {
    data: {
      label: 'Account',
      queryable: true,
      custom: false,
      fields: [
        {
          name: 'Id',
          label: 'Id',
          type: 'id',
          queryable: true,
          calculated: false,
          custom: false,
          autoNumber: false,
          externalId: false,
          nameField: false,
          length: 18,
          scale: 0,
        },
        {
          name: 'LastModifiedDate',
          label: 'LMD',
          type: 'datetime',
          queryable: true,
          calculated: false,
          custom: false,
          autoNumber: false,
          externalId: false,
          nameField: false,
          length: 0,
          scale: 0,
        },
        {
          name: 'Name',
          label: 'Name',
          type: 'string',
          queryable: true,
          calculated: false,
          custom: false,
          autoNumber: false,
          externalId: false,
          nameField: true,
          length: 255,
          scale: 0,
        },
        {
          name: 'Industry',
          label: 'Industry',
          type: 'picklist',
          queryable: true,
          calculated: false,
          custom: false,
          autoNumber: false,
          externalId: false,
          nameField: false,
          length: 0,
          scale: 0,
        },
      ],
    },
  };
}

function buildPage(records: Record<string, unknown>[], nextRecordsUrl: string | null) {
  return {
    queryResults: {
      done: nextRecordsUrl == null,
      records,
      ...(nextRecordsUrl ? { nextRecordsUrl } : {}),
    },
  };
}

describe('runFieldUsageQueryForObjects (streaming)', () => {
  beforeEach(() => {
    describeMock.mockReset();
    queryMock.mockReset();
    queryMoreMock.mockReset();
  });

  it('aggregates 1000 records across 5 pages without retaining record arrays', async () => {
    describeMock.mockResolvedValue(buildDescribe());

    const pageSize = 200;
    const totalPages = 5;
    const pages: Record<string, unknown>[][] = [];
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const records: Record<string, unknown>[] = [];
      for (let recordIndex = 0; recordIndex < pageSize; recordIndex++) {
        const globalIndex = pageIndex * pageSize + recordIndex;
        records.push({
          Id: `001${String(globalIndex).padStart(15, '0')}`,
          LastModifiedDate: `2026-01-${String((globalIndex % 28) + 1).padStart(2, '0')}T00:00:00.000+0000`,
          Name: globalIndex % 2 === 0 ? `Account ${globalIndex}` : '',
          Industry: globalIndex < 100 ? 'Technology' : null,
        });
      }
      pages.push(records);
    }

    queryMock.mockResolvedValueOnce(buildPage(pages[0], '/q/next-1'));
    queryMoreMock
      .mockResolvedValueOnce(buildPage(pages[1], '/q/next-2'))
      .mockResolvedValueOnce(buildPage(pages[2], '/q/next-3'))
      .mockResolvedValueOnce(buildPage(pages[3], '/q/next-4'))
      .mockResolvedValueOnce(buildPage(pages[4], null));

    const progressEvents: { current: number; total: number; percent: number; label: string }[] = [];
    const result = await runFieldUsageQueryForObjects(fakeOrg, ['Account'], {
      onProgress: (progress) => progressEvents.push(progress),
    });

    expect(result.failedObjects).toEqual([]);
    expect(result.anyQueryTruncated).toBe(false);

    const account = result.objects.Account;
    expect(account).toBeDefined();
    expect(account.totalRecords).toBe(1000);
    expect(account.queryTruncated).toBe(false);

    // Half the rows have a non-empty Name (even indices) — 500 filled out of 1000.
    expect(account.fieldUsage.Name.filled).toBe(500);
    expect(account.fieldUsage.Name.pct).toBeCloseTo(50, 5);
    // First 100 rows have an Industry value.
    expect(account.fieldUsage.Industry.filled).toBe(100);
    expect(account.fieldUsage.Industry.pct).toBeCloseTo(10, 5);

    // Latest filled row modified for Name is the largest even index in any page (998 → day 27).
    expect(account.fieldUsage.Name.latestFilledRowModified).toBe('2026-01-27T00:00:00.000+0000');

    expect(progressEvents).toHaveLength(1);
    expect(progressEvents[0]).toEqual({
      current: 1,
      total: 1,
      percent: 100,
      label: 'Analyzing Account (1 of 1)',
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMoreMock).toHaveBeenCalledTimes(4);
  });

  it('throws when the cancellation signal trips between objects', async () => {
    describeMock.mockResolvedValue(buildDescribe());
    queryMock.mockResolvedValue(buildPage([], null));

    let cancelCalls = 0;
    const promise = runFieldUsageQueryForObjects(fakeOrg, ['Account'], {
      isCanceled: () => {
        cancelCalls += 1;
        return cancelCalls > 0;
      },
    });

    await expect(promise).rejects.toThrow('Job canceled');
  });
});

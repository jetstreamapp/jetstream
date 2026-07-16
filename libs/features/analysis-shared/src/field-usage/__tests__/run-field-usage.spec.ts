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
        {
          name: 'Active__c',
          label: 'Active',
          type: 'boolean',
          queryable: true,
          calculated: false,
          custom: true,
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
          // Checkbox: never null in SOQL — true on first 250 rows, false on the rest.
          Active__c: globalIndex < 250,
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

    // Checkbox fields count only `true` (250 of 1000), NOT every non-null value — otherwise every
    // checkbox would read 100% and hide genuinely-unused (all-false) checkboxes.
    expect(account.fieldUsage.Active__c.filled).toBe(250);
    expect(account.fieldUsage.Active__c.pct).toBeCloseTo(25, 5);
    expect(account.fieldUsage.Active__c.scanned).toBe(1000);

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

  it('uses an exact server-side COUNT aggregate for aggregatable fields (no row scan, no truncation)', async () => {
    describeMock.mockResolvedValue({
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
            aggregatable: true,
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
            aggregatable: true,
          },
          {
            name: 'Custom_Text__c',
            label: 'Text',
            type: 'string',
            queryable: true,
            calculated: false,
            custom: true,
            autoNumber: false,
            externalId: false,
            nameField: false,
            length: 255,
            scale: 0,
            aggregatable: true,
          },
        ],
      },
    });

    // The COUNT aggregate returns a single row: total records + non-null count per field alias.
    queryMock.mockImplementation(async (_org: unknown, soql: string) => {
      if (typeof soql === 'string' && soql.includes('COUNT(')) {
        return { queryResults: { done: true, totalSize: 1, records: [{ total: 1000, c0: 300 }] } };
      }
      throw new Error(`Unexpected non-aggregate query: ${String(soql)}`);
    });

    const result = await runFieldUsageQueryForObjects(fakeOrg, ['Account']);

    const account = result.objects.Account;
    expect(account.totalRecords).toBe(1000);
    expect(account.queryTruncated).toBe(false);
    expect(result.anyQueryTruncated).toBe(false);
    expect(account.fieldUsage.Custom_Text__c.filled).toBe(300);
    expect(account.fieldUsage.Custom_Text__c.pct).toBeCloseTo(30, 5);
    expect(account.fieldUsage.Custom_Text__c.scanned).toBe(1000);
    // COUNT cannot report a per-field latest-modified, so it is null (not fabricated).
    expect(account.fieldUsage.Custom_Text__c.latestFilledRowModified).toBeNull();
    // No row scan happened — only the aggregate query.
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMoreMock).not.toHaveBeenCalled();
    expect(queryMock.mock.calls[0][1]).toContain('COUNT(');
  });

  it('marks only row-scanned fields truncated; COUNT-based fields stay exact', async () => {
    describeMock.mockResolvedValue({
      data: {
        label: 'Account',
        queryable: true,
        custom: false,
        fields: [
          { name: 'Id', label: 'Id', type: 'id', calculated: false, custom: false, autoNumber: false, length: 18, scale: 0 },
          { name: 'LastModifiedDate', label: 'LMD', type: 'datetime', calculated: false, custom: false, autoNumber: false, scale: 0 },
          {
            name: 'Custom_Text__c',
            label: 'Text',
            type: 'string',
            calculated: false,
            custom: true,
            autoNumber: false,
            length: 255,
            scale: 0,
            aggregatable: true,
          },
          {
            name: 'Active__c',
            label: 'Active',
            type: 'boolean',
            calculated: false,
            custom: true,
            autoNumber: false,
            scale: 0,
            aggregatable: true, // booleans never COUNT — still row-scanned
          },
        ],
      },
    });

    // One page larger than the 100K row budget forces the boolean's row scan to truncate.
    const overBudgetPage = Array.from({ length: 100_001 }, (_, index) => ({
      Id: `001${String(index).padStart(15, '0')}`,
      LastModifiedDate: '2026-01-01T00:00:00.000+0000',
      Active__c: index % 2 === 0,
    }));
    queryMock.mockImplementation(async (_org: unknown, soql: string) => {
      if (typeof soql === 'string' && soql.includes('COUNT(')) {
        return { queryResults: { done: true, totalSize: 1, records: [{ total: 250_000, c0: 90_000 }] } };
      }
      return { queryResults: { done: true, records: overBudgetPage } };
    });

    const result = await runFieldUsageQueryForObjects(fakeOrg, ['Account']);

    const account = result.objects.Account;
    expect(account.queryTruncated).toBe(true);
    expect(result.anyQueryTruncated).toBe(true);
    // The scanned boolean hit the row budget — flagged per-field.
    expect(account.fieldUsage.Active__c.truncated).toBe(true);
    expect(account.fieldUsage.Active__c.scanned).toBe(100_000);
    // The COUNT-based field is exact across all 250K rows despite the sibling scan truncating.
    expect(account.fieldUsage.Custom_Text__c.truncated).toBe(false);
    expect(account.fieldUsage.Custom_Text__c.filled).toBe(90_000);
    expect(account.fieldUsage.Custom_Text__c.scanned).toBe(250_000);
  });

  it('reports the scanned row count as totalRecords when every COUNT aggregate fails and falls back to a row scan', async () => {
    describeMock.mockResolvedValue({
      data: {
        label: 'Account',
        queryable: true,
        custom: false,
        fields: [
          { name: 'Id', label: 'Id', type: 'id', calculated: false, custom: false, autoNumber: false, length: 18, scale: 0 },
          { name: 'LastModifiedDate', label: 'LMD', type: 'datetime', calculated: false, custom: false, autoNumber: false, scale: 0 },
          {
            name: 'Custom_Text__c',
            label: 'Text',
            type: 'string',
            calculated: false,
            custom: true,
            autoNumber: false,
            length: 255,
            scale: 0,
            aggregatable: true, // COUNT-eligible, so it takes the aggregate path first…
          },
        ],
      },
    });

    // …but the COUNT aggregate times out (as it does on very large objects), forcing the field to the
    // row-scan fallback. The scan reads 3 rows; totalRecords must be that scanned count, not 0.
    const scanPage = [
      { Id: '001000000000000000', LastModifiedDate: '2026-01-01T00:00:00.000+0000', Custom_Text__c: 'a' },
      { Id: '001000000000000001', LastModifiedDate: '2026-01-02T00:00:00.000+0000', Custom_Text__c: '' },
      { Id: '001000000000000002', LastModifiedDate: '2026-01-03T00:00:00.000+0000', Custom_Text__c: 'b' },
    ];
    queryMock.mockImplementation(async (_org: unknown, soql: string) => {
      if (typeof soql === 'string' && soql.includes('COUNT(')) {
        throw new Error('QUERY_TIMEOUT');
      }
      return { queryResults: { done: true, records: scanPage } };
    });

    const result = await runFieldUsageQueryForObjects(fakeOrg, ['Account']);

    const account = result.objects.Account;
    // Regression: previously countTotal=0 pinned totalRecords to 0 despite the scan reading 3 rows.
    expect(account.totalRecords).toBe(3);
    expect(account.fieldUsage.Custom_Text__c.filled).toBe(2);
    expect(account.fieldUsage.Custom_Text__c.scanned).toBe(3);
    // A COUNT was attempted (and failed) before the scan ran.
    expect(queryMock.mock.calls.some(([, soql]) => typeof soql === 'string' && soql.includes('COUNT('))).toBe(true);
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

import type { SalesforceOrgUi } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryWithRecordBudget } from '../data-utils';

const { mockedQuery, mockedQueryMore } = vi.hoisted(() => ({
  mockedQuery: vi.fn(),
  mockedQueryMore: vi.fn(),
}));

vi.mock('../client-data', () => ({
  query: mockedQuery,
  queryMore: mockedQueryMore,
}));

const ORG = { uniqueId: 'org-1' } as unknown as SalesforceOrgUi;

function page(records: Record<string, unknown>[], nextRecordsUrl?: string) {
  return {
    queryResults: {
      records,
      done: !nextRecordsUrl,
      totalSize: records.length,
      ...(nextRecordsUrl ? { nextRecordsUrl } : {}),
    },
  };
}

function rows(count: number, offset = 0): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => ({ Id: `00${offset + index}` }));
}

describe('queryWithRecordBudget', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedQueryMore.mockReset();
  });

  it('returns all records without truncation when the budget is not exhausted', async () => {
    mockedQuery.mockResolvedValue(page(rows(3)));
    const budget = { remaining: 10 };
    const collected: Record<string, unknown>[] = [];

    const result = await queryWithRecordBudget(ORG, 'SELECT Id FROM Account', false, budget, (records) => collected.push(...records));

    expect(result.truncated).toBe(false);
    expect(collected).toHaveLength(3);
    expect(budget.remaining).toBe(7);
  });

  it('follows nextRecordsUrl across pages and decrements the budget per record', async () => {
    mockedQuery.mockResolvedValue(page(rows(2), '/next/1'));
    mockedQueryMore.mockResolvedValueOnce(page(rows(2, 2), '/next/2')).mockResolvedValueOnce(page(rows(1, 4)));
    const budget = { remaining: 10 };
    const collected: Record<string, unknown>[] = [];

    const result = await queryWithRecordBudget(ORG, 'SELECT Id FROM Account', false, budget, (records) => collected.push(...records));

    expect(result.truncated).toBe(false);
    expect(collected).toHaveLength(5);
    expect(budget.remaining).toBe(5);
    expect(mockedQueryMore).toHaveBeenCalledTimes(2);
  });

  it('slices the page and reports truncated when a page exceeds the remaining budget', async () => {
    mockedQuery.mockResolvedValue(page(rows(5), '/next/1'));
    const budget = { remaining: 3 };
    const collected: Record<string, unknown>[] = [];

    const result = await queryWithRecordBudget(ORG, 'SELECT Id FROM Account', false, budget, (records) => collected.push(...records));

    expect(result.truncated).toBe(true);
    expect(collected).toHaveLength(3);
    expect(budget.remaining).toBe(0);
    expect(mockedQueryMore).not.toHaveBeenCalled();
  });

  it('consumes a page that exactly matches the remaining budget, then truncates on the next page', async () => {
    mockedQuery.mockResolvedValue(page(rows(3), '/next/1'));
    mockedQueryMore.mockResolvedValue(page(rows(2, 3)));
    const budget = { remaining: 3 };
    const collected: Record<string, unknown>[] = [];

    const result = await queryWithRecordBudget(ORG, 'SELECT Id FROM Account', false, budget, (records) => collected.push(...records));

    // The exact-fit page is delivered in full; the follow-up page finds the budget at 0 and reports truncation.
    expect(result.truncated).toBe(true);
    expect(collected).toHaveLength(3);
    expect(budget.remaining).toBe(0);
  });

  it('reports truncated immediately when called with an exhausted budget', async () => {
    mockedQuery.mockResolvedValue(page(rows(2)));
    const budget = { remaining: 0 };
    const collected: Record<string, unknown>[] = [];

    const result = await queryWithRecordBudget(ORG, 'SELECT Id FROM Account', false, budget, (records) => collected.push(...records));

    expect(result.truncated).toBe(true);
    expect(collected).toHaveLength(0);
  });

  it('shares one budget across sequential calls (category-level budgeting)', async () => {
    mockedQuery.mockResolvedValueOnce(page(rows(4))).mockResolvedValueOnce(page(rows(4, 4)));
    const budget = { remaining: 6 };
    const collected: Record<string, unknown>[] = [];

    const first = await queryWithRecordBudget(ORG, 'SELECT Id FROM A', false, budget, (records) => collected.push(...records));
    const second = await queryWithRecordBudget(ORG, 'SELECT Id FROM B', false, budget, (records) => collected.push(...records));

    expect(first.truncated).toBe(false);
    expect(second.truncated).toBe(true);
    expect(collected).toHaveLength(6);
    expect(budget.remaining).toBe(0);
  });
});

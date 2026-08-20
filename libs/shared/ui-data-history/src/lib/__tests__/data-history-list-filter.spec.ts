import { DataHistoryItem } from '@jetstream/types';
import { dataHistoryDb, getDexieDb } from '@jetstream/ui/db';
import { beforeEach, describe, expect, it } from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

async function seedEntry(overrides: Partial<DataHistoryItem> = {}): Promise<DataHistoryItem> {
  const now = overrides.createdAt ?? new Date();
  const item: DataHistoryItem = {
    key: overrides.key ?? dataHistoryDb.generateKey(),
    org: 'org-1',
    orgLabel: 'Org 1',
    source: 'load-records',
    operation: 'insert',
    api: 'bulk-v1',
    sobjects: ['Account'],
    status: 'success',
    counts: { total: 1, success: 1, failure: 0 },
    config: {},
    files: [],
    storageBackend: 'opfs',
    sizeBytes: 0,
    pinned: false,
    pinnedIdx: 'false',
    errorMessage: null,
    startedAt: now,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  await dataHistoryDb.saveEntry(item);
  return item;
}

/**
 * These query paths are what makes LIST_LIMIT a page size rather than a ceiling on history — the
 * Data History page narrows through them so entries past the newest 1000 stay reachable.
 */
describe('dataHistoryDb.getEntries filtering', () => {
  beforeEach(async () => {
    await getDexieDb().data_history.clear();
  });

  it('returns everything newest-first by default', async () => {
    await seedEntry({ key: 'dh_old', createdAt: daysAgo(10) });
    await seedEntry({ key: 'dh_new', createdAt: daysAgo(1) });
    await seedEntry({ key: 'dh_mid', createdAt: daysAgo(5) });

    expect((await dataHistoryDb.getEntries({})).map(({ key }) => key)).toEqual(['dh_new', 'dh_mid', 'dh_old']);
  });

  it('narrows to a single org via the [org+createdAt] index, still newest-first', async () => {
    await seedEntry({ key: 'dh_a_old', org: 'org-a', createdAt: daysAgo(9) });
    await seedEntry({ key: 'dh_b', org: 'org-b', createdAt: daysAgo(5) });
    await seedEntry({ key: 'dh_a_new', org: 'org-a', createdAt: daysAgo(2) });

    expect((await dataHistoryDb.getEntries({ org: 'org-a' })).map(({ key }) => key)).toEqual(['dh_a_new', 'dh_a_old']);
  });

  it('bounds by date inclusively at both ends', async () => {
    const cutoff = daysAgo(5);
    await seedEntry({ key: 'dh_before', createdAt: daysAgo(9) });
    await seedEntry({ key: 'dh_on_cutoff', createdAt: cutoff });
    await seedEntry({ key: 'dh_after', createdAt: daysAgo(1) });

    expect((await dataHistoryDb.getEntries({ createdAfter: cutoff })).map(({ key }) => key)).toEqual(['dh_after', 'dh_on_cutoff']);
    expect((await dataHistoryDb.getEntries({ createdBefore: cutoff })).map(({ key }) => key)).toEqual(['dh_on_cutoff', 'dh_before']);
  });

  it('combines org and date range', async () => {
    await seedEntry({ key: 'dh_a_stale', org: 'org-a', createdAt: daysAgo(20) });
    await seedEntry({ key: 'dh_a_hit', org: 'org-a', createdAt: daysAgo(5) });
    await seedEntry({ key: 'dh_b_hit_window', org: 'org-b', createdAt: daysAgo(5) });

    const results = await dataHistoryDb.getEntries({ org: 'org-a', createdAfter: daysAgo(10), createdBefore: daysAgo(1) });
    expect(results.map(({ key }) => key)).toEqual(['dh_a_hit']);
  });

  /** The limit must apply to the FILTERED set, otherwise narrowing could not reach older entries */
  it('applies the limit to the newest matching entries, not to history as a whole', async () => {
    for (let i = 0; i < 5; i++) {
      await seedEntry({ key: `dh_recent_${i}`, org: 'org-b', createdAt: daysAgo(i) });
    }
    await seedEntry({ key: 'dh_ancient', org: 'org-a', createdAt: daysAgo(400) });

    // A global limit of 1 only ever surfaces the newest entry...
    expect((await dataHistoryDb.getEntries({ limit: 1 })).map(({ key }) => key)).toEqual(['dh_recent_0']);
    // ...but narrowing by org reaches the old one despite the same limit
    expect((await dataHistoryDb.getEntries({ org: 'org-a', limit: 1 })).map(({ key }) => key)).toEqual(['dh_ancient']);
  });
});

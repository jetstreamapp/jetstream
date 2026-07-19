import { DataHistoryItem } from '@jetstream/types';
import { dataHistoryDb, dexieDb } from '@jetstream/ui/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runDataHistoryRetentionSweep } from '../data-history-retention';
import { initDataHistory, updateDataHistoryRetentionSettings } from '../data-history.service';
import { FakeFileStore } from '../file-store/fake-file-store';
import { setHistoryFileStoreForTests } from '../file-store/file-store-factory';

const DAY_MS = 24 * 60 * 60 * 1000;
const TEXT_ENCODER = new TextEncoder();

let fakeStore: FakeFileStore;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

async function seedEntry(overrides: Partial<DataHistoryItem> & { withFile?: boolean } = {}): Promise<DataHistoryItem> {
  const { withFile, ...itemOverrides } = overrides;
  const key = itemOverrides.key ?? dataHistoryDb.generateKey();
  const now = new Date();
  const item: DataHistoryItem = {
    key,
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
    inlinePayload: null,
    pinned: false,
    pinnedIdx: 'false',
    errorMessage: null,
    startedAt: now,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
    ...itemOverrides,
  };
  if (withFile) {
    const path = `org-1-folder/${key}/results.csv.gz`;
    await fakeStore.writeFile(path, TEXT_ENCODER.encode('_id,_success\n001,true'), { gzip: true });
    const bytes = fakeStore.files.get(path)?.bytes.byteLength ?? 0;
    item.files = [{ kind: 'results', path, fileName: 'results.csv.gz', contentType: 'text/csv', compressed: true, bytes }];
    item.sizeBytes = item.sizeBytes || bytes;
  }
  await dataHistoryDb.saveEntry(item);
  return item;
}

// Free tier (jsdom is none of desktop/extension/canvas): 60-day retention, 500MB cap
describe('runDataHistoryRetentionSweep', () => {
  beforeAll(async () => {
    await initDataHistory({ hasPaidPlan: false });
  });

  beforeEach(async () => {
    await dexieDb.data_history.clear();
    await dexieDb.data_history_config.clear();
    fakeStore = new FakeFileStore();
    setHistoryFileStoreForTests(fakeStore);
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('reclassifies stranded in-progress entries and leaves recent ones alone', async () => {
    const stranded = await seedEntry({ status: 'in-progress', startedAt: daysAgo(2) });
    const active = await seedEntry({ status: 'in-progress', startedAt: new Date(Date.now() - 60_000) });

    await runDataHistoryRetentionSweep();

    expect((await dataHistoryDb.getEntry(stranded.key))?.status).toBe('incomplete');
    expect((await dataHistoryDb.getEntry(active.key))?.status).toBe('in-progress');
  });

  it('prunes entries past the retention window, keeping pinned ones', async () => {
    const expired = await seedEntry({ createdAt: daysAgo(61), withFile: true });
    const expiredPinned = await seedEntry({ createdAt: daysAgo(90), pinned: true, pinnedIdx: 'true' });
    const fresh = await seedEntry({ createdAt: daysAgo(5) });

    await runDataHistoryRetentionSweep();

    expect(await dataHistoryDb.getEntry(expired.key)).toBeUndefined();
    expect(fakeStore.files.has(expired.files[0].path)).toBe(false);
    expect(await dataHistoryDb.getEntry(expiredPinned.key)).toBeTruthy();
    expect(await dataHistoryDb.getEntry(fresh.key)).toBeTruthy();
  });

  it('enforces the free-tier entry-count cap (15), keeping pinned entries', async () => {
    const entries: DataHistoryItem[] = [];
    for (let i = 0; i < 18; i++) {
      entries.push(await seedEntry({ createdAt: daysAgo(18 - i) }));
    }
    const pinnedOldest = entries[0];
    await dataHistoryDb.updateEntry(pinnedOldest.key, { pinned: true });

    await runDataHistoryRetentionSweep();

    expect(await dataHistoryDb.getEntryCount()).toBe(15);
    // pinned oldest survives; the oldest UNPINNED entries were removed instead
    expect(await dataHistoryDb.getEntry(pinnedOldest.key)).toBeTruthy();
    expect(await dataHistoryDb.getEntry(entries[1].key)).toBeUndefined();
    expect(await dataHistoryDb.getEntry(entries[17].key)).toBeTruthy();
  });

  it('prunes oldest-first when over the size cap, keeping pinned entries', async () => {
    const MB_200 = 200 * 1024 * 1024;
    const oldest = await seedEntry({ createdAt: daysAgo(30), sizeBytes: MB_200, withFile: true });
    const oldestPinned = await seedEntry({ createdAt: daysAgo(20), sizeBytes: MB_200, pinned: true, pinnedIdx: 'true' });
    const middle = await seedEntry({ createdAt: daysAgo(10), sizeBytes: MB_200 });
    const newest = await seedEntry({ createdAt: daysAgo(1), sizeBytes: MB_200 });

    // 800MB total > 500MB cap -> delete unpinned oldest-first until under: oldest + middle go
    await runDataHistoryRetentionSweep();

    expect(await dataHistoryDb.getEntry(oldest.key)).toBeUndefined();
    expect(fakeStore.files.has(oldest.files[0].path)).toBe(false);
    expect(await dataHistoryDb.getEntry(middle.key)).toBeUndefined();
    expect(await dataHistoryDb.getEntry(oldestPinned.key)).toBeTruthy();
    expect(await dataHistoryDb.getEntry(newest.key)).toBeTruthy();
  });

  it('respects tightened user retention settings (clamped to tier)', async () => {
    const recentButPastCustomWindow = await seedEntry({ createdAt: daysAgo(10) });
    const veryFresh = await seedEntry({ createdAt: daysAgo(1) });

    await updateDataHistoryRetentionSettings({ retentionDays: 7 });
    // updateDataHistoryRetentionSettings fires a sweep itself, but run explicitly to avoid racing it
    await runDataHistoryRetentionSweep();

    expect(await dataHistoryDb.getEntry(recentButPastCustomWindow.key)).toBeUndefined();
    expect(await dataHistoryDb.getEntry(veryFresh.key)).toBeTruthy();
  });

  it('deletes orphaned entry directories that have no row', async () => {
    const kept = await seedEntry({ withFile: true });
    await fakeStore.writeFile('org-1-folder/dh_orphan/results.csv.gz', TEXT_ENCODER.encode('orphan'), { gzip: true });

    await runDataHistoryRetentionSweep();

    expect(fakeStore.files.has('org-1-folder/dh_orphan/results.csv.gz')).toBe(false);
    expect(fakeStore.files.has(kept.files[0].path)).toBe(true);
  });
});

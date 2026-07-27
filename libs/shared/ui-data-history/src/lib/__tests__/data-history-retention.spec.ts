import { DataHistoryItem } from '@jetstream/types';
import { dataHistoryDb, getDexieDb } from '@jetstream/ui/db';
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
    await getDexieDb().data_history.clear();
    await getDexieDb().data_history_config.clear();
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

  it('does not delete every unpinned entry when one row has a corrupt sizeBytes', async () => {
    const MB_200 = 200 * 1024 * 1024;
    const oldest = await seedEntry({ createdAt: daysAgo(30), sizeBytes: MB_200 });
    // A non-numeric sizeBytes used to poison the running total with NaN, making the loop's
    // "under the cap" exit condition permanently false and wiping out ALL unpinned history
    const corrupt = await seedEntry({ createdAt: daysAgo(20), sizeBytes: undefined as unknown as number });
    const middle = await seedEntry({ createdAt: daysAgo(10), sizeBytes: MB_200 });
    const newest = await seedEntry({ createdAt: daysAgo(1), sizeBytes: MB_200 });

    await runDataHistoryRetentionSweep();

    // 600MB of countable bytes > 500MB cap -> only the oldest needs to go
    expect(await dataHistoryDb.getEntry(oldest.key)).toBeUndefined();
    expect(await dataHistoryDb.getEntry(corrupt.key)).toBeTruthy();
    expect(await dataHistoryDb.getEntry(middle.key)).toBeTruthy();
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

  it('leaves rowless entry dirs alone in user-visible backends — they are recoverable, not garbage', async () => {
    // e.g. a reconnected folder after clearing site data, or a folder shared by two devices
    fakeStore = new FakeFileStore('directory', { compressFiles: false, userVisibleFiles: true, supportsReindex: true });
    setHistoryFileStoreForTests(fakeStore);
    await fakeStore.writeFile('org-1-folder/dh_from_other_device/results.csv', TEXT_ENCODER.encode('data'), { gzip: false });

    await runDataHistoryRetentionSweep();

    expect(fakeStore.files.has('org-1-folder/dh_from_other_device/results.csv')).toBe(true);
  });

  it('never prunes an entry that is still being written, even past the count cap', async () => {
    const inFlight = await seedEntry({ status: 'in-progress', startedAt: new Date(), createdAt: daysAgo(16), withFile: true });
    const entries: DataHistoryItem[] = [];
    for (let i = 0; i < 16; i++) {
      entries.push(await seedEntry({ createdAt: daysAgo(15 - i) }));
    }

    // 17 entries, cap 15 -> the two oldest NON-in-flight entries go; the in-flight load survives
    await runDataHistoryRetentionSweep();

    expect(await dataHistoryDb.getEntry(inFlight.key)).toBeTruthy();
    expect(fakeStore.files.has(inFlight.files[0].path)).toBe(true);
    expect(await dataHistoryDb.getEntry(entries[0].key)).toBeUndefined();
    expect(await dataHistoryDb.getEntry(entries[1].key)).toBeUndefined();
    expect(await dataHistoryDb.getEntryCount()).toBe(15);
  });

  it('migrates entries stranded on a non-active backend onto the active one', async () => {
    // e.g. captured in a long-lived tab that missed a backend switch. One fake store stands in for
    // every backend here, so give it user-visible capabilities to model the folder the entry is
    // stranded in — the copy back to browser storage must leave the user's files where they are.
    fakeStore = new FakeFileStore('opfs', { userVisibleFiles: true });
    setHistoryFileStoreForTests(fakeStore);
    const stranded = await seedEntry({ storageBackend: 'directory', withFile: true });

    await runDataHistoryRetentionSweep();

    expect((await dataHistoryDb.getEntry(stranded.key))?.storageBackend).toBe('opfs');
    expect(fakeStore.files.has(stranded.files[0].path)).toBe(true);
  });

  it('does not treat file-less (inline) entries as stranded, whatever backend they are stamped with', async () => {
    // They have no bytes on ANY backend, so re-homing them is pure churn — a full table re-read
    // plus a write per entry on every app start
    const inlineOnly = await seedEntry({ storageBackend: 'directory', inlinePayload: new Uint8Array([1, 2, 3]), sizeBytes: 3 });

    await runDataHistoryRetentionSweep();

    expect((await dataHistoryDb.getEntry(inlineOnly.key))?.storageBackend).toBe('directory');
  });

  it('does not delete the directory of an entry captured after the sweep took its snapshot', async () => {
    // Steps 1-4 read one snapshot, but the orphan sweep must NOT: a capture landing mid-sweep
    // (another tab) has a row yet is absent from the snapshot, and deleting its dir would lose it.
    let lateEntryPath = '';
    const listEntryDirs = fakeStore.listEntryDirs.bind(fakeStore);
    fakeStore.listEntryDirs = async () => {
      const late = await seedEntry({ key: 'dh_late_capture', withFile: true });
      lateEntryPath = late.files[0].path;
      return await listEntryDirs();
    };

    await runDataHistoryRetentionSweep();

    expect(await dataHistoryDb.getEntry('dh_late_capture')).toBeTruthy();
    expect(fakeStore.files.has(lateEntryPath)).toBe(true);
  });
});

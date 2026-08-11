import { DataHistoryItem } from '@jetstream/types';
import { dataHistoryDb, getDexieDb } from '@jetstream/ui/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { disableNativeHistoryStorage, migrateHistoryEntries, reindexHistoryFromActiveBackend } from '../data-history-backends';
import { buildManifestJson } from '../data-history-manifest';
import { FakeFileStore } from '../file-store/fake-file-store';
import { setHistoryFileStoreForTests } from '../file-store/file-store-factory';

const TEXT_ENCODER = new TextEncoder();

let sourceStore: FakeFileStore;

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
    await sourceStore.writeFile(path, TEXT_ENCODER.encode('_id,_success\n001,true'), { gzip: true });
    const bytes = sourceStore.files.get(path)?.bytes.byteLength ?? 0;
    item.files = [{ kind: 'results', path, fileName: 'results.csv.gz', contentType: 'text/csv', compressed: true, bytes }];
    item.sizeBytes = bytes;
    await sourceStore.writeFile(`org-1-folder/${key}/manifest.json`, TEXT_ENCODER.encode(buildManifestJson(item)), { gzip: false });
  }
  await dataHistoryDb.saveEntry(item);
  return item;
}

describe('migrateHistoryEntries', () => {
  beforeEach(async () => {
    await getDexieDb().data_history.clear();
    await getDexieDb().data_history_config.clear();
    // The factory override serves as the store for EVERY backend stamp — acting as the source
    sourceStore = new FakeFileStore('opfs');
    setHistoryFileStoreForTests(sourceStore);
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('copies files, rewrites the manifest, re-stamps entries, and removes the invisible OPFS source', async () => {
    const fileBacked = await seedEntry({ withFile: true });
    // A capture that crashed before its first write has no bytes anywhere — re-stamping is the
    // whole migration for it
    const fileLess = await seedEntry({ status: 'incomplete' });

    const target = new FakeFileStore('directory');
    const migrated = await migrateHistoryEntries({ to: target });

    expect(migrated).toBe(2);
    const migratedFileBacked = await dataHistoryDb.getEntry(fileBacked.key);
    expect(migratedFileBacked?.storageBackend).toBe('directory');
    expect((await dataHistoryDb.getEntry(fileLess.key))?.storageBackend).toBe('directory');

    // file copied byte-for-byte (still gzip) + manifest re-written with the new backend stamp
    expect(target.files.has(fileBacked.files[0].path)).toBe(true);
    const manifest = JSON.parse(new TextDecoder().decode(target.files.get(`org-1-folder/${fileBacked.key}/manifest.json`)?.bytes));
    expect(manifest.storageBackend).toBe('directory');
    // source entry dir deleted
    expect(sourceStore.files.has(fileBacked.files[0].path)).toBe(false);
  });

  it('skips entries already on the target backend', async () => {
    const alreadyThere = await seedEntry({ storageBackend: 'directory' });

    const target = new FakeFileStore('directory');
    const migrated = await migrateHistoryEntries({ to: target });

    expect(migrated).toBe(0);
    expect((await dataHistoryDb.getEntry(alreadyThere.key))?.storageBackend).toBe('directory');
  });

  it('never deletes source files on a user-visible backend — the user may have backed them up', async () => {
    sourceStore = new FakeFileStore('directory', { compressFiles: false, userVisibleFiles: true });
    setHistoryFileStoreForTests(sourceStore);
    const entry = await seedEntry({ storageBackend: 'directory', withFile: true });

    const target = new FakeFileStore('native', { compressFiles: false, userVisibleFiles: true });
    const migrated = await migrateHistoryEntries({ to: target });

    expect(migrated).toBe(1);
    expect((await dataHistoryDb.getEntry(entry.key))?.storageBackend).toBe('native');
    // The user chose this folder — the copy must not take their files with it
    expect(sourceStore.files.has(entry.files[0].path)).toBe(true);
  });

  it('skips entries whose files cannot be read, leaving them on the previous backend', async () => {
    const broken = await seedEntry({ withFile: true });
    sourceStore.files.delete(broken.files[0].path);
    const healthy = await seedEntry({ withFile: true });

    const target = new FakeFileStore('directory');
    const migrated = await migrateHistoryEntries({ to: target });

    expect(migrated).toBe(1);
    expect((await dataHistoryDb.getEntry(broken.key))?.storageBackend).toBe('opfs');
    expect((await dataHistoryDb.getEntry(healthy.key))?.storageBackend).toBe('directory');
  });

  it('skips entries that are likely still being written — including captures from another tab', async () => {
    const inFlight = await seedEntry({ status: 'in-progress', startedAt: new Date(), withFile: true });
    const crashedLongAgo = await seedEntry({
      status: 'in-progress',
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      withFile: true,
    });

    const target = new FakeFileStore('directory');
    const migrated = await migrateHistoryEntries({ to: target });

    // The recent in-progress entry may have an open capture handle in another tab; the stale one is
    // a crash remnant and migrates normally
    expect(migrated).toBe(1);
    expect((await dataHistoryDb.getEntry(inFlight.key))?.storageBackend).toBe('opfs');
    expect((await dataHistoryDb.getEntry(crashedLongAgo.key))?.storageBackend).toBe('directory');
  });
});

describe('disableNativeHistoryStorage', () => {
  beforeEach(async () => {
    await getDexieDb().data_history.clear();
    await getDexieDb().data_history_config.clear();
    // One store stands in for every backend, so it carries the user-visible capabilities of the
    // native folder the entry lives in — that is what protects the on-disk files from the copy back
    sourceStore = new FakeFileStore('opfs', { userVisibleFiles: true });
    setHistoryFileStoreForTests(sourceStore);
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('copies entries back but LEAVES the on-disk files in place — they are the user’s files', async () => {
    // Same policy as disconnectHistoryDirectory: the desktop folder is user-chosen and holds plain
    // .csv/.json files the user may have backed up, so switching storage must not delete them.
    const entry = await seedEntry({ withFile: true, storageBackend: 'native' });

    await disableNativeHistoryStorage();

    expect((await dataHistoryDb.getEntry(entry.key))?.storageBackend).toBe('opfs');
    expect(sourceStore.files.has(entry.files[0].path)).toBe(true);
    expect((await dataHistoryDb.getBackendConfig()).active).toBe('opfs');
  });
});

describe('migrateHistoryEntries compression re-encoding', () => {
  beforeEach(async () => {
    await getDexieDb().data_history.clear();
    await getDexieDb().data_history_config.clear();
    sourceStore = new FakeFileStore('opfs');
    setHistoryFileStoreForTests(sourceStore);
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('re-encodes gzip files to plain files for user-visible backends and updates file refs', async () => {
    const entry = await seedEntry({ withFile: true });

    const target = new FakeFileStore('directory', { compressFiles: false, userVisibleFiles: true });
    await migrateHistoryEntries({ to: target });

    const migrated = await dataHistoryDb.getEntry(entry.key);
    expect(migrated?.files[0].fileName).toBe('results.csv');
    expect(migrated?.files[0].compressed).toBe(false);
    expect(migrated?.files[0].path.endsWith('/results.csv')).toBe(true);
    // the file in the target is plain text, directly readable without decompression
    const plain = target.files.get(migrated?.files[0].path as string);
    expect(new TextDecoder().decode(plain?.bytes)).toBe('_id,_success\n001,true');
    expect(migrated?.sizeBytes).toBe(plain?.bytes.byteLength);
  });
});

describe('reindexHistoryFromActiveBackend', () => {
  beforeEach(async () => {
    await getDexieDb().data_history.clear();
    await getDexieDb().data_history_config.clear();
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('returns 0 when the active backend does not support reindexing', async () => {
    setHistoryFileStoreForTests(new FakeFileStore('opfs'));
    expect(await reindexHistoryFromActiveBackend()).toBe(0);
  });

  it('restores rows from on-disk manifests, skipping known keys and non-entry dirs', async () => {
    const store = new FakeFileStore('directory', { supportsReindex: true });
    setHistoryFileStoreForTests(store);
    sourceStore = store;

    // A known entry (row exists) and an orphaned manifest (row missing — e.g. restored folder)
    const known = await seedEntry({ withFile: true, storageBackend: 'directory' });
    const lost = await seedEntry({ withFile: true, storageBackend: 'directory' });
    await dataHistoryDb.deleteEntries([lost.key]);
    // A non-entry directory that must be ignored
    await store.writeFile('org-1-folder/not-an-entry/readme.txt', TEXT_ENCODER.encode('user file'), { gzip: false });

    const restored = await reindexHistoryFromActiveBackend();

    expect(restored).toBe(1);
    const restoredEntry = await dataHistoryDb.getEntry(lost.key);
    expect(restoredEntry?.status).toBe('success');
    expect(restoredEntry?.storageBackend).toBe('directory');
    expect(restoredEntry?.createdAt).toBeInstanceOf(Date);
    expect(restoredEntry?.files.map(({ kind }) => kind)).toEqual(['results']);
    expect(await dataHistoryDb.getEntryCount()).toBe(2);
    expect((await dataHistoryDb.getEntry(known.key))?.key).toBe(known.key);
  });

  it('does not resurrect tombstoned (user-deleted) entries', async () => {
    const store = new FakeFileStore('directory', { supportsReindex: true });
    setHistoryFileStoreForTests(store);
    sourceStore = store;

    // Deleted while its files were unreachable: row removed, files + manifest left behind
    const deleted = await seedEntry({ withFile: true, storageBackend: 'directory' });
    await dataHistoryDb.deleteEntries([deleted.key]);
    await dataHistoryDb.addDeletedEntryTombstone(deleted.key);

    expect(await reindexHistoryFromActiveBackend()).toBe(0);
    expect(await dataHistoryDb.getEntry(deleted.key)).toBeUndefined();
  });
});

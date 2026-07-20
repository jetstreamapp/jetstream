import { DataHistoryItem } from '@jetstream/types';
import { dataHistoryDb, dexieDb } from '@jetstream/ui/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateHistoryEntries, reindexHistoryFromActiveBackend } from '../data-history-backends';
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
    await dexieDb.data_history.clear();
    await dexieDb.data_history_config.clear();
    // The factory override serves as the store for EVERY backend stamp — acting as the source
    sourceStore = new FakeFileStore('opfs');
    setHistoryFileStoreForTests(sourceStore);
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('copies files, rewrites the manifest, re-stamps entries, and deletes the source when asked', async () => {
    const fileBacked = await seedEntry({ withFile: true });
    const inlineOnly = await seedEntry({ inlinePayload: new Uint8Array([1, 2, 3]), sizeBytes: 3 });

    const target = new FakeFileStore('directory');
    const migrated = await migrateHistoryEntries({ to: target, deleteSource: true });

    expect(migrated).toBe(2);
    const migratedFileBacked = await dataHistoryDb.getEntry(fileBacked.key);
    expect(migratedFileBacked?.storageBackend).toBe('directory');
    expect((await dataHistoryDb.getEntry(inlineOnly.key))?.storageBackend).toBe('directory');

    // file copied byte-for-byte (still gzip) + manifest re-written with the new backend stamp
    expect(target.files.has(fileBacked.files[0].path)).toBe(true);
    const manifest = JSON.parse(new TextDecoder().decode(target.files.get(`org-1-folder/${fileBacked.key}/manifest.json`)?.bytes));
    expect(manifest.storageBackend).toBe('directory');
    // source entry dir deleted
    expect(sourceStore.files.has(fileBacked.files[0].path)).toBe(false);
  });

  it('leaves source files in place when deleteSource is false and skips already-migrated entries', async () => {
    const entry = await seedEntry({ withFile: true });
    const alreadyThere = await seedEntry({ storageBackend: 'directory' });

    const target = new FakeFileStore('directory');
    const migrated = await migrateHistoryEntries({ to: target, deleteSource: false });

    expect(migrated).toBe(1);
    expect(sourceStore.files.has(entry.files[0].path)).toBe(true);
    expect((await dataHistoryDb.getEntry(alreadyThere.key))?.storageBackend).toBe('directory');
  });

  it('skips entries whose files cannot be read, leaving them on the previous backend', async () => {
    const broken = await seedEntry({ withFile: true });
    sourceStore.files.delete(broken.files[0].path);
    const healthy = await seedEntry({ withFile: true });

    const target = new FakeFileStore('directory');
    const migrated = await migrateHistoryEntries({ to: target, deleteSource: true });

    expect(migrated).toBe(1);
    expect((await dataHistoryDb.getEntry(broken.key))?.storageBackend).toBe('opfs');
    expect((await dataHistoryDb.getEntry(healthy.key))?.storageBackend).toBe('directory');
  });
});

describe('migrateHistoryEntries compression re-encoding', () => {
  beforeEach(async () => {
    await dexieDb.data_history.clear();
    await dexieDb.data_history_config.clear();
    sourceStore = new FakeFileStore('opfs');
    setHistoryFileStoreForTests(sourceStore);
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('re-encodes gzip files to plain files for user-visible backends and updates file refs', async () => {
    const entry = await seedEntry({ withFile: true });

    const target = new FakeFileStore('directory', { compressFiles: false, userVisibleFiles: true });
    await migrateHistoryEntries({ to: target, deleteSource: true });

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
    await dexieDb.data_history.clear();
    await dexieDb.data_history_config.clear();
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
    expect(restoredEntry?.inlinePayload).toBeNull();
    expect(await dataHistoryDb.getEntryCount()).toBe(2);
    expect((await dataHistoryDb.getEntry(known.key))?.key).toBe(known.key);
  });
});

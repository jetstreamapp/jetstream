import { DataHistoryItem } from '@jetstream/types';
import { dataHistoryDb, getDexieDb } from '@jetstream/ui/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectHistoryDirectory,
  DataHistoryBackendStatus,
  disableNativeHistoryStorage,
  disconnectHistoryDirectory,
  getDataHistoryStorageLocation,
  migrateHistoryEntries,
  reconnectHistoryDirectory,
  reindexHistoryFromActiveBackend,
} from '../data-history-backends';
import { buildManifestJson } from '../data-history-manifest';
import { DirectoryHandleFileStore } from '../file-store/directory-handle-file-store';
import { FakeFileStore } from '../file-store/fake-file-store';
import { setHistoryFileStoreForTests } from '../file-store/file-store-factory';
import { getUserScopeDir, setDataHistoryUserScope } from '../file-store/user-scope';
import { FakeFsaDirectoryHandle } from './fake-fsa-handles';

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
    const { migrated } = await migrateHistoryEntries({ to: target });

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
    const { migrated } = await migrateHistoryEntries({ to: target });

    expect(migrated).toBe(0);
    expect((await dataHistoryDb.getEntry(alreadyThere.key))?.storageBackend).toBe('directory');
  });

  it('never deletes source files on a user-visible backend — the user may have backed them up', async () => {
    sourceStore = new FakeFileStore('directory', { compressFiles: false, userVisibleFiles: true });
    setHistoryFileStoreForTests(sourceStore);
    const entry = await seedEntry({ storageBackend: 'directory', withFile: true });

    const target = new FakeFileStore('native', { compressFiles: false, userVisibleFiles: true });
    const { migrated } = await migrateHistoryEntries({ to: target });

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
    const { migrated } = await migrateHistoryEntries({ to: target });

    expect(migrated).toBe(1);
    expect((await dataHistoryDb.getEntry(broken.key))?.storageBackend).toBe('opfs');
    expect((await dataHistoryDb.getEntry(healthy.key))?.storageBackend).toBe('directory');
  });

  it('reports entries it could not move as skipped, so the UI never claims everything moved', async () => {
    const movable = await seedEntry({ withFile: true });
    const inFlight = await seedEntry({ withFile: true, status: 'in-progress', startedAt: new Date() });
    const unreadable = await seedEntry({ withFile: true });
    sourceStore.simulateFailure = (op, path) => op === 'read-file' && !!path?.includes(unreadable.key);

    const target = new FakeFileStore('directory', { compressFiles: false, userVisibleFiles: true });
    expect(await migrateHistoryEntries({ to: target })).toEqual({ migrated: 1, skipped: 2 });
    expect((await dataHistoryDb.getEntry(movable.key))?.storageBackend).toBe('directory');
    expect((await dataHistoryDb.getEntry(inFlight.key))?.storageBackend).toBe('opfs');
    expect((await dataHistoryDb.getEntry(unreadable.key))?.storageBackend).toBe('opfs');
  });

  it('probes an unavailable source backend once, not once per straggler', async () => {
    // Two file-backed entries (and one file-less one) stamped with a folder that can no longer be
    // opened — with the factory override removed, building the 'directory' store fails for real
    const strandedA = await seedEntry({ storageBackend: 'directory', withFile: true });
    const strandedB = await seedEntry({ storageBackend: 'directory', withFile: true });
    const fileLess = await seedEntry({ storageBackend: 'directory', status: 'incomplete' });
    setHistoryFileStoreForTests(null);
    setDataHistoryUserScope('spec-user-migrate');
    const getBackendConfigSpy = vi.spyOn(dataHistoryDb, 'getBackendConfig');

    const target = new FakeFileStore('opfs');
    expect(await migrateHistoryEntries({ to: target })).toEqual({ migrated: 1, skipped: 2 });

    // The store is built (and fails) once for the whole backend, instead of per entry
    expect(getBackendConfigSpy).toHaveBeenCalledTimes(1);
    expect((await dataHistoryDb.getEntry(strandedA.key))?.storageBackend).toBe('directory');
    expect((await dataHistoryDb.getEntry(strandedB.key))?.storageBackend).toBe('directory');
    // No bytes anywhere, so re-stamping is still the whole migration for it
    expect((await dataHistoryDb.getEntry(fileLess.key))?.storageBackend).toBe('opfs');
    getBackendConfigSpy.mockRestore();
  });

  it('counts an entry whose source cleanup failed as migrated — it IS on the new backend', async () => {
    const entry = await seedEntry({ withFile: true });
    sourceStore.simulateFailure = (op) => op === 'delete-dir';

    const target = new FakeFileStore('directory', { compressFiles: false, userVisibleFiles: true });
    expect(await migrateHistoryEntries({ to: target })).toEqual({ migrated: 1, skipped: 0 });
    expect((await dataHistoryDb.getEntry(entry.key))?.storageBackend).toBe('directory');
  });

  it('skips entries that are likely still being written — including captures from another tab', async () => {
    const inFlight = await seedEntry({ status: 'in-progress', startedAt: new Date(), withFile: true });
    const crashedLongAgo = await seedEntry({
      status: 'in-progress',
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      withFile: true,
    });

    const target = new FakeFileStore('directory');
    const { migrated } = await migrateHistoryEntries({ to: target });

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

  // A manifest is a plain file the user can copy anywhere: one duplicated into another entry's folder
  // must not overwrite that entry's row, and paths pointing outside the folder must not be trusted
  it('ignores a manifest that does not describe the directory it was read from', async () => {
    const store = new FakeFileStore('directory', { supportsReindex: true });
    setHistoryFileStoreForTests(store);
    sourceStore = store;

    const original = await seedEntry({ withFile: true, storageBackend: 'directory' });
    await dataHistoryDb.deleteEntries([original.key]);
    // The same manifest copied by hand into a second entry folder
    await store.writeFile(`org-1-folder/dh_copied_elsewhere/manifest.json`, TEXT_ENCODER.encode(buildManifestJson(original)), {
      gzip: false,
    });
    // A manifest from an unknown (future) version
    await store.writeFile(
      `org-1-folder/dh_future/manifest.json`,
      TEXT_ENCODER.encode(JSON.stringify({ ...JSON.parse(buildManifestJson({ ...original, key: 'dh_future' })), manifestVersion: 99 })),
      { gzip: false },
    );

    expect(await reindexHistoryFromActiveBackend()).toBe(1);
    expect((await dataHistoryDb.getEntry(original.key))?.key).toBe(original.key);
    expect(await dataHistoryDb.getEntryCount()).toBe(1);
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

describe('getDataHistoryStorageLocation', () => {
  const baseStatus: DataHistoryBackendStatus = {
    active: 'opfs',
    effective: 'opfs',
    permissionNeeded: false,
    folderUnavailable: false,
    directorySupported: true,
    nativeSupported: false,
  };

  it('renders the backend writes actually land on — `effective`, not the configured one', () => {
    expect(getDataHistoryStorageLocation(null)).toEqual({ kind: 'browser' });
    expect(getDataHistoryStorageLocation({ ...baseStatus, active: 'directory', effective: 'directory', directoryName: 'Docs' })).toEqual({
      kind: 'directory',
      name: 'Docs',
    });
    expect(getDataHistoryStorageLocation({ ...baseStatus, active: 'native', effective: 'native', nativePath: '/tmp/h' })).toEqual({
      kind: 'native',
      path: '/tmp/h',
    });
  });

  it('reads as browser storage whenever the configured folder could not be opened, whatever the reason', () => {
    // Lost permission (re-grantable) …
    expect(
      getDataHistoryStorageLocation({
        ...baseStatus,
        active: 'directory',
        effective: 'opfs',
        permissionNeeded: true,
        directoryName: 'Docs',
      }),
    ).toEqual({ kind: 'browser' });
    // … a deleted/renamed folder …
    expect(
      getDataHistoryStorageLocation({
        ...baseStatus,
        active: 'directory',
        effective: 'opfs',
        folderUnavailable: true,
        directoryName: 'Docs',
      }),
    ).toEqual({ kind: 'browser' });
    // … and a native folder on an unmounted drive — the UI must not say "Files are saved to: /Volumes/…"
    expect(
      getDataHistoryStorageLocation({
        ...baseStatus,
        active: 'native',
        effective: 'opfs',
        folderUnavailable: true,
        nativePath: '/Volumes/x',
      }),
    ).toEqual({ kind: 'browser' });
  });
});

/**
 * Folder flows over in-memory File System Access handles. The backend config is stubbed at the db
 * boundary because a live handle (an object with methods) does not survive the IndexedDB round trip
 * in tests, and the factory override serves as the OPFS store.
 */
describe('folder connect / disconnect flows', () => {
  const SPEC_USER_ID = 'spec-backends-user';
  let opfsStore: FakeFileStore;
  let getBackendConfigSpy: ReturnType<typeof vi.spyOn>;
  let saveBackendConfigSpy: ReturnType<typeof vi.spyOn>;

  /** Seed an entry whose files live in a real folder handle, stamped 'directory' */
  async function seedFolderEntry(handle: FakeFsaDirectoryHandle): Promise<DataHistoryItem> {
    const store = new DirectoryHandleFileStore(handle, await getUserScopeDir());
    await store.init();
    const entry = await seedEntry({ storageBackend: 'directory' });
    const path = `org-1-folder/${entry.key}/results.csv`;
    const { bytes } = await store.writeFile(path, TEXT_ENCODER.encode('_id,_success\n001,true'), { gzip: false });
    entry.files = [{ kind: 'results', path, fileName: 'results.csv', contentType: 'text/csv', compressed: false, bytes }];
    entry.sizeBytes = bytes;
    await dataHistoryDb.saveEntry(entry);
    await store.writeFile(`org-1-folder/${entry.key}/manifest.json`, TEXT_ENCODER.encode(buildManifestJson(entry)), { gzip: false });
    return entry;
  }

  /**
   * `onShown` models what the real picker does to the page: it consumes the user gesture, so any
   * `requestPermission` made after it resolves can no longer prompt
   */
  function stubPicker(handle: FakeFsaDirectoryHandle, onShown?: () => void) {
    (window as unknown as { showDirectoryPicker: () => Promise<FakeFsaDirectoryHandle> }).showDirectoryPicker = () => {
      onShown?.();
      return Promise.resolve(handle);
    };
  }

  beforeEach(async () => {
    await getDexieDb().data_history.clear();
    await getDexieDb().data_history_config.clear();
    setDataHistoryUserScope(SPEC_USER_ID);
    opfsStore = new FakeFileStore('opfs');
    setHistoryFileStoreForTests(opfsStore);
    sourceStore = opfsStore;
    getBackendConfigSpy = vi.spyOn(dataHistoryDb, 'getBackendConfig');
    saveBackendConfigSpy = vi.spyOn(dataHistoryDb, 'saveBackendConfig').mockResolvedValue(undefined);
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
    vi.restoreAllMocks();
    delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  });

  it('disconnect re-requests folder access inside the gesture and refuses when it is not granted', async () => {
    // Chromium resets a persisted handle to 'prompt' at the start of most sessions — the common case
    const handle = new FakeFsaDirectoryHandle('Docs');
    handle.permissionState = 'prompt';
    handle.permissionStateAfterRequest = 'denied';
    getBackendConfigSpy.mockResolvedValue({ active: 'directory', directoryHandle: handle });
    const entry = await seedEntry({ storageBackend: 'directory' });

    await expect(disconnectHistoryDirectory()).rejects.toThrow(/needs access to your history folder/);
    // Nothing was switched: the entry would otherwise be stranded on a backend that is no longer active
    expect(saveBackendConfigSpy).not.toHaveBeenCalled();
    expect((await dataHistoryDb.getEntry(entry.key))?.storageBackend).toBe('directory');
  });

  it('disconnect copies entries back once access is granted and RETAINS the handle for stragglers', async () => {
    const handle = new FakeFsaDirectoryHandle('Docs');
    handle.permissionState = 'prompt';
    handle.permissionStateAfterRequest = 'granted';
    getBackendConfigSpy.mockResolvedValue({ active: 'directory', directoryHandle: handle });
    // The factory override serves every backend, so the folder-stamped entry's bytes live in it
    const entry = await seedEntry({ withFile: true, storageBackend: 'directory' });
    const straggler = await seedEntry({ withFile: true, storageBackend: 'directory', status: 'in-progress', startedAt: new Date() });

    expect(await disconnectHistoryDirectory()).toEqual({ migrated: 1, skipped: 1 });
    expect(saveBackendConfigSpy).toHaveBeenCalledWith({ active: 'opfs', directoryHandle: handle });
    expect((await dataHistoryDb.getEntry(entry.key))?.storageBackend).toBe('opfs');
    expect((await dataHistoryDb.getEntry(straggler.key))?.storageBackend).toBe('directory');
  });

  it('reconnect works for a handle retained after a disconnect, not only for the active folder', async () => {
    const handle = new FakeFsaDirectoryHandle('Docs');
    handle.permissionState = 'prompt';
    getBackendConfigSpy.mockResolvedValue({ active: 'opfs', directoryHandle: handle });

    expect(await reconnectHistoryDirectory()).toBe(true);
    expect(handle.permissionState).toBe('granted');
  });

  it('connecting a new folder first copies stragglers out of a previously connected folder', async () => {
    const previousHandle = new FakeFsaDirectoryHandle('Old Docs');
    // Disconnected earlier with this entry left behind (stamped 'directory', files only in the old folder)
    getBackendConfigSpy.mockResolvedValue({ active: 'opfs', directoryHandle: previousHandle });
    const straggler = await seedFolderEntry(previousHandle);
    const browserEntry = await seedEntry({ withFile: true });
    // …and, as in every new session, the old folder's permission has reset and must be re-requested —
    // BEFORE the picker, which consumes the gesture a permission prompt needs
    previousHandle.permissionState = 'prompt';
    previousHandle.permissionStateAfterRequest = 'granted';
    const newHandle = new FakeFsaDirectoryHandle('New Docs');
    stubPicker(newHandle, () => {
      previousHandle.permissionStateAfterRequest = 'prompt';
    });

    expect(await connectHistoryDirectory()).toEqual({ migrated: 2, skipped: 0 });

    expect(saveBackendConfigSpy).toHaveBeenCalledWith({ active: 'directory', directoryHandle: newHandle });
    // Both entries now resolve to the new folder, where their files actually are
    const newStore = new DirectoryHandleFileStore(newHandle, await getUserScopeDir());
    await newStore.init();
    for (const entry of [straggler, browserEntry]) {
      const updated = await dataHistoryDb.getEntry(entry.key);
      expect(updated?.storageBackend).toBe('directory');
      expect(await (await newStore.readFile(updated!.files[0].path, { gunzip: false })).text()).toBe('_id,_success\n001,true');
    }
  });

  it('connecting a new folder refuses to repoint when access to the previous folder is denied and entries still live there', async () => {
    const previousHandle = new FakeFsaDirectoryHandle('Old Docs');
    getBackendConfigSpy.mockResolvedValue({ active: 'directory', directoryHandle: previousHandle });
    const straggler = await seedFolderEntry(previousHandle);
    previousHandle.permissionState = 'prompt';
    previousHandle.permissionStateAfterRequest = 'denied';
    const picker = vi.fn();
    stubPicker(new FakeFsaDirectoryHandle('New Docs'), picker);

    await expect(connectHistoryDirectory()).rejects.toThrow(/needs access to your current history folder/);

    // Nothing happened: no picker, no repoint, the entry still resolves to the folder that holds it
    expect(picker).not.toHaveBeenCalled();
    expect(saveBackendConfigSpy).not.toHaveBeenCalled();
    expect((await dataHistoryDb.getEntry(straggler.key))?.storageBackend).toBe('directory');
  });

  it('connecting a new folder does not prompt for a previous folder that has nothing left to move', async () => {
    const previousHandle = new FakeFsaDirectoryHandle('Old Docs');
    // Disconnected earlier and everything was copied back — the retained handle is irrelevant now
    getBackendConfigSpy.mockResolvedValue({ active: 'opfs', directoryHandle: previousHandle });
    const browserEntry = await seedEntry({ withFile: true });
    previousHandle.permissionState = 'prompt';
    previousHandle.permissionStateAfterRequest = 'denied';
    const newHandle = new FakeFsaDirectoryHandle('New Docs');
    stubPicker(newHandle);

    expect(await connectHistoryDirectory()).toEqual({ migrated: 1, skipped: 0 });

    expect(previousHandle.permissionState).toBe('prompt');
    expect(saveBackendConfigSpy).toHaveBeenCalledWith({ active: 'directory', directoryHandle: newHandle });
    expect((await dataHistoryDb.getEntry(browserEntry.key))?.storageBackend).toBe('directory');
  });

  it('connecting a new folder leaves an unreadable entry behind and reports it, rather than aborting the whole move', async () => {
    const previousHandle = new FakeFsaDirectoryHandle('Old Docs');
    getBackendConfigSpy.mockResolvedValue({ active: 'directory', directoryHandle: previousHandle });
    const intact = await seedFolderEntry(previousHandle);
    const deletedByHand = await seedFolderEntry(previousHandle);
    // The user deleted one entry's folder in their file manager — an allowed state in a visible backend
    const scopeDir = await getUserScopeDir();
    const orgDir = await (await previousHandle.getDirectoryHandle(scopeDir)).getDirectoryHandle('org-1-folder');
    await orgDir.removeEntry(deletedByHand.key, { recursive: true });
    const newHandle = new FakeFsaDirectoryHandle('New Docs');
    stubPicker(newHandle);

    expect(await connectHistoryDirectory()).toEqual({ migrated: 1, skipped: 1 });

    expect(saveBackendConfigSpy).toHaveBeenCalledWith({ active: 'directory', directoryHandle: newHandle });
    const newStore = new DirectoryHandleFileStore(newHandle, scopeDir);
    await newStore.init();
    await expect(newStore.readFile((await dataHistoryDb.getEntry(intact.key))!.files[0].path, { gunzip: false })).resolves.toBeTruthy();
    // No half-written copy of the skipped entry in the new folder
    expect((await newStore.listEntryDirs()).map(({ entryKey }) => entryKey)).toEqual([intact.key]);
  });
});

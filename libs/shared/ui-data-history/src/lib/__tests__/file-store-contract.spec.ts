import { gunzipSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DirectoryHandleFileStore } from '../file-store/directory-handle-file-store';
import { FakeFileStore } from '../file-store/fake-file-store';
import { HistoryFileStore } from '../file-store/file-store.types';
import { DataHistoryDirectoryPermissionError } from '../file-store/fsa-types';
import { NativeFsFileStore } from '../file-store/native-fs-file-store';
import { FakeFsaDirectoryHandle } from './fake-fsa-handles';

const TEXT_ENCODER = new TextEncoder();
const GZIP_MAGIC = [0x1f, 0x8b];
const SPEC_SCOPE_DIR = 'u-0123456789abcdef';

/**
 * Contract test suite every `HistoryFileStore` implementation must pass. The OPFS backend cannot
 * run here (no OPFS in jsdom — it is exercised by Playwright e2e in a later work package), but
 * future backends (DirectoryHandle, Electron-native) should register themselves below wherever
 * their environment allows.
 */
function describeHistoryFileStoreContract(name: string, createStore: () => Promise<HistoryFileStore>) {
  describe(`HistoryFileStore contract: ${name}`, () => {
    it('round-trips an uncompressed file', async () => {
      const store = await createStore();
      const { bytes } = await store.writeFile('org-1/dh_a/manifest.json', TEXT_ENCODER.encode('{"a":1}'), { gzip: false });
      expect(bytes).toBe(7);
      const blob = await store.readFile('org-1/dh_a/manifest.json', { gunzip: false });
      expect(await blob.text()).toBe('{"a":1}');
    });

    it('round-trips a gzip file and stores real gzip bytes', async () => {
      const store = await createStore();
      const content = 'Name\n' + Array.from({ length: 500 }, (_, i) => `row-${i}`).join('\n');
      const { bytes } = await store.writeFile('org-1/dh_a/input.csv.gz', TEXT_ENCODER.encode(content), { gzip: true });
      expect(bytes).toBeGreaterThan(0);
      expect(bytes).toBeLessThan(content.length);

      const raw = new Uint8Array(await (await store.readFile('org-1/dh_a/input.csv.gz', { gunzip: false })).arrayBuffer());
      expect([raw[0], raw[1]]).toEqual(GZIP_MAGIC);

      const decompressed = await store.readFile('org-1/dh_a/input.csv.gz', { gunzip: true });
      expect(await decompressed.text()).toBe(content);
    });

    // The in-modal preview reads only the head of a payload; every backend has to honor that at the
    // source, because reading whole and slicing is what makes previewing a large results file
    // expensive in the first place.
    it.each([
      { label: 'uncompressed', path: 'org-1/dh_cap/results.csv', gzip: false, gunzip: false },
      { label: 'gzip', path: 'org-1/dh_cap/results.csv.gz', gzip: true, gunzip: true },
    ])('caps a $label read at maxBytes', async ({ path, gzip, gunzip }) => {
      const store = await createStore();
      const content = Array.from({ length: 2000 }, (_, i) => `row-${i}`).join('\n');
      await store.writeFile(path, TEXT_ENCODER.encode(content), { gzip });

      const capped = await store.readFile(path, { gunzip, maxBytes: 100 });
      expect(capped.size).toBe(100);
      expect(await capped.text()).toBe(content.slice(0, 100));

      // A cap larger than the file yields the whole file, not a padded/short read
      const wholeFile = await store.readFile(path, { gunzip, maxBytes: content.length * 10 });
      expect(await wholeFile.text()).toBe(content);
    });

    it('streams multiple chunks into one gzip file', async () => {
      const store = await createStore();
      const stream = await store.createWriteStream('org-1/dh_b/results.csv.gz', { gzip: true });
      await stream.write(TEXT_ENCODER.encode('_id,_success\n'));
      await stream.write(TEXT_ENCODER.encode('001,true\n'));
      await stream.write(TEXT_ENCODER.encode('002,false'));
      const { bytes } = await stream.close();
      expect(bytes).toBeGreaterThan(0);
      const blob = await store.readFile('org-1/dh_b/results.csv.gz', { gunzip: true });
      expect(await blob.text()).toBe('_id,_success\n001,true\n002,false');
    });

    it('abort discards a partial file', async () => {
      const store = await createStore();
      const stream = await store.createWriteStream('org-1/dh_c/results.csv.gz', { gzip: true });
      await stream.write(TEXT_ENCODER.encode('partial'));
      await stream.abort();
      await expect(store.readFile('org-1/dh_c/results.csv.gz', { gunzip: true })).rejects.toThrow();
    });

    it('deletes an entry dir recursively and tolerates missing dirs', async () => {
      const store = await createStore();
      await store.writeFile('org-1/dh_d/input.csv.gz', TEXT_ENCODER.encode('x'), { gzip: true });
      await store.writeFile('org-1/dh_d/manifest.json', TEXT_ENCODER.encode('{}'), { gzip: false });
      await store.deleteEntryDir('org-1/dh_d');
      await expect(store.readFile('org-1/dh_d/manifest.json', { gunzip: false })).rejects.toThrow();
      // second delete of a now-missing dir must resolve
      await store.deleteEntryDir('org-1/dh_d');
    });

    it('lists entry directories as orgFolder/entryKey pairs', async () => {
      const store = await createStore();
      await store.writeFile('org-1/dh_a/manifest.json', TEXT_ENCODER.encode('{}'), { gzip: false });
      await store.writeFile('org-1/dh_b/manifest.json', TEXT_ENCODER.encode('{}'), { gzip: false });
      await store.writeFile('org-2/dh_c/manifest.json', TEXT_ENCODER.encode('{}'), { gzip: false });
      const dirs = await store.listEntryDirs();
      expect(dirs).toEqual(
        expect.arrayContaining([
          { orgFolder: 'org-1', entryKey: 'dh_a' },
          { orgFolder: 'org-1', entryKey: 'dh_b' },
          { orgFolder: 'org-2', entryKey: 'dh_c' },
        ]),
      );
      expect(dirs).toHaveLength(3);
    });

    it('rejects unsafe paths', async () => {
      const store = await createStore();
      await expect(store.writeFile('../evil/file', TEXT_ENCODER.encode('x'), { gzip: false })).rejects.toThrow();
      await expect(store.createWriteStream('org-1/../../evil.csv', { gzip: true })).rejects.toThrow();
    });
  });
}

describeHistoryFileStoreContract('FakeFileStore', async () => {
  const store = new FakeFileStore();
  await store.init();
  return store;
});

describe('FakeFileStore failure simulation', () => {
  it('throws only for matching operations', async () => {
    const store = new FakeFileStore();
    store.simulateFailure = (op) => op === 'stream-write';
    const stream = await store.createWriteStream('org-1/dh_a/input.csv.gz', { gzip: true });
    await expect(stream.write(TEXT_ENCODER.encode('x'))).rejects.toThrow('Simulated failure');
    store.simulateFailure = null;
    await stream.write(TEXT_ENCODER.encode('ok'));
    await stream.close();
    expect(await (await store.readFile('org-1/dh_a/input.csv.gz', { gunzip: true })).text()).toBe('ok');
  });
});

describeHistoryFileStoreContract('DirectoryHandleFileStore (fake FSA handles)', async () => {
  const store = new DirectoryHandleFileStore(new FakeFsaDirectoryHandle(), SPEC_SCOPE_DIR);
  await store.init();
  return store;
});

describe('DirectoryHandleFileStore permissions', () => {
  it('init throws DataHistoryDirectoryPermissionError when permission is not granted', async () => {
    const root = new FakeFsaDirectoryHandle();
    root.permissionState = 'prompt';
    const store = new DirectoryHandleFileStore(root, SPEC_SCOPE_DIR);
    await expect(store.init()).rejects.toBeInstanceOf(DataHistoryDirectoryPermissionError);
  });

  it('requestAccess re-grants and init succeeds afterwards', async () => {
    const root = new FakeFsaDirectoryHandle();
    root.permissionState = 'prompt';
    root.permissionStateAfterRequest = 'granted';
    const store = new DirectoryHandleFileStore(root, SPEC_SCOPE_DIR);
    expect(await store.requestAccess()).toBe(true);
    await store.init();
  });
});

describe('DirectoryHandleFileStore abort semantics', () => {
  it('aborting an overwrite stream preserves the pre-existing file (FSA swap-file semantics)', async () => {
    const store = new DirectoryHandleFileStore(new FakeFsaDirectoryHandle(), SPEC_SCOPE_DIR);
    await store.init();
    await store.writeFile('org-1/dh_x/results.csv', TEXT_ENCODER.encode('good data'), { gzip: false });

    // Writes land in a swap file, so aborting a replacement must leave the original untouched —
    // abort only cleans up the empty stub created when the target did NOT already exist.
    const stream = await store.createWriteStream('org-1/dh_x/results.csv', { gzip: false });
    await stream.write(TEXT_ENCODER.encode('replacement partial'));
    await stream.abort();

    const blob = await store.readFile('org-1/dh_x/results.csv', { gunzip: false });
    expect(await blob.text()).toBe('good data');
  });
});

/**
 * In-memory stand-in for the Electron main-process handler (`data-history-file.service.ts`),
 * mirroring its semantics (node zlib gzip, raw bytes over IPC) so NativeFsFileStore passes the
 * same contract as every other backend.
 */
/** Bytes the fake `read-file-chunk` returns per call — small so every read spans several chunks */
const SHORT_READ_BYTES = 5;

function createFakeElectronDataHistoryApi(sharedFiles?: Map<string, Uint8Array>) {
  // Optionally shared between two API instances, so a test can prove that two users backed by the
  // SAME history folder still cannot see each other's files.
  const files = sharedFiles ?? new Map<string, Uint8Array>();
  const streams = new Map<number, { chunks: Uint8Array[]; gzip: boolean; path: string }>();
  let nextStreamId = 1;
  // Mirrors the real main process: the scope arrives on `init` and every path resolves under it
  let scopeDir: string | null = null;

  function scoped(relativePath: string): string {
    if (!scopeDir) {
      throw new Error('Data history storage has not been initialized for a user');
    }
    return `${scopeDir}/${relativePath}`;
  }

  function concat(chunks: Uint8Array[]): Uint8Array {
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return combined;
  }

  async function dataHistoryRequest(payload: any): Promise<unknown> {
    switch (payload.op) {
      case 'init': {
        scopeDir = payload.scopeDir;
        return undefined;
      }
      case 'write-file': {
        const output = payload.gzip ? new Uint8Array(gzipSync(payload.bytes)) : payload.bytes;
        files.set(scoped(payload.path), output);
        return { bytes: output.byteLength };
      }
      case 'open-stream': {
        const streamId = nextStreamId++;
        streams.set(streamId, { chunks: [], gzip: payload.gzip, path: scoped(payload.path) });
        return { streamId };
      }
      case 'stream-write': {
        const state = streams.get(payload.streamId);
        if (!state) {
          throw new Error('Unknown stream');
        }
        state.chunks.push(payload.bytes);
        return undefined;
      }
      case 'stream-close': {
        const state = streams.get(payload.streamId);
        if (!state) {
          throw new Error('Unknown stream');
        }
        streams.delete(payload.streamId);
        const combined = concat(state.chunks);
        const output = state.gzip ? new Uint8Array(gzipSync(combined)) : combined;
        files.set(state.path, output);
        return { bytes: output.byteLength };
      }
      case 'stream-abort': {
        const state = streams.get(payload.streamId);
        if (state) {
          streams.delete(payload.streamId);
          files.delete(state.path);
        }
        return undefined;
      }
      case 'read-file': {
        const bytes = files.get(scoped(payload.path));
        if (!bytes) {
          throw new Error(`File not found: ${payload.path}`);
        }
        const output = payload.gunzip ? new Uint8Array(gunzipSync(bytes)) : bytes;
        // The real main process caps here rather than sending the whole payload across IPC
        return payload.maxBytes == null ? output : output.subarray(0, payload.maxBytes);
      }
      case 'read-file-chunk': {
        const bytes = files.get(scoped(payload.path));
        if (!bytes) {
          throw new Error(`File not found: ${payload.path}`);
        }
        // Deliberately a SHORT read (a real `read(2)` may return fewer bytes than asked for, and the
        // main process clamps at EOF), so every round-trip below exercises the caller's chunk loop
        const start = Math.min(payload.offset, bytes.byteLength);
        const end = Math.min(start + Math.min(payload.length, SHORT_READ_BYTES), bytes.byteLength);
        return { bytes: bytes.subarray(start, end), totalBytes: bytes.byteLength };
      }
      case 'delete-dir': {
        for (const path of Array.from(files.keys())) {
          if (path.startsWith(`${scoped(payload.path)}/`)) {
            files.delete(path);
          }
        }
        return undefined;
      }
      case 'list-entry-dirs': {
        const dirs = new Map<string, { orgFolder: string; entryKey: string }>();
        const prefix = `${scoped('')}`;
        for (const path of files.keys()) {
          if (!path.startsWith(prefix)) {
            continue;
          }
          const segments = path.slice(prefix.length).split('/');
          if (segments.length >= 3) {
            dirs.set(`${segments[0]}/${segments[1]}`, { orgFolder: segments[0], entryKey: segments[1] });
          }
        }
        return { dirs: Array.from(dirs.values()) };
      }
      default: {
        throw new Error(`Unknown op ${payload.op}`);
      }
    }
  }

  return { dataHistoryRequest };
}

describeHistoryFileStoreContract('NativeFsFileStore (fake electron API)', async () => {
  (window as any).electronAPI = createFakeElectronDataHistoryApi();
  const store = new NativeFsFileStore(SPEC_SCOPE_DIR);
  await store.init();
  return store;
});

/**
 * The whole point of the per-user scope directory: accounts sharing a machine share the underlying
 * storage (one OPFS origin, one desktop history folder, or the same folder picked twice), so
 * isolation has to come from the path each store roots at. Without it the damage is not only a read
 * leak — the retention sweep deletes entry dirs with no matching row, so whichever user signs in
 * second silently destroys the first user's history, and `reindex` imports their entries.
 */
describe('per-user storage isolation', () => {
  const USER_A_SCOPE = 'u-aaaaaaaaaaaaaaaa';
  const USER_B_SCOPE = 'u-bbbbbbbbbbbbbbbb';

  it('DirectoryHandleFileStore: two users pointed at the SAME folder never see each other', async () => {
    const sharedFolder = new FakeFsaDirectoryHandle();
    const storeA = new DirectoryHandleFileStore(sharedFolder, USER_A_SCOPE);
    const storeB = new DirectoryHandleFileStore(sharedFolder, USER_B_SCOPE);
    await storeA.init();
    await storeB.init();

    await storeA.writeFile('org-1/dh_a/manifest.json', TEXT_ENCODER.encode('{"user":"a"}'), { gzip: false });
    await storeB.writeFile('org-1/dh_b/manifest.json', TEXT_ENCODER.encode('{"user":"b"}'), { gzip: false });

    // Same relative path, different user -> different file
    expect(await (await storeA.readFile('org-1/dh_a/manifest.json', { gunzip: false })).text()).toBe('{"user":"a"}');
    await expect(storeB.readFile('org-1/dh_a/manifest.json', { gunzip: false })).rejects.toThrow();

    // What reindex and the retention sweep enumerate: neither user's tree includes the other's
    expect(await storeA.listEntryDirs()).toEqual([{ orgFolder: 'org-1', entryKey: 'dh_a' }]);
    expect(await storeB.listEntryDirs()).toEqual([{ orgFolder: 'org-1', entryKey: 'dh_b' }]);
  });

  it('DirectoryHandleFileStore: one user deleting an entry dir leaves the other user intact', async () => {
    const sharedFolder = new FakeFsaDirectoryHandle();
    const storeA = new DirectoryHandleFileStore(sharedFolder, USER_A_SCOPE);
    const storeB = new DirectoryHandleFileStore(sharedFolder, USER_B_SCOPE);
    await storeA.init();
    await storeB.init();
    await storeA.writeFile('org-1/dh_shared/results.csv', TEXT_ENCODER.encode('a'), { gzip: false });
    await storeB.writeFile('org-1/dh_shared/results.csv', TEXT_ENCODER.encode('b'), { gzip: false });

    // Exactly what the sweep does to a dir it considers orphaned
    await storeB.deleteEntryDir('org-1/dh_shared');

    expect(await (await storeA.readFile('org-1/dh_shared/results.csv', { gunzip: false })).text()).toBe('a');
    expect(await storeB.listEntryDirs()).toEqual([]);
  });

  it('NativeFsFileStore: two users in one desktop history folder never see each other', async () => {
    const sharedFolder = new Map<string, Uint8Array>();

    (window as any).electronAPI = createFakeElectronDataHistoryApi(sharedFolder);
    const storeA = new NativeFsFileStore(USER_A_SCOPE);
    await storeA.init();
    await storeA.writeFile('org-1/dh_a/manifest.json', TEXT_ENCODER.encode('{"user":"a"}'), { gzip: false });

    (window as any).electronAPI = createFakeElectronDataHistoryApi(sharedFolder);
    const storeB = new NativeFsFileStore(USER_B_SCOPE);
    await storeB.init();
    await storeB.writeFile('org-1/dh_b/manifest.json', TEXT_ENCODER.encode('{"user":"b"}'), { gzip: false });

    // Reindex is native-only and imports whatever it enumerates, so this is the leak that matters
    expect(await storeB.listEntryDirs()).toEqual([{ orgFolder: 'org-1', entryKey: 'dh_b' }]);
    await expect(storeB.readFile('org-1/dh_a/manifest.json', { gunzip: false })).rejects.toThrow();
  });
});

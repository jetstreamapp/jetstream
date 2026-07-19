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
  const store = new DirectoryHandleFileStore(new FakeFsaDirectoryHandle());
  await store.init();
  return store;
});

describe('DirectoryHandleFileStore permissions', () => {
  it('init throws DataHistoryDirectoryPermissionError when permission is not granted', async () => {
    const root = new FakeFsaDirectoryHandle();
    root.permissionState = 'prompt';
    const store = new DirectoryHandleFileStore(root);
    await expect(store.init()).rejects.toBeInstanceOf(DataHistoryDirectoryPermissionError);
  });

  it('requestAccess re-grants and init succeeds afterwards', async () => {
    const root = new FakeFsaDirectoryHandle();
    root.permissionState = 'prompt';
    root.permissionStateAfterRequest = 'granted';
    const store = new DirectoryHandleFileStore(root);
    expect(await store.requestAccess()).toBe(true);
    await store.init();
  });
});

/**
 * In-memory stand-in for the Electron main-process handler (`data-history-file.service.ts`),
 * mirroring its semantics (node zlib gzip, raw bytes over IPC) so NativeFsFileStore passes the
 * same contract as every other backend.
 */
function createFakeElectronDataHistoryApi() {
  const files = new Map<string, Uint8Array>();
  const streams = new Map<number, { chunks: Uint8Array[]; gzip: boolean; path: string }>();
  let nextStreamId = 1;

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
        return undefined;
      }
      case 'write-file': {
        const output = payload.gzip ? new Uint8Array(gzipSync(payload.bytes)) : payload.bytes;
        files.set(payload.path, output);
        return { bytes: output.byteLength };
      }
      case 'open-stream': {
        const streamId = nextStreamId++;
        streams.set(streamId, { chunks: [], gzip: payload.gzip, path: payload.path });
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
        const bytes = files.get(payload.path);
        if (!bytes) {
          throw new Error(`File not found: ${payload.path}`);
        }
        return payload.gunzip ? new Uint8Array(gunzipSync(bytes)) : bytes;
      }
      case 'delete-dir': {
        for (const path of Array.from(files.keys())) {
          if (path.startsWith(`${payload.path}/`)) {
            files.delete(path);
          }
        }
        return undefined;
      }
      case 'list-entry-dirs': {
        const dirs = new Map<string, { orgFolder: string; entryKey: string }>();
        for (const path of files.keys()) {
          const segments = path.split('/');
          if (segments.length >= 3) {
            dirs.set(`${segments[0]}/${segments[1]}`, { orgFolder: segments[0], entryKey: segments[1] });
          }
        }
        return { dirs: Array.from(dirs.values()) };
      }
      case 'estimate': {
        let usageBytes = 0;
        files.forEach((bytes) => (usageBytes += bytes.byteLength));
        return { usageBytes };
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
  const store = new NativeFsFileStore();
  await store.init();
  return store;
});

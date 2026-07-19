import { describe, expect, it } from 'vitest';
import { FakeFileStore } from '../file-store/fake-file-store';
import { HistoryFileStore } from '../file-store/file-store.types';

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

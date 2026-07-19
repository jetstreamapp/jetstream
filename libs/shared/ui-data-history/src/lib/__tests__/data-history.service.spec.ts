import { SalesforceOrgUi } from '@jetstream/types';
import { dataHistoryDb, dexieDb } from '@jetstream/ui/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DataHistoryEntryHandle,
  deleteAllDataHistory,
  deleteDataHistoryEntry,
  getDataHistoryStorageHealth,
  initDataHistory,
  isDataHistoryCaptureEnabled,
  readDataHistoryFile,
  recordDataHistoryAction,
  setDataHistoryEnabled,
  setDataHistoryPinned,
  startDataHistoryEntry,
} from '../data-history.service';
import { FakeFileStore } from '../file-store/fake-file-store';
import { setHistoryFileStoreForTests } from '../file-store/file-store-factory';
import { getOrgFolderName } from '../file-store/path-utils';

const org = { uniqueId: 'org-unique-id-1', label: 'My Dev Org' } as SalesforceOrgUi;

let fakeStore: FakeFileStore;

function startOptions(overrides: Partial<Parameters<typeof startDataHistoryEntry>[0]> = {}) {
  return {
    org,
    source: 'load-records',
    operation: 'insert',
    api: 'bulk-v1',
    sobjects: ['Account'],
    config: { batchSize: 5000, apiMode: 'BULK' },
    inputSource: { type: 'local', fileName: 'accounts.csv' },
    ...overrides,
  } as Parameters<typeof startDataHistoryEntry>[0];
}

async function clearAllTables() {
  await dexieDb.data_history.clear();
  await dexieDb.data_history_config.clear();
}

describe('before initialization', () => {
  it('capture is disabled and startDataHistoryEntry returns null', async () => {
    expect(await isDataHistoryCaptureEnabled()).toBe(false);
    expect(await startDataHistoryEntry(startOptions())).toBeNull();
    await recordDataHistoryAction({
      org,
      source: 'record-modal',
      operation: 'edit',
      api: 'collections',
      sobjects: ['Account'],
      request: { Id: '001' },
      results: [{ id: '001', success: true }],
      counts: { total: 1, success: 1, failure: 0 },
    });
    expect(await dataHistoryDb.getEntryCount()).toBe(0);
  });
});

describe('initialized', () => {
  beforeAll(async () => {
    await initDataHistory({ hasPaidPlan: true });
  });

  beforeEach(async () => {
    await clearAllTables();
    fakeStore = new FakeFileStore();
    setHistoryFileStoreForTests(fakeStore);
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  describe('startDataHistoryEntry + DataHistoryEntryHandle', () => {
    it('captures a full load lifecycle: input, request, streamed results, finish', async () => {
      const handle = (await startDataHistoryEntry(startOptions())) as DataHistoryEntryHandle;
      expect(handle).toBeTruthy();

      // in-progress row exists immediately so a crash still leaves a visible entry
      let entry = await dataHistoryDb.getEntry(handle.key);
      expect(entry?.status).toBe('in-progress');
      expect(entry?.orgLabel).toBe('My Dev Org');

      await handle.writeInputRows(
        [
          { Name: 'Acme', Industry: 'Tech' },
          { Name: 'Globex', Industry: 'Energy' },
        ],
        ['Name', 'Industry'],
      );
      await handle.writeRequestJson([{ Name: 'Acme' }, { Name: 'Globex' }]);
      const resultsHeader = ['_id', '_success', '_errors', 'Name'];
      await handle.appendResultsRows(
        [
          { _id: '001', _success: true, _errors: '', Name: 'Acme' },
          { _id: '002', _success: true, _errors: '', Name: 'Globex' },
        ],
        resultsHeader,
      );
      await handle.appendResultsRows([{ _id: '', _success: false, _errors: 'REQUIRED_FIELD_MISSING', Name: 'Bad' }], resultsHeader);
      await handle.finish({ counts: { total: 3, success: 2, failure: 1 }, jobId: '750000001' });
      await handle.flush();

      entry = await dataHistoryDb.getEntry(handle.key);
      expect(entry?.status).toBe('partial');
      expect(entry?.counts).toEqual({ total: 3, success: 2, failure: 1 });
      expect(entry?.jobId).toBe('750000001');
      expect(entry?.finishedAt).toBeInstanceOf(Date);
      expect(entry?.files.map(({ kind }) => kind).sort()).toEqual(['input', 'request', 'results']);
      expect(entry?.sizeBytes).toBeGreaterThan(0);
      expect(entry?.sizeBytes).toBe(entry?.files.reduce((total, file) => total + file.bytes, 0));

      // results stream reassembles with a single header row
      const results = await readDataHistoryFile(entry!, 'results');
      const resultsCsv = await results!.blob.text();
      const lines = resultsCsv.split('\n');
      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe('_id,_success,_errors,Name');
      expect(lines[3]).toBe(',false,REQUIRED_FIELD_MISSING,Bad');
      expect(lines.filter((line) => line === lines[0])).toHaveLength(1);

      const input = await readDataHistoryFile(entry!, 'input');
      expect(await input!.blob.text()).toBe('Name,Industry\nAcme,Tech\nGlobex,Energy');

      // manifest written alongside the files, self-describing
      const orgFolder = await getOrgFolderName(org.uniqueId);
      const manifestFile = fakeStore.files.get(`${orgFolder}/${handle.key}/manifest.json`);
      expect(manifestFile).toBeTruthy();
      const manifest = JSON.parse(new TextDecoder().decode(manifestFile?.bytes));
      expect(manifest.manifestVersion).toBe(1);
      expect(manifest.key).toBe(handle.key);
      expect(manifest.status).toBe('partial');
      expect(manifest.inlinePayload).toBeUndefined();
    });

    it('derives success status and supports explicit fail()', async () => {
      const successHandle = (await startDataHistoryEntry(startOptions())) as DataHistoryEntryHandle;
      await successHandle.finish({ counts: { total: 2, success: 2, failure: 0 } });
      expect((await dataHistoryDb.getEntry(successHandle.key))?.status).toBe('success');

      const failedHandle = (await startDataHistoryEntry(startOptions())) as DataHistoryEntryHandle;
      await failedHandle.fail('Salesforce rejected the job');
      const failedEntry = await dataHistoryDb.getEntry(failedHandle.key);
      expect(failedEntry?.status).toBe('failed');
      expect(failedEntry?.errorMessage).toBe('Salesforce rejected the job');
    });

    it('NEVER rejects into the caller when the store dies mid-write; entry is marked failed', async () => {
      const handle = (await startDataHistoryEntry(startOptions())) as DataHistoryEntryHandle;
      fakeStore.simulateFailure = (op) => op === 'stream-write';

      await expect(handle.writeInputRows([{ Name: 'Acme' }], ['Name'])).resolves.toBeUndefined();
      await expect(handle.appendResultsRows([{ _id: '1' }], ['_id'])).resolves.toBeUndefined();
      await expect(handle.finish({ counts: { total: 1, success: 1, failure: 0 } })).resolves.toBeUndefined();
      await handle.flush();

      const entry = await dataHistoryDb.getEntry(handle.key);
      expect(entry?.status).toBe('failed');
      expect(entry?.errorMessage).toContain('Simulated failure');
      // finish() after failure was a no-op — status must not have been overwritten to success
      expect(entry?.counts).toEqual({ total: 0, success: 0, failure: 0 });
      // aborted partial file was cleaned up
      const orgFolder = await getOrgFolderName(org.uniqueId);
      expect(fakeStore.files.has(`${orgFolder}/${handle.key}/input.csv.gz`)).toBe(false);
    });

    it('returns null for per-run opt-out and when disabled in settings', async () => {
      expect(await startDataHistoryEntry(startOptions({ skipHistory: true }))).toBeNull();

      await setDataHistoryEnabled(false);
      expect(await isDataHistoryCaptureEnabled()).toBe(false);
      expect(await startDataHistoryEntry(startOptions())).toBeNull();

      await setDataHistoryEnabled(true);
      expect(await startDataHistoryEntry(startOptions())).toBeTruthy();
    });
  });

  describe('recordDataHistoryAction', () => {
    it('stores small payloads inline without touching the file store', async () => {
      await recordDataHistoryAction({
        org,
        source: 'record-modal',
        operation: 'edit',
        api: 'collections',
        sobjects: ['Account'],
        request: { Id: '001ABC', Name: 'Updated Name' },
        results: [{ id: '001ABC', success: true }],
        counts: { total: 1, success: 1, failure: 0 },
      });

      const [entry] = await dataHistoryDb.getAllEntries();
      expect(entry.status).toBe('success');
      // ArrayBuffer.isView instead of toBeInstanceOf — realm-safe (instanceof fails cross-realm in jsdom)
      expect(ArrayBuffer.isView(entry.inlinePayload)).toBe(true);
      expect(entry.files).toHaveLength(0);
      expect(entry.sizeBytes).toBe(entry.inlinePayload?.byteLength);
      expect(fakeStore.files.size).toBe(0);

      const request = await readDataHistoryFile(entry, 'request');
      expect(JSON.parse(await request!.blob.text())).toEqual({ Id: '001ABC', Name: 'Updated Name' });
      const results = await readDataHistoryFile(entry, 'results');
      expect(JSON.parse(await results!.blob.text())).toEqual([{ id: '001ABC', success: true }]);
    });

    it('stores large payloads as files with a manifest', async () => {
      const bigValue = 'x'.repeat(70_000);
      await recordDataHistoryAction({
        org,
        source: 'query-table-edit',
        operation: 'update',
        api: 'collections',
        sobjects: ['Contact'],
        request: [{ Id: '003', Notes: bigValue }],
        results: [{ id: '003', success: false, errors: [{ message: 'boom' }] }],
        counts: { total: 1, success: 0, failure: 1 },
      });

      const [entry] = await dataHistoryDb.getAllEntries();
      expect(entry.status).toBe('failed');
      expect(entry.inlinePayload).toBeNull();
      expect(entry.files.map(({ kind }) => kind).sort()).toEqual(['request', 'results']);
      // request + results + manifest
      expect(fakeStore.files.size).toBe(3);

      const request = await readDataHistoryFile(entry, 'request');
      expect(JSON.parse(await request!.blob.text())[0].Notes).toBe(bigValue);
    });
  });

  describe('management APIs', () => {
    it('pins entries through the boolean index mirror', async () => {
      const handle = (await startDataHistoryEntry(startOptions())) as DataHistoryEntryHandle;
      await handle.finish({ counts: { total: 1, success: 1, failure: 0 } });

      await setDataHistoryPinned(handle.key, true);
      let entry = await dataHistoryDb.getEntry(handle.key);
      expect(entry?.pinned).toBe(true);
      expect(entry?.pinnedIdx).toBe('true');

      await setDataHistoryPinned(handle.key, false);
      entry = await dataHistoryDb.getEntry(handle.key);
      expect(entry?.pinnedIdx).toBe('false');
    });

    it('deletes a single entry with its files, and deletes everything on clear-all', async () => {
      const first = (await startDataHistoryEntry(startOptions())) as DataHistoryEntryHandle;
      await first.writeInputRows([{ Name: 'a' }], ['Name']);
      await first.finish({ counts: { total: 1, success: 1, failure: 0 } });
      const second = (await startDataHistoryEntry(startOptions())) as DataHistoryEntryHandle;
      await second.writeInputRows([{ Name: 'b' }], ['Name']);
      await second.finish({ counts: { total: 1, success: 1, failure: 0 } });

      await deleteDataHistoryEntry(first.key);
      expect(await dataHistoryDb.getEntry(first.key)).toBeUndefined();
      const orgFolder = await getOrgFolderName(org.uniqueId);
      expect(Array.from(fakeStore.files.keys()).some((path) => path.includes(first.key))).toBe(false);
      expect(fakeStore.files.has(`${orgFolder}/${second.key}/input.csv.gz`)).toBe(true);

      await deleteAllDataHistory();
      expect(await dataHistoryDb.getEntryCount()).toBe(0);
      expect(fakeStore.files.size).toBe(0);
    });

    it('reports storage health from row accounting', async () => {
      const handle = (await startDataHistoryEntry(startOptions())) as DataHistoryEntryHandle;
      await handle.writeInputRows([{ Name: 'a' }], ['Name']);
      await handle.finish({ counts: { total: 1, success: 1, failure: 0 } });

      const health = await getDataHistoryStorageHealth();
      expect(health?.entryCount).toBe(1);
      expect(health?.usedBytes).toBeGreaterThan(0);
      expect(health?.maxTotalBytes).toBeGreaterThan(0);
    });
  });
});

import { SalesforceOrgUi } from '@jetstream/types';
import { dataHistoryDb, getDexieDb } from '@jetstream/ui/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DATA_HISTORY_PAID_TIER_GRACE_MS } from '../data-history-limits';
import {
  buildDataHistoryInputSource,
  deleteAllDataHistory,
  deleteDataHistoryEntry,
  getDataHistoryLimits,
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
  await getDexieDb().data_history.clear();
  await getDexieDb().data_history_config.clear();
}

describe('buildDataHistoryInputSource', () => {
  it('describes a local file source', () => {
    expect(buildDataHistoryInputSource({ filename: 'accounts.csv', filenameType: 'local', googleFileId: null })).toEqual({
      type: 'local',
      fileName: 'accounts.csv',
      googleFileId: undefined,
    });
  });

  it('describes a google file source and retains the file id', () => {
    expect(buildDataHistoryInputSource({ filename: 'Sheet1', filenameType: 'google', googleFileId: 'gfile-123' })).toEqual({
      type: 'google',
      fileName: 'Sheet1',
      googleFileId: 'gfile-123',
    });
  });

  it('defaults to local and omits the google id when the type is unknown', () => {
    expect(buildDataHistoryInputSource({ filename: null, filenameType: null, googleFileId: 'ignored' })).toEqual({
      type: 'local',
      fileName: undefined,
      googleFileId: undefined,
    });
  });
});

describe('before initialization', () => {
  it('capture is disabled and a started entry records nothing', async () => {
    expect(await isDataHistoryCaptureEnabled()).toBe(false);
    const handle = startDataHistoryEntry(startOptions());
    await handle.writeInputRows([{ Name: 'Acme' }], ['Name']);
    await handle.finish({ counts: { total: 1, success: 1, failure: 0 } });
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
      const handle = startDataHistoryEntry(startOptions());
      expect(handle.key).toMatch(/^dh_/);

      // in-progress row is written before any payload file, so a crash still leaves a visible entry
      await handle.flush();
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
      const successHandle = startDataHistoryEntry(startOptions());
      await successHandle.finish({ counts: { total: 2, success: 2, failure: 0 } });
      expect((await dataHistoryDb.getEntry(successHandle.key))?.status).toBe('success');

      const failedHandle = startDataHistoryEntry(startOptions());
      await failedHandle.fail('Salesforce rejected the job');
      const failedEntry = await dataHistoryDb.getEntry(failedHandle.key);
      expect(failedEntry?.status).toBe('failed');
      expect(failedEntry?.errorMessage).toBe('Salesforce rejected the job');
    });

    it('NEVER rejects into the caller when the store dies mid-write; entry is marked failed', async () => {
      const handle = startDataHistoryEntry(startOptions());
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

    it('records nothing for a per-run opt-out or when disabled in settings, and skips capture-only work', async () => {
      const captureTask = vi.fn().mockResolvedValue(undefined);

      const optedOut = startDataHistoryEntry(startOptions({ skipHistory: true }));
      await optedOut.writeInputRows([{ Name: 'Acme' }], ['Name']);
      await optedOut.capture(captureTask);
      expect(await dataHistoryDb.getEntryCount()).toBe(0);

      await setDataHistoryEnabled(false);
      expect(await isDataHistoryCaptureEnabled()).toBe(false);
      const disabled = startDataHistoryEntry(startOptions());
      await disabled.writeInputRows([{ Name: 'Acme' }], ['Name']);
      await disabled.capture(captureTask);
      expect(await dataHistoryDb.getEntryCount()).toBe(0);
      expect(fakeStore.files.size).toBe(0);
      // Expensive capture-only work (e.g. re-fetching bulk results) must never run for these
      expect(captureTask).not.toHaveBeenCalled();

      await setDataHistoryEnabled(true);
      const enabled = startDataHistoryEntry(startOptions());
      await enabled.capture(captureTask);
      expect(captureTask).toHaveBeenCalledTimes(1);
      expect(await dataHistoryDb.getEntry(enabled.key)).toBeTruthy();
    });
  });

  describe('backend compression policy', () => {
    it('writes plain .csv/.json files when the backend prefers uncompressed (user-visible folders)', async () => {
      fakeStore = new FakeFileStore('directory', { compressFiles: false, userVisibleFiles: true });
      setHistoryFileStoreForTests(fakeStore);

      const handle = startDataHistoryEntry(startOptions());
      await handle.writeInputRows([{ Name: 'Acme' }], ['Name']);
      await handle.appendResultsRows([{ _id: '001', _success: true }], ['_id', '_success']);
      await handle.finish({ counts: { total: 1, success: 1, failure: 0 } });
      await handle.flush();

      const entry = await dataHistoryDb.getEntry(handle.key);
      expect(entry?.files.map(({ fileName }) => fileName).sort()).toEqual(['input.csv', 'results.csv']);
      expect(entry?.files.every(({ compressed }) => !compressed)).toBe(true);
      const orgFolder = await getOrgFolderName(org.uniqueId);
      const inputFile = fakeStore.files.get(`${orgFolder}/${handle.key}/input.csv`);
      expect(new TextDecoder().decode(inputFile?.bytes)).toBe('Name\nAcme');
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

    it('stamps inline entries with the ACTIVE backend, not a hardcoded opfs', async () => {
      // A row claiming a backend it does not live on makes the retention sweep re-visit it as
      // "stranded" on every app start — every record-modal/query edit would add to that churn.
      fakeStore = new FakeFileStore('directory', { compressFiles: false, userVisibleFiles: true });
      setHistoryFileStoreForTests(fakeStore);

      await recordDataHistoryAction({
        org,
        source: 'record-modal',
        operation: 'edit',
        api: 'collections',
        sobjects: ['Account'],
        request: { Id: '001ABC' },
        results: [{ id: '001ABC', success: true }],
        counts: { total: 1, success: 1, failure: 0 },
      });

      const [entry] = await dataHistoryDb.getAllEntries();
      expect(entry.inlinePayload).not.toBeNull();
      expect(entry.storageBackend).toBe('directory');
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

    it('does not leave a row behind when large-payload file writes fail', async () => {
      fakeStore.simulateFailure = (op) => op === 'write-file';

      await recordDataHistoryAction({
        org,
        source: 'query-table-edit',
        operation: 'update',
        api: 'collections',
        sobjects: ['Contact'],
        request: [{ Id: '003', Notes: 'x'.repeat(70_000) }],
        results: [{ id: '003', success: true }],
        counts: { total: 1, success: 1, failure: 0 },
      });

      // The row is saved before the files (orphan-sweep invariant) but rolled back on failure so
      // no entry claims payloads that were never written
      expect(await dataHistoryDb.getEntryCount()).toBe(0);
    });
  });

  describe('management APIs', () => {
    it('pins entries through the boolean index mirror', async () => {
      const handle = startDataHistoryEntry(startOptions());
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
      const first = startDataHistoryEntry(startOptions());
      await first.writeInputRows([{ Name: 'a' }], ['Name']);
      await first.finish({ counts: { total: 1, success: 1, failure: 0 } });
      const second = startDataHistoryEntry(startOptions());
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
      const handle = startDataHistoryEntry(startOptions());
      await handle.writeInputRows([{ Name: 'a' }], ['Name']);
      await handle.finish({ counts: { total: 1, success: 1, failure: 0 } });

      const health = await getDataHistoryStorageHealth();
      expect(health?.entryCount).toBe(1);
      expect(health?.usedBytes).toBeGreaterThan(0);
      expect(health?.maxTotalBytes).toBeGreaterThan(0);
    });

    it('totals usage across entries of identical size', async () => {
      // usedBytes is summed from the `sizeBytes` INDEX rather than from the rows; identical sizes are
      // duplicate index keys, so this pins that they each still count (`keys()`, not `uniqueKeys()`)
      const writeIdenticalEntry = async () => {
        const handle = startDataHistoryEntry(startOptions());
        await handle.writeInputRows([{ Name: 'same' }], ['Name']);
        await handle.finish({ counts: { total: 1, success: 1, failure: 0 } });
        return (await dataHistoryDb.getEntry(handle.key))?.sizeBytes ?? 0;
      };
      const firstSize = await writeIdenticalEntry();
      const secondSize = await writeIdenticalEntry();
      expect(firstSize).toBe(secondSize);

      const health = await getDataHistoryStorageHealth();
      expect(health?.entryCount).toBe(2);
      expect(health?.usedBytes).toBe(firstSize + secondSize);
    });

    it('tombstones entries whose files could not be deleted so reindex cannot resurrect them', async () => {
      const handle = startDataHistoryEntry(startOptions());
      await handle.writeInputRows([{ Name: 'a' }], ['Name']);
      await handle.finish({ counts: { total: 1, success: 1, failure: 0 } });

      fakeStore.simulateFailure = (op) => op === 'delete-dir';
      await deleteDataHistoryEntry(handle.key);

      expect(await dataHistoryDb.getEntry(handle.key)).toBeUndefined();
      expect(await dataHistoryDb.getDeletedEntryTombstones()).toContain(handle.key);
    });

    it('tombstones every user deletion, even when the file delete succeeds, so a straggling writer cannot resurrect it', async () => {
      const handle = startDataHistoryEntry(startOptions());
      await handle.writeInputRows([{ Name: 'a' }], ['Name']);
      await handle.finish({ counts: { total: 1, success: 1, failure: 0 } });

      const result = await deleteDataHistoryEntry(handle.key);
      expect(result.deleted).toBe(true);
      expect(await dataHistoryDb.getDeletedEntryTombstones()).toContain(handle.key);
    });

    it('refuses to delete an entry that is still being written', async () => {
      const handle = startDataHistoryEntry(startOptions());
      await handle.writeInputRows([{ Name: 'a' }], ['Name']);
      await handle.flush();

      const whileInFlight = await deleteDataHistoryEntry(handle.key);
      expect(whileInFlight.deleted).toBe(false);
      expect(await dataHistoryDb.getEntry(handle.key)).toBeDefined();
      // Refusal must not tombstone — the entry still exists and reindex must keep working for it
      expect(await dataHistoryDb.getDeletedEntryTombstones()).not.toContain(handle.key);

      await handle.finish({ counts: { total: 1, success: 1, failure: 0 } });
      const afterFinish = await deleteDataHistoryEntry(handle.key);
      expect(afterFinish.deleted).toBe(true);
      expect(await dataHistoryDb.getEntry(handle.key)).toBeUndefined();
    });

    it('clear-all skips in-flight entries and reports them as skipped', async () => {
      const finished = startDataHistoryEntry(startOptions());
      await finished.finish({ counts: { total: 1, success: 1, failure: 0 } });
      const inFlight = startDataHistoryEntry(startOptions());
      await inFlight.flush();

      expect(await deleteAllDataHistory()).toEqual({ deleted: 1, skipped: 1 });
      expect(await dataHistoryDb.getEntry(inFlight.key)).toBeDefined();
      await inFlight.finish({ counts: { total: 1, success: 1, failure: 0 } });
    });
  });
});

// Runs LAST — these initDataHistory calls change the module-level tier the earlier suites rely on
describe('paid-tier grace period', () => {
  beforeEach(async () => {
    await clearAllTables();
    fakeStore = new FakeFileStore();
    setHistoryFileStoreForTests(fakeStore);
  });

  afterEach(() => {
    setHistoryFileStoreForTests(null);
  });

  it('keeps paid limits during the grace window after the paid signal disappears', async () => {
    await initDataHistory({ hasPaidPlan: true });
    expect(getDataHistoryLimits()?.maxEntries).toBeNull();

    // e.g. a team dropping to PAST_DUE from an expired card
    await initDataHistory({ hasPaidPlan: false });
    expect(getDataHistoryLimits()?.maxEntries).toBeNull();
  });

  it('drops to free limits once the grace window has passed', async () => {
    await dataHistoryDb.savePaidPlanLastSeenAt(new Date(Date.now() - DATA_HISTORY_PAID_TIER_GRACE_MS - 1000));
    await initDataHistory({ hasPaidPlan: false });
    expect(getDataHistoryLimits()?.maxEntries).toBe(15);
  });

  it('applies free limits immediately for users who were never paid', async () => {
    await initDataHistory({ hasPaidPlan: false });
    expect(getDataHistoryLimits()?.maxEntries).toBe(15);
  });
});

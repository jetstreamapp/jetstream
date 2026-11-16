import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { SYNC_STATE_ID } from '../../ui-db';
import { SyncEngine } from '../sync-engine';
import { SyncApi } from '../sync-store';
import { createDevice, FakeSyncServer, getQueryHistory, makeQueryHistoryItem, TestDevice } from './sync-test-utils';

let server: FakeSyncServer;
let deviceA: TestDevice;
let deviceB: TestDevice;

const minutesAfter = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);
const BASE = new Date('2026-06-01T00:00:00.000Z');

async function syncAll(...devices: TestDevice[]) {
  // Two passes: the first can leave a device behind changes pushed by a device that synced after it
  for (let pass = 0; pass < 2; pass++) {
    for (const { engine } of devices) {
      await engine.syncNow();
    }
  }
}

async function expectInSync(...devices: TestDevice[]) {
  const [first, ...rest] = await Promise.all(devices.map(getQueryHistory));
  for (const other of rest) {
    expect(other).toEqual(first);
  }
  for (const { db } of devices) {
    expect(await db._sync_outbox.count()).toBe(0);
  }
  expect(first.map(({ key }) => key)).toEqual(
    server
      .liveRows()
      .map(({ key }) => key)
      .sort(),
  );
  return first;
}

beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  server = new FakeSyncServer();
  deviceA = createDevice(server);
  deviceB = createDevice(server);
});

describe('two devices', () => {
  it('sends a new record to the other device', async () => {
    await deviceA.db.query_history.put(makeQueryHistoryItem('a'));
    await syncAll(deviceA, deviceB);

    const records = await expectInSync(deviceA, deviceB);
    expect(records).toHaveLength(1);
    // Dates must arrive as dates - they are indexed, and strings sort as a different type
    expect((await deviceB.db.query_history.toArray())[0].lastRun).toBeInstanceOf(Date);
    expect((await deviceB.db.query_history.toArray())[0].createdAt).toBeInstanceOf(Date);
    expect((await deviceB.db.query_history.toArray())[0].isFavoriteIdx).toBe('false');
  });

  it('applies an update to a record the other device already has', async () => {
    const item = makeQueryHistoryItem('a');
    await deviceA.db.query_history.put(item);
    await syncAll(deviceA, deviceB);

    await deviceA.db.query_history.update(item.key, {
      isFavorite: true,
      runCount: 9,
      customLabel: 'Mine',
      updatedAt: minutesAfter(BASE, 5),
    });
    await syncAll(deviceA, deviceB);

    const [record] = await expectInSync(deviceA, deviceB);
    expect(record).toMatchObject({ isFavorite: true, runCount: 9, customLabel: 'Mine' });
    expect((await deviceB.db.query_history.get(item.key))?.isFavoriteIdx).toBe('true');
  });

  it('accepts an edit that did not bump updatedAt, because it was made on the version the server holds', async () => {
    const item = makeQueryHistoryItem('a');
    await deviceA.db.query_history.put(item);
    await syncAll(deviceA, deviceB);

    await deviceB.db.query_history.update(item.key, { isFavorite: true });
    await syncAll(deviceB, deviceA);

    const [record] = await expectInSync(deviceA, deviceB);
    expect(record.isFavorite).toBe(true);
  });

  it('accepts an edit from a device whose clock is far behind', async () => {
    const item = makeQueryHistoryItem('a', { updatedAt: minutesAfter(BASE, 60) });
    await deviceA.db.query_history.put(item);
    await syncAll(deviceA, deviceB);

    // Device B's clock is an hour slow, so its edit carries an older timestamp than the record it edited
    await deviceB.db.query_history.update(item.key, { customLabel: 'from the slow device', updatedAt: minutesAfter(BASE, 1) });
    await syncAll(deviceB, deviceA);

    const [record] = await expectInSync(deviceA, deviceB);
    expect(record.customLabel).toBe('from the slow device');
  });

  it('removes a deleted record from the other device', async () => {
    const item = makeQueryHistoryItem('a');
    await deviceA.db.query_history.bulkPut([item, makeQueryHistoryItem('b')]);
    await syncAll(deviceA, deviceB);

    await deviceB.db.query_history.delete(item.key);
    await syncAll(deviceB, deviceA);

    expect(await expectInSync(deviceA, deviceB)).toHaveLength(1);
  });

  it('brings a record back when it is re-created after being deleted', async () => {
    const item = makeQueryHistoryItem('a');
    await deviceA.db.query_history.put(item);
    await syncAll(deviceA, deviceB);
    await deviceA.db.query_history.delete(item.key);
    await syncAll(deviceA, deviceB);

    await deviceB.db.query_history.put({ ...item, runCount: 2, updatedAt: new Date() });
    await syncAll(deviceB, deviceA);

    const [record] = await expectInSync(deviceA, deviceB);
    expect(record.runCount).toBe(2);
  });

  it('lets the later edit win when both devices changed a record while apart', async () => {
    const item = makeQueryHistoryItem('a');
    await deviceA.db.query_history.put(item);
    await syncAll(deviceA, deviceB);

    await deviceA.db.query_history.update(item.key, { customLabel: 'older edit', updatedAt: minutesAfter(BASE, 10) });
    await deviceB.db.query_history.update(item.key, { customLabel: 'newer edit', updatedAt: minutesAfter(BASE, 20) });

    // The older edit reaches the server last and must lose
    await deviceB.engine.syncNow();
    await deviceA.engine.syncNow();
    await syncAll(deviceA, deviceB);

    const [record] = await expectInSync(deviceA, deviceB);
    expect(record.customLabel).toBe('newer edit');
  });

  it('keeps an edit over a delete made earlier on another device, and a delete over an older edit', async () => {
    const edited = makeQueryHistoryItem('edited');
    const deleted = makeQueryHistoryItem('deleted');
    await deviceA.db.query_history.bulkPut([edited, deleted]);
    await syncAll(deviceA, deviceB);

    server.now = () => minutesAfter(BASE, 30);
    await deviceA.db.query_history.update(deleted.key, { runCount: 2, updatedAt: minutesAfter(BASE, 10) });
    await deviceA.db.query_history.update(edited.key, { runCount: 2, updatedAt: minutesAfter(BASE, 60) });
    await deviceA.engine.syncNow();

    // Device B deletes both without having seen those edits; its deletes are stamped at push time
    await deviceB.db.query_history.bulkDelete([edited.key, deleted.key]);
    await deviceB.db._sync_outbox.toCollection().modify({ changedAt: minutesAfter(BASE, 20) });
    await syncAll(deviceB, deviceA);

    const records = await expectInSync(deviceA, deviceB);
    expect(records.map(({ key }) => key)).toEqual([edited.key]);
  });

  it('does not lose an edit made while a push is in flight', async () => {
    const item = makeQueryHistoryItem('a');
    const api = server.createApi();
    let editDuringRequest: (() => Promise<unknown>) | null = null;
    const interceptingApi: SyncApi = {
      pull: api.pull,
      sync: async (request) => {
        const response = await api.sync(request);
        await editDuringRequest?.();
        editDuringRequest = null;
        return response;
      },
    };
    const device = createDevice(server, interceptingApi);
    await device.db.query_history.put(item);
    await device.engine.syncNow();

    await device.db.query_history.update(item.key, { runCount: 2, updatedAt: minutesAfter(BASE, 1) });
    editDuringRequest = () => device.db.query_history.update(item.key, { runCount: 3, updatedAt: minutesAfter(BASE, 2) });
    await device.engine.syncNow();
    await syncAll(device, deviceB);

    const [record] = await expectInSync(device, deviceB);
    expect(record.runCount).toBe(3);
  });

  it('does not let a remote change overwrite a local change that has not been sent yet', async () => {
    const item = makeQueryHistoryItem('a');
    await deviceA.db.query_history.put(item);
    await syncAll(deviceA, deviceB);

    await deviceA.db.query_history.update(item.key, { customLabel: 'remote', updatedAt: minutesAfter(BASE, 5) });
    await deviceA.engine.syncNow();

    // B edits later, then learns about A's change in the same request that carries its own
    await deviceB.db.query_history.update(item.key, { customLabel: 'local', updatedAt: minutesAfter(BASE, 9) });
    await syncAll(deviceB, deviceA);

    const [record] = await expectInSync(deviceA, deviceB);
    expect(record.customLabel).toBe('local');
  });

  it('pages through more changes than fit in one response', async () => {
    server.pageSize = 3;
    await deviceA.db.query_history.bulkPut(
      Array.from({ length: 20 }, (_, i) => makeQueryHistoryItem(`item-${String(i).padStart(2, '0')}`)),
    );
    await deviceB.db.query_history.put(makeQueryHistoryItem('b-only'));
    await deviceB.engine.syncNow();
    await deviceA.engine.syncNow();

    // B has one more local change to send while 20 remote changes are waiting for it
    await deviceB.db.query_history.put(makeQueryHistoryItem('b-second'));
    await syncAll(deviceB, deviceA);

    expect(await expectInSync(deviceA, deviceB)).toHaveLength(22);
  });

  it('sends more local changes than fit in one request', async () => {
    await deviceA.db.query_history.bulkPut(
      Array.from({ length: 130 }, (_, i) => makeQueryHistoryItem(`item-${String(i).padStart(3, '0')}`)),
    );
    await syncAll(deviceA, deviceB);
    expect(await expectInSync(deviceA, deviceB)).toHaveLength(130);
  });
});

describe('failures', () => {
  it('keeps local changes queued while the server is unreachable and sends them afterwards', async () => {
    server.offline = true;
    await deviceA.db.query_history.put(makeQueryHistoryItem('a'));
    await expect(deviceA.engine.syncNow()).resolves.toBeUndefined();
    expect(await deviceA.db._sync_outbox.count()).toBe(1);
    deviceA.engine.stop();

    // Same database, new engine - as after a page reload once the network is back
    server.offline = false;
    const restarted: TestDevice = { db: deviceA.db, engine: new SyncEngine(deviceA.db, server.createApi()) };
    await syncAll(restarted, deviceB);

    expect(await expectInSync(restarted, deviceB)).toHaveLength(1);
  });

  it('sets aside a record the server can never accept without blocking the rest', async () => {
    const bad = makeQueryHistoryItem('bad');
    const good = makeQueryHistoryItem('good');
    server.invalidKeys.add(bad.key);
    await deviceA.db.query_history.bulkPut([bad, good]);
    await syncAll(deviceA, deviceB);

    expect((await getQueryHistory(deviceB)).map(({ key }) => key)).toEqual([good.key]);
    // Still on the device, flagged, and not re-sent on every sync
    expect(await deviceA.db.query_history.get(bad.key)).toBeDefined();
    expect((await deviceA.db._sync_outbox.get(bad.key))?.error).toBeTruthy();
    const requestsBefore = server.requestCount;
    await deviceA.engine.syncNow();
    expect(server.requestCount).toBe(requestsBefore + 1);

    // Editing it queues it again, and once acceptable it goes through
    server.invalidKeys.clear();
    await deviceA.db.query_history.update(bad.key, { runCount: 2 });
    await syncAll(deviceA, deviceB);
    expect(await expectInSync(deviceA, deviceB)).toHaveLength(2);
  });

  it('splits changes that are too large for one request and sets aside a record that can never fit', async () => {
    const largeSoql = 'x'.repeat(400_000);
    const requestSizes: number[] = [];
    const api = server.createApi();
    const device = createDevice(server, {
      pull: api.pull,
      sync: async (request) => {
        requestSizes.push(JSON.stringify(request).length);
        return api.sync(request);
      },
    });
    const tooLarge = makeQueryHistoryItem('too-large', { soql: 'x'.repeat(600_000) });
    await device.db.query_history.bulkPut([
      ...Array.from({ length: 25 }, (_, i) => makeQueryHistoryItem(`large-${String(i).padStart(2, '0')}`, { soql: largeSoql })),
      tooLarge,
    ]);

    await syncAll(device, deviceB);

    // 25 x 400KB cannot go in one request (the server caps a request at 5 MiB)
    expect(requestSizes.length).toBeGreaterThan(1);
    expect(Math.max(...requestSizes)).toBeLessThan(5 * 1024 * 1024);
    expect(await deviceB.db.query_history.count()).toBe(25);
    expect((await device.db._sync_outbox.toArray()).map(({ key, error }) => [key, !!error])).toEqual([[tooLarge.key, true]]);
    expect(await device.db.query_history.get(tooLarge.key)).toBeDefined();
  });

  it('reconciles from scratch when the server no longer knows the cursor', async () => {
    await deviceA.db.query_history.put(makeQueryHistoryItem('a'));
    await syncAll(deviceA, deviceB);

    // Server restored from an older backup: it lost the record and its revisions restart lower
    server.rows.clear();
    server.revision = 0;
    await deviceB.db.query_history.put(makeQueryHistoryItem('b'));
    await syncAll(deviceB, deviceA);

    // Nothing is deleted just because the server lacks it - both devices re-upload what they have
    expect(await expectInSync(deviceA, deviceB)).toHaveLength(2);
  });
});

describe('reconcile', () => {
  it('repairs records that drifted apart with the same edit time by merging them', async () => {
    // The state the old sync left behind: same record, same updatedAt, different content
    const item = makeQueryHistoryItem('a');
    await deviceA.db.query_history.put({ ...item, isFavorite: true, runCount: 2 });
    await deviceA.db._sync_outbox.clear();
    await deviceB.db.query_history.put({ ...item, customLabel: 'Label from B', runCount: 7, lastRun: minutesAfter(BASE, 30) });
    await deviceB.db._sync_outbox.clear();
    await deviceB.db.query_history.put({ ...item, customLabel: 'Label from B', runCount: 7, lastRun: minutesAfter(BASE, 30) });

    await syncAll(deviceB, deviceA);

    const [record] = await expectInSync(deviceA, deviceB);
    expect(record).toMatchObject({ isFavorite: true, customLabel: 'Label from B', runCount: 7, lastRun: minutesAfter(BASE, 30) });
  });

  it('takes the newer side per record and uploads what only this device has', async () => {
    const serverNewer = makeQueryHistoryItem('server-newer');
    const localNewer = makeQueryHistoryItem('local-newer');
    await deviceA.db.query_history.bulkPut([
      { ...serverNewer, customLabel: 'server', updatedAt: minutesAfter(BASE, 10) },
      { ...localNewer, customLabel: 'server', updatedAt: minutesAfter(BASE, 1) },
    ]);
    await deviceA.engine.syncNow();

    // Device B has never synced: stale copy of one, newer copy of the other, and one of its own
    await deviceB.db.query_history.bulkPut([
      { ...serverNewer, customLabel: 'local', updatedAt: minutesAfter(BASE, 1) },
      { ...localNewer, customLabel: 'local', updatedAt: minutesAfter(BASE, 10) },
      makeQueryHistoryItem('local-only'),
    ]);
    await deviceB.db._sync_outbox.clear();
    await syncAll(deviceB, deviceA);

    const records = await expectInSync(deviceA, deviceB);
    expect(Object.fromEntries(records.map(({ key, customLabel }) => [key, customLabel]))).toEqual({
      [serverNewer.key]: 'server',
      [localNewer.key]: 'local',
      [makeQueryHistoryItem('local-only').key]: undefined,
    });
  });

  it('removes a local record the server holds a newer delete for, but keeps one edited after the delete', async () => {
    const deleted = makeQueryHistoryItem('deleted');
    const editedLater = makeQueryHistoryItem('edited-later');
    await deviceA.db.query_history.bulkPut([deleted, editedLater]);
    await deviceA.engine.syncNow();
    server.now = () => minutesAfter(BASE, 60);
    await deviceA.db.query_history.bulkDelete([deleted.key, editedLater.key]);
    await deviceA.db._sync_outbox.toCollection().modify({ changedAt: minutesAfter(BASE, 30) });
    await deviceA.engine.syncNow();

    await deviceB.db.query_history.bulkPut([deleted, { ...editedLater, runCount: 4, updatedAt: minutesAfter(BASE, 45) }]);
    await deviceB.db._sync_outbox.clear();
    await syncAll(deviceB, deviceA);

    const records = await expectInSync(deviceA, deviceB);
    expect(records.map(({ key }) => key)).toEqual([editedLater.key]);
  });

  it('carries over a delete the previous sync engine had not pushed', async () => {
    const item = makeQueryHistoryItem('a');
    await deviceA.db.query_history.put(item);
    await deviceA.engine.syncNow();

    // Device B on the old engine: had the record, deleted it locally, never told the server
    await deviceB.db.table('_syncNodes').add({ type: 'remote', url: '/', myRevision: 4 });
    await deviceB.db.table('_changes').bulkAdd([
      { rev: 3, type: 3, table: 'query_history', key: 'qh_already_pushed' },
      { rev: 5, type: 3, table: 'query_history', key: item.key },
    ]);
    await syncAll(deviceB, deviceA);

    expect(await expectInSync(deviceA, deviceB)).toHaveLength(0);
  });

  it('reset re-reconciles and repairs a device that is missing records', async () => {
    await deviceA.db.query_history.bulkPut([makeQueryHistoryItem('a'), makeQueryHistoryItem('b')]);
    await syncAll(deviceA, deviceB);

    // Device B silently lost a record without recording a delete (the kind of damage reset exists for)
    await deviceB.db.query_history.clear();
    await deviceB.db._sync_outbox.clear();
    await deviceB.engine.syncNow();
    expect(await deviceB.db.query_history.count()).toBe(0);

    await deviceB.engine.reset();

    expect(await expectInSync(deviceA, deviceB)).toHaveLength(2);
    expect((await deviceB.db._sync_state.get(SYNC_STATE_ID))?.reconciledAt).toBeInstanceOf(Date);
  });

  it('reset rejects when the server cannot be reached', async () => {
    await deviceA.engine.syncNow();
    server.offline = true;
    await expect(deviceA.engine.reset()).rejects.toThrow();
    deviceA.engine.stop();
  });
});

describe('convergence under random interleaving', () => {
  function createRandom(seed: number) {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let result = Math.imul(state ^ (state >>> 15), 1 | state);
      result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  it.each([1, 2, 3, 4, 5])('all devices end up identical (seed %i)', async (seed) => {
    const random = createRandom(seed);
    const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
    server.pageSize = 4;
    // Device clocks disagree: one is 90 seconds slow, one 45 seconds fast
    const devices = [deviceA, deviceB, createDevice(server)].map((device, i) => ({ device, clockOffsetMs: [0, -90_000, 45_000][i] }));
    const ids = Array.from({ length: 8 }, (_, i) => `k${i}`);
    let now = BASE.getTime();
    server.now = () => new Date(now);

    for (let step = 0; step < 250; step++) {
      now += 1_000;
      const { device, clockOffsetMs } = pick(devices);
      const deviceNow = new Date(now + clockOffsetMs);
      const id = pick(ids);
      const { key } = makeQueryHistoryItem(id);
      const action = random();
      if (action < 0.35) {
        const existing = await device.db.query_history.get(key);
        await device.db.query_history.put({
          ...makeQueryHistoryItem(id),
          ...existing,
          runCount: (existing?.runCount ?? 0) + 1,
          lastRun: deviceNow,
          updatedAt: deviceNow,
        });
      } else if (action < 0.55) {
        // Deliberately does not bump updatedAt
        await device.db.query_history.update(key, { isFavorite: random() < 0.5, customLabel: `label-${step}` });
      } else if (action < 0.7) {
        await device.db.query_history.delete(key);
      } else {
        await device.engine.syncNow();
      }
    }

    now += 60_000;
    const allDevices = devices.map(({ device }) => device);
    for (let pass = 0; pass < 3; pass++) {
      await syncAll(...allDevices);
    }

    await expectInSync(...allDevices);
  });
});

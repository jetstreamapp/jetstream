import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDexieInstance, DexieDb, SyncOutboxEntry } from '../../ui-db';
import { createSyncCaptureMiddleware } from '../sync-capture.middleware';
import { runRemoteApplyTransaction } from '../sync-store';
import { createDevice, FakeSyncServer, makeQueryHistoryItem } from './sync-test-utils';

let db: DexieDb;

async function getOutbox(): Promise<Record<string, SyncOutboxEntry['op']>> {
  const entries = await db._sync_outbox.toArray();
  return Object.fromEntries(entries.map(({ key, op }) => [key, op]));
}

beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  ({ db } = createDevice(new FakeSyncServer()));
});

describe('sync capture middleware', () => {
  const itemA = makeQueryHistoryItem('a');
  const itemB = makeQueryHistoryItem('b');
  const itemC = makeQueryHistoryItem('c', { org: 'org2' });

  it('queues adds, puts and bulk writes', async () => {
    await db.query_history.add(itemA);
    await db.query_history.put(itemB);
    await db.query_history.bulkPut([itemC]);

    expect(await getOutbox()).toEqual({ [itemA.key]: 'put', [itemB.key]: 'put', [itemC.key]: 'put' });
  });

  it('queues update() and modify(), which never go through put() in app code', async () => {
    await db.query_history.bulkPut([itemA, itemB]);
    await db._sync_outbox.clear();

    await db.query_history.update(itemA.key, { isFavorite: true });
    expect(await getOutbox()).toEqual({ [itemA.key]: 'put' });

    await db.query_history.where('org').equals('org1').modify({ runCount: 5 });
    expect(await getOutbox()).toEqual({ [itemA.key]: 'put', [itemB.key]: 'put' });
  });

  it('does not queue an update that matched no record', async () => {
    await db.query_history.update('qh_missing', { isFavorite: true });
    expect(await getOutbox()).toEqual({});
  });

  it('queues every way of deleting', async () => {
    await db.query_history.bulkPut([itemA, itemB, itemC]);
    await db._sync_outbox.clear();

    // by key
    await db.query_history.delete(itemA.key);
    expect(await getOutbox()).toEqual({ [itemA.key]: 'delete' });

    // by index
    await db.query_history.where({ org: 'org2' }).delete();
    expect(await getOutbox()).toEqual({ [itemA.key]: 'delete', [itemC.key]: 'delete' });

    // whole table (a key range, which names no records)
    await db.query_history.clear();
    expect(await getOutbox()).toEqual({ [itemA.key]: 'delete', [itemB.key]: 'delete', [itemC.key]: 'delete' });
  });

  it('queues deletes addressed by primary key range', async () => {
    await db.query_history.bulkPut([itemA, itemB]);
    await db._sync_outbox.clear();

    await db.query_history.where('key').equals(itemB.key).delete();
    expect(await getOutbox()).toEqual({ [itemB.key]: 'delete' });
  });

  it('keeps one entry per record and gives every change a new nonce', async () => {
    await db.query_history.put(itemA);
    const first = await db._sync_outbox.get(itemA.key);
    await db.query_history.update(itemA.key, { runCount: 2 });
    const second = await db._sync_outbox.get(itemA.key);
    await db.query_history.delete(itemA.key);
    const third = await db._sync_outbox.get(itemA.key);

    expect(await db._sync_outbox.count()).toBe(1);
    expect(third?.op).toBe('delete');
    expect(new Set([first?.nonce, second?.nonce, third?.nonce]).size).toBe(3);
  });

  it('captures writes made inside an explicit transaction that did not list the outbox', async () => {
    await db.transaction('rw', db.query_history, async () => {
      await db.query_history.put(itemA);
      await db.query_history.delete(itemA.key);
      await db.query_history.put(itemB);
    });
    expect(await getOutbox()).toEqual({ [itemA.key]: 'delete', [itemB.key]: 'put' });
  });

  it('queues nothing when the transaction is rolled back', async () => {
    await expect(
      db.transaction('rw', db.query_history, async () => {
        await db.query_history.put(itemA);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');

    expect(await db.query_history.count()).toBe(0);
    expect(await getOutbox()).toEqual({});
  });

  it('does not queue a row the database refused in a bulk write', async () => {
    await db.query_history.add(itemA);
    await db._sync_outbox.clear();

    // itemA already exists, so only itemB is stored
    await db.query_history.bulkAdd([itemA, itemB]).catch(() => undefined);

    expect(await getOutbox()).toEqual({ [itemB.key]: 'put' });
  });

  it('ignores local-only tables', async () => {
    await db.automation_control_history.put({ key: 'ach_1', org: 'org1', createdAt: new Date() } as never);
    await db._query_history_object.put({ key: 'k', org: 'org1', sObject: 'Account', sObjectLabel: 'Account', isTooling: 'false' });
    expect(await getOutbox()).toEqual({});
  });

  it('does not queue changes applied from the server', async () => {
    await runRemoteApplyTransaction(db, async () => {
      await db.query_history.put(itemA);
      await db.query_history.delete(itemA.key);
      await db.query_history.put(itemB);
    });
    expect(await db.query_history.count()).toBe(1);
    expect(await getOutbox()).toEqual({});

    // ...and capture is back on for the next local write
    await db.query_history.put(itemA);
    expect(await getOutbox()).toEqual({ [itemA.key]: 'put' });
  });
});

describe('schema upgrade from the dexie-syncable based build', () => {
  it('adds the sync tables and keeps the stores the old addons created', async () => {
    const name = 'sync-spec-upgrade';
    // What the previous build left on disk: schema version 6 plus the addon stores
    const previous = new Dexie(name);
    previous.version(6).stores({
      query_history: 'key,org,sObject,updatedAt,lastRun,isFavoriteIdx,[sObject+org],[sObject+isFavoriteIdx],[org+isFavoriteIdx]',
      _changes: '++rev',
      _syncNodes: '++id,myRevision,lastHeartBeat,&url,isMaster,type,status',
      _intercomm: '++id,destinationNode',
      _uncommittedChanges: '++id,node',
    });
    await previous.table('query_history').put(makeQueryHistoryItem('a'));
    await previous.table('_changes').add({ type: 3, table: 'query_history', key: 'qh_deleted' });
    previous.close();

    // With the capture middleware registered, exactly as the app creates its database
    const upgraded = createDexieInstance(name, (instance) => {
      instance.use(createSyncCaptureMiddleware(() => undefined));
    });
    await upgraded.open();

    expect(await upgraded.query_history.count()).toBe(1);
    expect(await upgraded.table('_changes').count()).toBe(1);
    expect(await upgraded._sync_outbox.count()).toBe(0);
    expect(upgraded.tables.map(({ name: tableName }) => tableName)).toEqual(expect.arrayContaining(['_sync_meta', '_sync_state']));

    // ...and capture works on the upgraded database
    await upgraded.query_history.put(makeQueryHistoryItem('b'));
    expect(await upgraded._sync_outbox.count()).toBe(1);
  });
});

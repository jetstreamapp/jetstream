import type { SyncV2Op, SyncV2Response } from '@jetstream/types';
import Dexie from 'dexie';
import { DexieDb, SYNC_STATE_ID, SyncableEntities, SyncableEntity, SyncStateEntry } from '../ui-db';
import { markTransactionAsRemote } from './sync-capture.middleware';

/** The server calls the engine depends on - injected so the engine can be driven by a fake server in tests */
export interface SyncApi {
  sync(request: { cursor: number; ops: SyncV2Op[] }): Promise<SyncV2Response>;
  pull(request: { cursor: number }): Promise<SyncV2Response>;
}

export const SYNCABLE_TABLE_NAMES = Array.from(SyncableEntities);

export function isSyncableEntity(entity: string): entity is SyncableEntity {
  return SyncableEntities.has(entity as SyncableEntity);
}

export function getSyncableTable(db: DexieDb, entity: SyncableEntity) {
  return db.table<Record<string, unknown>, string>(entity);
}

export async function getSyncState(db: DexieDb): Promise<SyncStateEntry | undefined> {
  return await db._sync_state.get(SYNC_STATE_ID);
}

/**
 * Run `scope` in one read-write transaction over every syncable table plus the sync bookkeeping
 * tables, flagged so the capture middleware does not queue its writes to be sent back to the server.
 * Applying server changes and moving the cursor happen together or not at all.
 */
export async function runRemoteApplyTransaction<T>(db: DexieDb, scope: () => Promise<T>): Promise<T> {
  return await db.transaction('rw', [...SYNCABLE_TABLE_NAMES, '_sync_outbox', '_sync_meta', '_sync_state'], async () => {
    const transaction = Dexie.currentTransaction;
    if (!transaction?.idbtrans) {
      throw new Error('Sync transaction was not created');
    }
    markTransactionAsRemote(transaction.idbtrans);
    return await scope();
  });
}

/**
 * Cross-tab mutual exclusion. Every tab shares the same IndexedDB (cursor and outbox included), so
 * two tabs syncing at once would only do redundant work - the server resolves duplicates either way,
 * which is why running without the Web Locks API is still safe.
 */
export async function withSyncLock<T>(lockName: string, callback: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return await navigator.locks.request(lockName, callback);
  }
  return await callback();
}

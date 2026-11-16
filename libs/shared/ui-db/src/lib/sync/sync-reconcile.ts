import { logger } from '@jetstream/shared/client-logger';
import type { SyncV2Record } from '@jetstream/types';
import { v4 as uuid } from 'uuid';
import { DexieDb, SYNC_STATE_ID, SyncableEntity, SyncMetaEntry, SyncOutboxEntry } from '../ui-db';
import { mergeDivergedRecords } from './sync-merge';
import { getRecordEditTime, isSameRecordContent, normalizeSyncedRecord } from './sync-normalize';
import { getSyncableTable, getSyncState, isSyncableEntity, runRemoteApplyTransaction, SYNCABLE_TABLE_NAMES, SyncApi } from './sync-store';

const MAX_PULL_PAGES = 500;

async function pullEverything(api: SyncApi) {
  const recordsByKey = new Map<string, SyncV2Record>();
  let cursor = 0;
  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    const response = await api.pull({ cursor });
    for (const record of response.changes) {
      recordsByKey.set(record.key, record);
    }
    cursor = response.cursor;
    if (!response.hasMore) {
      return { recordsByKey, cursor };
    }
  }
  throw new Error('Sync reconcile did not finish pulling');
}

/**
 * Deletes the previous sync engine (dexie-syncable) recorded but had not pushed yet. Without this
 * the reconcile would see "the server has it, this device does not" and bring the record back.
 */
async function getUnpushedLegacyDeletes(db: DexieDb): Promise<Set<string>> {
  const deletedKeys = new Set<string>();
  try {
    const syncNodes: Array<{ id: number; type?: string; myRevision?: number }> = await db.table('_syncNodes').toArray();
    const remoteNode = syncNodes.find(({ type }) => type === 'remote');
    if (!remoteNode) {
      return deletedKeys;
    }
    const changes: Array<{ rev: number; type: number; table: string; key: string; source?: number | null }> = await db
      .table('_changes')
      .where('rev')
      .above(remoteNode.myRevision ?? 0)
      .toArray();
    for (const { type, table, key, source } of changes) {
      if (!isSyncableEntity(table) || source === remoteNode.id) {
        continue;
      }
      // type 3 = delete. A later create/update of the same key means it was brought back locally.
      if (type === 3) {
        deletedKeys.add(key);
      } else {
        deletedKeys.delete(key);
      }
    }
  } catch (ex) {
    logger.warn('[SYNC] Unable to read changes left by the previous sync engine', ex);
  }
  return deletedKeys;
}

/**
 * Bring this device and the server back in line from scratch, without trusting any previous sync
 * state. Runs the first time the engine starts on a device, when the user resets sync, and when the
 * server reports the device's cursor is unknown.
 *
 * Per record: whichever side was edited last wins; equal edit times with different content are
 * merged; anything only this device has is queued to be sent. A local record is only ever removed
 * when the server holds an explicit, newer delete for it - never just because the server lacks it.
 */
export async function reconcileWithServer(db: DexieDb, api: SyncApi): Promise<void> {
  const previousState = await getSyncState(db);
  const { recordsByKey: serverRecordsByKey, cursor } = await pullEverything(api);
  const legacyDeletedKeys = previousState?.legacyAddonStateMigrated ? new Set<string>() : await getUnpushedLegacyDeletes(db);

  await runRemoteApplyTransaction(db, async () => {
    const pendingKeys = new Set((await db._sync_outbox.toCollection().primaryKeys()) as string[]);
    const outboxEntries: SyncOutboxEntry[] = [];
    const metaEntries: SyncMetaEntry[] = [];
    const now = new Date();
    const seenLocalKeys = new Set<string>();

    const queue = (key: string, table: SyncableEntity, op: SyncOutboxEntry['op']) => {
      outboxEntries.push({ key, table, op, nonce: uuid(), changedAt: now });
    };

    for (const entity of SYNCABLE_TABLE_NAMES) {
      const table = getSyncableTable(db, entity);
      const localRecords = await table.toArray();
      const recordsToPut: Record<string, unknown>[] = [];
      const keysToDelete: string[] = [];

      for (const localRecord of localRecords) {
        const key = localRecord.key as string;
        seenLocalKeys.add(key);
        if (pendingKeys.has(key)) {
          // Already queued - the server decides when it is pushed, with no assumption about what this device has seen
          continue;
        }
        const serverRecord = serverRecordsByKey.get(key);
        if (!serverRecord) {
          queue(key, entity, 'put');
          continue;
        }
        const localEditTime = getRecordEditTime(localRecord);
        const serverEditTime = serverRecord.clientUpdatedAt ?? new Date(0);

        if (serverRecord.deleted) {
          if (localEditTime > serverEditTime) {
            queue(key, entity, 'put');
          } else {
            keysToDelete.push(key);
          }
          metaEntries.push({ key, revision: serverRecord.revision });
          continue;
        }

        const remoteRecord = normalizeSyncedRecord(entity, key, serverRecord.data);
        metaEntries.push({ key, revision: serverRecord.revision });
        if (serverEditTime > localEditTime) {
          recordsToPut.push(remoteRecord);
        } else if (localEditTime > serverEditTime) {
          queue(key, entity, 'put');
        } else if (!isSameRecordContent(normalizeSyncedRecord(entity, key, localRecord), remoteRecord)) {
          const mergedRecord = mergeDivergedRecords(entity, normalizeSyncedRecord(entity, key, localRecord), remoteRecord);
          recordsToPut.push(normalizeSyncedRecord(entity, key, { ...mergedRecord, updatedAt: now }));
          queue(key, entity, 'put');
        }
      }

      for (const serverRecord of serverRecordsByKey.values()) {
        const { key } = serverRecord;
        if (serverRecord.entity !== entity || seenLocalKeys.has(key) || pendingKeys.has(key)) {
          continue;
        }
        metaEntries.push({ key, revision: serverRecord.revision });
        if (serverRecord.deleted) {
          continue;
        }
        if (legacyDeletedKeys.has(key)) {
          queue(key, entity, 'delete');
          continue;
        }
        recordsToPut.push(normalizeSyncedRecord(entity, key, serverRecord.data));
      }

      await table.bulkDelete(keysToDelete);
      await table.bulkPut(recordsToPut);
    }

    await db._sync_meta.bulkPut(metaEntries);
    await db._sync_outbox.bulkPut(outboxEntries);
    await db._sync_state.put({ id: SYNC_STATE_ID, cursor, lastSyncedAt: now, reconciledAt: now, legacyAddonStateMigrated: true });
  });
}

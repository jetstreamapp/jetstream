/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { logger } from '@jetstream/shared/client-logger';
import { dataSyncPullAll, dataSyncPushAllChanges, socketClient } from '@jetstream/shared/data';
import { getObjectDiffForDexie, groupByFlat } from '@jetstream/shared/utils';
import {
  LoadSavedMappingItem,
  Maybe,
  PullResponse,
  PullResponseSchema,
  QueryHistoryItem,
  RecentHistoryItem,
  SyncableRecord,
  SyncRecord,
  SyncRecordOperation,
  SyncType,
} from '@jetstream/types';
import { parseISO } from 'date-fns/parseISO';
import Dexie from 'dexie';
import type { ICreateChange, IDatabaseChange, IDeleteChange, IUpdateChange } from 'dexie-observable/api';
import { ApplyRemoteChangesFunction } from 'dexie-syncable/api';
import isString from 'lodash/isString';
import { v4 as uuid } from 'uuid';
import { dexieDb, getHashedRecordKey, SyncableEntities, SyncableTables } from './ui-db';

interface CreateOrUpdateEventBase {
  type: 'create' | 'update';
  fullRecord: SyncableRecord;
  deletedAt?: null | never;
}
interface CreateOrUpdateEventQueryHistory extends CreateOrUpdateEventBase {
  keyPrefix: (typeof SyncableTables)['query_history']['keyPrefix'];
  fullRecord: QueryHistoryItem;
}
interface CreateOrUpdateEventLoadSavedMapping extends CreateOrUpdateEventBase {
  keyPrefix: (typeof SyncableTables)['load_saved_mapping']['keyPrefix'];
  fullRecord: LoadSavedMappingItem;
}

interface CreateOrUpdateEventRecentHistoryItem extends CreateOrUpdateEventBase {
  keyPrefix: (typeof SyncableTables)['recent_history_item']['keyPrefix'];
  fullRecord: RecentHistoryItem;
}

interface CreateOrUpdateEventApiRequestHistory extends CreateOrUpdateEventBase {
  keyPrefix: (typeof SyncableTables)['api_request_history']['keyPrefix'];
  fullRecord: RecentHistoryItem;
}

type CreateOrUpdateEvent =
  | CreateOrUpdateEventQueryHistory
  | CreateOrUpdateEventLoadSavedMapping
  | CreateOrUpdateEventRecentHistoryItem
  | CreateOrUpdateEventApiRequestHistory;

interface DeleteEvent {
  type: 'delete';
  entity: SyncType;
  key: string;
  hashedKey: string;
  deletedAt: Date;
}

const CLIENT_ID = uuid();

const MAX_PUSH_SIZE = 50;
const BACKOFF_DELAY_INCREMENT_MS = 10_000; // 10 seconds
const MAX_BACKOFF_DELAY_MS = 60 * 60 * 1_000; // 1 hour
let retryCount = 0;

function getKeyPrefix(key: string): (typeof SyncableTables)[keyof typeof SyncableTables]['keyPrefix'] {
  return key.split('_')[0] as (typeof SyncableTables)[keyof typeof SyncableTables]['keyPrefix'];
}

/**
 * If we ever get some unexpected data stored, ignore it
 */
const syncableKeyPrefixes = new Set(Object.values(SyncableTables).map(({ keyPrefix }) => keyPrefix));
const filterInvalidKeyPrefixes = (key: string) => syncableKeyPrefixes.has(getKeyPrefix(key));

function transformEntityToSyncRecord(data: CreateOrUpdateEvent | DeleteEvent): SyncRecordOperation {
  if (data.type === 'delete') {
    const { type, entity, key, hashedKey, deletedAt } = data;
    return { key, hashedKey, type, entity, deletedAt, data: {} as any };
  }
  const { type, keyPrefix, fullRecord } = data;
  switch (keyPrefix) {
    case 'qh': {
      return {
        key: fullRecord.key,
        hashedKey: fullRecord.hashedKey,
        type,
        entity: 'query_history',
        orgId: fullRecord.org,
        data: fullRecord as any,
        createdAt: fullRecord.createdAt,
        updatedAt: fullRecord.updatedAt || fullRecord.lastRun,
      };
    }
    case 'lsm': {
      return {
        key: fullRecord.key,
        hashedKey: fullRecord.hashedKey,
        type,
        entity: 'load_saved_mapping',
        data: fullRecord as any,
        createdAt: fullRecord.createdAt,
        updatedAt: fullRecord.updatedAt,
      };
    }
    case 'ri': {
      return {
        key: fullRecord.key,
        hashedKey: fullRecord.hashedKey,
        type,
        entity: 'recent_history_item',
        orgId: fullRecord.org,
        data: fullRecord as any,
        createdAt: fullRecord.createdAt,
        updatedAt: fullRecord.updatedAt,
      };
    }
    case 'api': {
      return {
        key: fullRecord.key,
        hashedKey: fullRecord.hashedKey,
        type,
        entity: 'api_request_history',
        orgId: fullRecord.org,
        data: fullRecord as any,
        createdAt: fullRecord.createdAt,
        updatedAt: fullRecord.updatedAt,
      };
    }
    default: {
      throw new Error(`Unsupported key prefix type: ${keyPrefix}`);
    }
  }
}

export function initializeDexieSync(name: string) {
  /**
   * {@link https://dexie.org/docs/Syncable/Dexie.Syncable.ISyncProtocol}
   */
  Dexie.Syncable.registerSyncProtocol(name, {
    sync: async (
      context,
      url,
      options,
      /**
       * Server revision that the changes are based on. Should be used when resolving conflicts. On initial sync, this value will be null.
       */
      baseRevision,
      /**
       * Server revision that local database is in sync with already. On initial sync, this value will be null.
       * If having synced before, this will be the same value that were previously sent by the sync implementer to applyRemoteChanges().
       */
      syncedRevision,
      /**
       * Local changes to sync to remote node.
       */
      changes,
      /**
       * If true, the changes only contains a part of the changes.
       * The part might be cut in the middle of a transaction so the changes must not be applied until another request comes in from same client with partial = false.
       */
      partial,
      /**
       * Call this function whenever the response stream from the remote node contains new changes to apply.
       */
      applyRemoteChanges,
      /**
       * Call this function when you get an ack from the server that the changes has been received. Must be called no matter if changes were partial or not partial.
       */
      onChangesAccepted,
      /**
       * Call this function when all changes you got from the server have been sent to applyRemoteChanges().
       * Note that not all changes from client have to be sent or acked yet (necessarily).
       */
      onSuccess,
      /**
       * Call this function if an error occur. Provide the error object (exception or other toStringable object such as a String instance) as well as the again value that should be number of milliseconds until trying to call sync() again.
       */
      onError,
    ) => {
      /**
       * Listen to change from the server in other user sessions
       * (e.g. if user is logged in on multiple devices)
       */
      socketClient.subscribe<PullResponse>('RECORD_SYNC', async (payload) => {
        try {
          await handleServerSyncResponse(PullResponseSchema.parse(payload), applyRemoteChanges);
        } catch (ex) {
          logger.warn('[SYNC][ERROR] Failed to sync records from other client', ex);
        }
      });

      try {
        // Initial sync for application start
        await pushAndPullAllRecords(baseRevision, changes, applyRemoteChanges, onChangesAccepted);

        // Ongoing sync
        onSuccess({
          async react(changes, baseRevision, partial, onChangesAccepted) {
            await pushAndPullAllRecords(baseRevision, changes, applyRemoteChanges, onChangesAccepted);
            retryCount = 0; // Reset retry count on success
          },
          disconnect() {
            retryCount = 0; // Reset retry count on disconnect
            socketClient.unsubscribe('RECORD_SYNC');
          },
        });
      } catch (ex) {
        logger.warn('[SYNC][ERROR] Failed to sync records', ex);
        retryCount++; // Increment retry counter on error
        const backoffDelay = Math.min(BACKOFF_DELAY_INCREMENT_MS * (retryCount + 1), MAX_BACKOFF_DELAY_MS);
        logger.warn(`[SYNC][RETRY] Retrying in ${backoffDelay}ms (retryCount: ${retryCount})`);
        onError(ex, backoffDelay);
      }
    },
  });
}

async function pushAndPullAllRecords(
  syncedRevision: any,
  changes: IDatabaseChange[],
  applyRemoteChanges: ApplyRemoteChangesFunction,
  onChangesAccepted: () => void,
) {
  if (changes.length === 0) {
    /**
     * Pull all changes from server based on syncedRevision
     */
    const response = await dataSyncPullAll({ updatedAt: syncedRevision });
    onChangesAccepted();
    await handleServerSyncResponse(response, applyRemoteChanges);
  } else {
    /**
     * Push all changes to server based on revision
     * this also includes all changes from server based on syncedRevision
     */
    const pushResponse = await sendChangesToServer(changes, syncedRevision, onChangesAccepted);
    await handleServerSyncResponse(pushResponse, applyRemoteChanges);
  }
}

/**
 * Sync any changes to the server
 * Server will respond with all records after syncedRevision, which includes all the new records + any records from other sources
 */
async function sendChangesToServer(changes: IDatabaseChange[], syncedRevision: Maybe<Date>, onChangesAccepted?: () => void) {
  // static date for deletedAt records since that data point is not stored in the client
  const deletedAt = new Date();

  const existingRecordsById = await getAllSyncableRecordsById(
    changes.filter(({ table, type }) => SyncableEntities.has(table as keyof typeof SyncableTables)).map((change) => change.key),
  );

  // FIXME: this is temporary just to smooth out the data sync - remove after backfill is complete
  // Backfill hashed key as needed
  for (const obj of Object.values(existingRecordsById)) {
    if (obj.key && !obj.hashedKey) {
      obj.hashedKey = await getHashedRecordKey(obj.key);
    }
  }

  const changesByType = changes
    .filter((record) => SyncableEntities.has(record.table as keyof typeof SyncableTables))
    .reduce(
      (acc, change) => {
        if (change.type === 1) {
          acc.creates.push(change);
          acc.recordsById[change.key] = change;
        } else if (change.type === 2) {
          acc.updates.push(change);
          acc.recordsById[change.key] = change;
        } else if (change.type === 3) {
          acc.deletes.push(change);
          acc.recordsById[change.key] = change;
        }
        return acc;
      },
      {
        recordsById: {} as Record<string, IDatabaseChange>,
        creates: [] as ICreateChange[],
        updates: [] as IUpdateChange[],
        deletes: [] as IDeleteChange[],
      },
    );

  // deleted records will not show up in existing and oldObj is undefined, so we need to re calculate the hashedKey
  const keyToHashedKey: Record<string, string> = {};
  for (const { key, oldObj } of changesByType.deletes) {
    const hashedKey = existingRecordsById[key]?.hashedKey ?? oldObj?.hashedKey;
    if (!hashedKey) {
      keyToHashedKey[key] = await getHashedRecordKey(key);
    }
  }

  const pushResponse = await dataSyncPushAllChanges({
    clientId: CLIENT_ID,
    updatedAt: syncedRevision,
    records: [
      ...changesByType.creates
        .filter((obj) => filterInvalidKeyPrefixes(obj.key))
        .map(({ obj }) => transformEntityToSyncRecord({ keyPrefix: getKeyPrefix(obj.key), type: 'create', fullRecord: obj })),
      ...changesByType.updates
        .filter((obj) => filterInvalidKeyPrefixes(obj.key) && existingRecordsById[obj.key])
        .map(({ mods, key }) =>
          transformEntityToSyncRecord({
            keyPrefix: getKeyPrefix(key),
            type: 'update',
            fullRecord: existingRecordsById[key],
          }),
        ),
      ...changesByType.deletes
        .filter(({ key, oldObj }) => existingRecordsById[key]?.hashedKey ?? oldObj?.hashedKey ?? keyToHashedKey[key])
        .map(({ key, oldObj, table }) =>
          transformEntityToSyncRecord({
            entity: table as SyncType,
            type: 'delete',
            key,
            hashedKey: existingRecordsById[key]?.hashedKey ?? oldObj?.hashedKey ?? keyToHashedKey[key],
            deletedAt,
          }),
        ),
    ].filter(Boolean),
    chunkSize: MAX_PUSH_SIZE,
  });
  if (onChangesAccepted) {
    onChangesAccepted();
  }
  return pushResponse;
}

async function handleServerSyncResponse({ records, updatedAt }: PullResponse, applyRemoteChanges: ApplyRemoteChangesFunction) {
  try {
    const existingRecordsById = await getAllSyncableRecordsById(records.map(({ key }) => key));
    const serverChanges = records.map(({ entity, data, key, hashedKey, deletedAt }) => {
      data.hashedKey = data.hashedKey ?? hashedKey;
      enrichDataTypes(entity, data);

      if (deletedAt) {
        // DELETE
        return { type: 3, table: entity, key, oldObj: null } as IDeleteChange;
      } else if (existingRecordsById[key]) {
        // UPDATE
        const mods = getObjectDiffForDexie(data, existingRecordsById[key]);
        // FIXME: this is temporary - if the server modified the data, keep the server version
        // (NOTE: this likely is not needed anymore since we are backfilling the hashed key in the browser, but could happen before that migration happens)
        if ('hashedKey' in mods && !mods.hashedKey) {
          mods.hashedKey = data.hashedKey;
        }
        return { type: 2, table: entity, key, obj: data, mods, oldObj: existingRecordsById[key] } as IUpdateChange;
      } else {
        // CREATE
        return { type: 1, table: entity, key, obj: data } as ICreateChange;
      }
      // TODO: how do we handle data limits on the server?
    });
    await applyRemoteChanges(serverChanges, updatedAt, false, false);
  } catch (ex) {
    logger.warn('[SYNC][ERROR] Failed to handle response from server', ex);
  }
}

function enrichDataTypes(entity: SyncRecord['entity'], data: Record<string, unknown>) {
  enrichDataTypesForAll(data);
  switch (entity) {
    case 'query_history':
      enrichDataTypesForQueryHistory(data);
      break;
    case 'load_saved_mapping':
      enrichDataTypesForLoadMapping(data);
      break;
    case 'recent_history_item':
      enrichDataTypesForRecentHistory(data);
      break;
    case 'api_request_history':
      enrichDataTypesForApiRequestHistory(data);
      break;
    default:
      break;
  }
}

function enrichDataTypesForAll(data: Record<string, unknown>) {
  if (!data) {
    return;
  }
  if (isString(data.created)) {
    data.createdAt = parseISO(data.created);
  }
  if (isString(data.updatedAt)) {
    data.updatedAt = parseISO(data.updatedAt);
  }
}

function enrichDataTypesForQueryHistory(data: Record<string, unknown>) {
  if (isString(data.lastRun)) {
    data.lastRun = parseISO(data.lastRun);
  }
}

function enrichDataTypesForLoadMapping(data: Record<string, unknown>) {
  // nothing to do here
}

function enrichDataTypesForRecentHistory(data: Record<string, unknown>) {
  if (Array.isArray(data.items)) {
    data.items.forEach((item) => {
      if (isString(item.lastUsed)) {
        item.lastUsedAt = parseISO(item.lastUsed);
      }
    });
  }
}

function enrichDataTypesForApiRequestHistory(data: Record<string, unknown>) {
  if (isString(data.lastRun)) {
    data.lastRun = parseISO(data.lastRun);
  }
}
/**
 * Given a list of id's, fetch all records from dexie
 * Since ids have a prefix, that is used to know what tables to fetch from
 */
async function getAllSyncableRecordsById(ids: string[]): Promise<Record<string, any>> {
  const records = await Promise.all(
    Object.values(SyncableTables).map((syncableTable) => {
      const keys = ids.filter((id) => id.startsWith(syncableTable.keyPrefix)) as (typeof syncableTable)['keyPrefix'][];
      if (keys.length) {
        return dexieDb[syncableTable.name].bulkGet(keys as any).then((records) => records.filter(Boolean));
      }
      return Promise.resolve([]);
    }),
  ).then((records) => records.flat().filter(Boolean));

  return groupByFlat(records as SyncableRecord[], 'key');
}

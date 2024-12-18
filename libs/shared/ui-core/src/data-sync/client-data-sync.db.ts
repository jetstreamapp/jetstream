import { logger } from '@jetstream/shared/client-logger';
import { dataSyncPullAll, dataSyncPushAllChanges, getDataSyncEventSource } from '@jetstream/shared/data';
import { groupByFlat } from '@jetstream/shared/utils';
import { Maybe, PullResponse, PullResponseSchema, QueryHistoryItem, SyncRecordOperation, SyncType } from '@jetstream/types';
import { parseISO } from 'date-fns';
import Dexie from 'dexie';
import type { ICreateChange, IDatabaseChange, IDeleteChange, IUpdateChange } from 'dexie-observable/api';
import { ApplyRemoteChangesFunction } from 'dexie-syncable/api';
import isString from 'lodash/isString';
import { v4 as uuid } from 'uuid';
import { dexieDb } from './client-data.db';

interface CreateOrUpdateEvent {
  type: 'create' | 'update';
  entity: SyncType;
  fullRecord: QueryHistoryItem;
  deletedAt?: null | never;
}

interface DeleteEvent {
  type: 'delete';
  entity: SyncType;
  key: string;
  deletedAt: Date;
}

const CLIENT_ID = uuid();

const MAX_PUSH_SIZE = 25;
const POLL_INTERVAL_MS = 10_000; // Poll every 10 seconds

const transformFunctions = {
  query_history: {
    entityToSyncRecord: (data: CreateOrUpdateEvent | DeleteEvent): SyncRecordOperation => {
      if (data.type === 'delete') {
        const { type, entity, key, deletedAt } = data;
        return { key, type, entity, deletedAt };
      }
      const { type, entity, fullRecord } = data;
      return {
        key: fullRecord.key,
        type,
        entity,
        orgId: fullRecord.org,
        data: fullRecord as any,
        createdAt: fullRecord.created,
        updatedAt: fullRecord.updatedAt || fullRecord.lastRun,
      };
    },
  },
};

export function initSync() {
  /**
   * FIXME: we need this to work for all entities, it is hard-coded to work for query_history only
   * the server could handle all entities at once, that would be most compatible with dexie.syncable
   *
   * TODO: we are not using mods in the response how dexie is expecting
   * on updates, we probably need to calculate the diff and set the object just to the mods - might not be a big deal though
   */

  Dexie.Syncable.registerSyncProtocol('jetstream-sync', {
    sync: async (
      context,
      url,
      options,
      baseRevision,
      syncedRevision,
      changes,
      partial,
      applyRemoteChanges,
      onChangesAccepted,
      onSuccess,
      onError
    ) => {
      /**
       * TODO:
       * - We need to handle all entities, not just query_history
       */

      try {
        const eventSource = getDataSyncEventSource(CLIENT_ID);
        eventSource.onmessage = async (event: MessageEvent<string>) => {
          try {
            await handleServerSyncResponse(PullResponseSchema.parse(JSON.parse(event.data)), applyRemoteChanges);
          } catch (ex) {
            logger.warn('[SYNC][ERROR] Failed to sync records', ex);
          }
        };

        // Initial sync
        if (changes.length === 0) {
          const response = await dataSyncPullAll({ updatedAt: syncedRevision });
          onChangesAccepted();
          handleServerSyncResponse(response, applyRemoteChanges);
        } else {
          const pushResponse = await sendChangesToServer(changes, syncedRevision, onChangesAccepted);
          await handleServerSyncResponse(pushResponse, applyRemoteChanges);
        }

        onSuccess({
          react: async function (changes, baseRevision, partial, onChangesAccepted) {
            if (changes.length === 0) {
              const response = await dataSyncPullAll({ updatedAt: syncedRevision });
              onChangesAccepted();
              handleServerSyncResponse(response, applyRemoteChanges);
            } else {
              const pushResponse = await sendChangesToServer(changes, syncedRevision, onChangesAccepted);
              await handleServerSyncResponse(pushResponse, applyRemoteChanges);
            }
          },
          disconnect: function () {
            eventSource.close();
          },
        });
      } catch (ex) {
        logger.warn('[SYNC][ERROR] Failed to sync records', ex);
        // TODO: should we give up syncing?
        onError(ex, POLL_INTERVAL_MS); // TODO: what about second property - should be use it?
      }
    },
  });
}

/**
 * Sync any changes to the server
 * Server will respond with all records after syncedRevision, which includes all the new records + any records from other sources
 */
async function sendChangesToServer(changes: IDatabaseChange[], syncedRevision: Maybe<Date>, onChangesAccepted: () => void) {
  // static date for deletedAt records since that data point is not stored in the client
  const deletedAt = new Date();

  // FIXME: handle other tables here as well
  const existingRecordsById = await getQueryHistoryById(
    changes.filter(({ table, type }) => table === 'query_history').map((change) => change.key)
  );

  const changesByType = changes
    .filter((record) => record.table === 'query_history') // FIXME: handle other tables here as well
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
      }
    );

  const pushResponse = await dataSyncPushAllChanges({
    clientId: CLIENT_ID,
    updatedAt: syncedRevision,
    records: [
      // FIXME: handle other tables here as well
      ...changesByType.creates.map(({ obj }) =>
        transformFunctions.query_history.entityToSyncRecord({ entity: 'query_history', type: 'create', fullRecord: obj })
      ),
      ...changesByType.updates.map(({ mods, key }) =>
        transformFunctions.query_history.entityToSyncRecord({
          entity: 'query_history',
          type: 'update',
          fullRecord: existingRecordsById[key],
        })
      ),
      ...changesByType.deletes.map(({ key }) =>
        transformFunctions.query_history.entityToSyncRecord({
          entity: 'query_history',
          type: 'delete',
          key,
          deletedAt,
        })
      ),
    ],
    chunkSize: MAX_PUSH_SIZE,
  });
  onChangesAccepted();
  return pushResponse;
}

async function handleServerSyncResponse({ records, updatedAt }: PullResponse, applyRemoteChanges: ApplyRemoteChangesFunction) {
  try {
    const existingRecordsById = await getQueryHistoryById(records.map(({ key }) => key));
    const serverChanges = records.map(({ data, key, deletedAt }) => {
      if (isString(data.created)) {
        data.created = parseISO(data.created);
      }
      if (isString(data.lastRun)) {
        data.lastRun = parseISO(data.lastRun);
      }
      if (isString(data.updatedAt)) {
        data.updatedAt = parseISO(data.updatedAt);
      }

      if (deletedAt) {
        return {
          type: 3,
          table: 'query_history',
          key,
          oldObj: null,
        } as IDeleteChange;
      } else if (existingRecordsById[key]) {
        return {
          type: 2,
          table: 'query_history',
          key,
          obj: data,
          mods: data, // TODO: we could calculate this by checking the diff between the two objects
          oldObj: existingRecordsById[key],
        } as IUpdateChange;
      } else {
        return {
          type: 1,
          table: 'query_history',
          key,
          obj: data,
        } as ICreateChange;
      }
      // TODO: how do we handle data limits on the server?
    });
    await applyRemoteChanges(serverChanges, updatedAt, false, false);
  } catch (ex) {
    logger.warn('[SYNC][ERROR] Failed to sync records', ex);
  }
}

// FIXME: we need to do this for all sync tables
async function getQueryHistoryById(ids: string[]) {
  const existingRecordsById: Record<string, QueryHistoryItem> = {};
  groupByFlat(
    await dexieDb.query_history.bulkGet(ids).then((records) => records.filter(Boolean) as QueryHistoryItem[]),
    'key',
    existingRecordsById
  );
  return existingRecordsById;
}

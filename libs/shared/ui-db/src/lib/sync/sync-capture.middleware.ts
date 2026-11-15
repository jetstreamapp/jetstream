import type { DBCore, DBCoreMutateRequest, DBCoreMutateResponse, DBCoreTable, DBCoreTransaction, Middleware } from 'dexie';
import { v4 as uuid } from 'uuid';
import { SYNC_OUTBOX_TABLE, SyncableEntities, SyncableEntity, SyncOutboxEntry } from '../ui-db';

/**
 * Transactions that are applying changes received from the server. Their writes must not be queued
 * to be sent straight back.
 */
const remoteTransactions = new WeakSet<object>();

export function markTransactionAsRemote(idbTransaction: IDBTransaction) {
  remoteTransactions.add(idbTransaction);
}

function isSyncableTable(tableName: string): tableName is SyncableEntity {
  return SyncableEntities.has(tableName as SyncableEntity);
}

/**
 * Primary keys written by an add/put, skipping rows the database refused (a caught bulk error must
 * not leave an outbox entry for a record that was never stored).
 */
function getWrittenKeys(
  table: DBCoreTable,
  values: readonly unknown[],
  keys: readonly unknown[] | undefined,
  response: DBCoreMutateResponse,
) {
  const writtenKeys: string[] = [];
  values.forEach((value, i) => {
    if (response.failures[i]) {
      return;
    }
    const key = keys?.[i] ?? table.schema.primaryKey.extractKey?.(value);
    if (typeof key === 'string') {
      writtenKeys.push(key);
    }
  });
  return writtenKeys;
}

/**
 * Records every local write to a syncable table in the outbox, inside the same IndexedDB transaction
 * as the write itself - a change and the note to sync it are committed (or rolled back) together,
 * from every tab and through every Dexie api (`put`, `update`, `modify`, `delete`, `clear`, ...).
 *
 * DBCore is the layer all of those funnel into, which is why this is a middleware rather than table
 * hooks: a hook cannot add the outbox store to a transaction that was opened without it.
 *
 * Only promise chains are used here (no async/await): Dexie tracks the active transaction through
 * its own promise implementation and a native await would escape it.
 */
export function createSyncCaptureMiddleware(onLocalChange: () => void): Middleware<DBCore> {
  return {
    stack: 'dbcore',
    name: 'jetstreamSyncCapture',
    create(downCore) {
      // Dexie also builds this stack against the database as it is on disk BEFORE a schema upgrade
      // runs. A database that has not been upgraded yet has no outbox store, and asking for it throws,
      // which would fail the very upgrade that creates it - so there is nothing to capture into yet.
      const hasOutbox = downCore.schema.tables.some(({ name }) => name === SYNC_OUTBOX_TABLE);
      if (!hasOutbox) {
        return downCore;
      }
      return {
        ...downCore,
        transaction(stores, mode, options) {
          const needsOutbox = mode === 'readwrite' && stores.some(isSyncableTable) && !stores.includes(SYNC_OUTBOX_TABLE);
          return downCore.transaction(needsOutbox ? [...stores, SYNC_OUTBOX_TABLE] : stores, mode, options);
        },
        table(tableName) {
          const downTable = downCore.table(tableName);
          if (!isSyncableTable(tableName)) {
            return downTable;
          }
          const outboxTable = downCore.table(SYNC_OUTBOX_TABLE);

          const recordChanges = (trans: DBCoreTransaction, op: SyncOutboxEntry['op'], keys: string[], response: DBCoreMutateResponse) => {
            if (keys.length === 0) {
              return response;
            }
            const changedAt = new Date();
            const values: SyncOutboxEntry[] = keys.map((key) => ({ key, table: tableName, op, nonce: uuid(), changedAt }));
            return outboxTable.mutate({ trans, type: 'put', values }).then(() => {
              onLocalChange();
              return response;
            });
          };

          return {
            ...downTable,
            mutate(req: DBCoreMutateRequest): Promise<DBCoreMutateResponse> {
              if (remoteTransactions.has(req.trans)) {
                return downTable.mutate(req);
              }
              switch (req.type) {
                case 'add':
                case 'put': {
                  return downTable
                    .mutate(req)
                    .then((response) =>
                      recordChanges(req.trans, 'put', getWrittenKeys(downTable, req.values, req.keys, response), response),
                    );
                }
                case 'delete': {
                  const keys = req.keys.filter((key): key is string => typeof key === 'string');
                  return downTable.mutate(req).then((response) => recordChanges(req.trans, 'delete', keys, response));
                }
                case 'deleteRange': {
                  // The range says nothing about which records it covers, so read their keys before they are gone
                  return downTable
                    .query({ trans: req.trans, values: false, query: { index: downTable.schema.primaryKey, range: req.range } })
                    .then(({ result }) => {
                      const keys = result.filter((key): key is string => typeof key === 'string');
                      return downTable.mutate(req).then((response) => recordChanges(req.trans, 'delete', keys, response));
                    });
                }
                default: {
                  return downTable.mutate(req);
                }
              }
            },
          };
        },
      };
    },
  };
}

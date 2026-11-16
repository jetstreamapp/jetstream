import { logger } from '@jetstream/shared/client-logger';
import {
  MAX_SYNC_KEY_LENGTH,
  MAX_SYNC_PUSH_LENGTH,
  MAX_SYNC_RECORD_DATA_LENGTH,
  MAX_SYNC_RECORDS_PER_PUSH,
  SyncV2Op,
  SyncV2Record,
  SyncV2Response,
} from '@jetstream/types';
import { DexieDb, SYNC_STATE_ID, SyncOutboxEntry } from '../ui-db';
import { getRecordEditTime, normalizeSyncedRecord } from './sync-normalize';
import { reconcileWithServer } from './sync-reconcile';
import { getSyncableTable, getSyncState, isSyncableEntity, runRemoteApplyTransaction, SyncApi, withSyncLock } from './sync-store';

const LOCAL_CHANGE_DEBOUNCE_MS = 750;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60 * 1_000;
/** The server refused the user outright (signed out, or history sync not allowed) - retrying soon cannot help */
const BACKOFF_REFUSED_MS = 15 * 60 * 1_000;
/** Stay well under the server's request cap, which is measured after the request has been wrapped */
const PUSH_SIZE_BUDGET = MAX_SYNC_PUSH_LENGTH * 0.8;
/** Bounds one cycle so a server that never stops reporting more pages cannot spin forever */
const MAX_ROUNDS_PER_CYCLE = 500;

function isRefusedByServer(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 401 || status === 403;
}

/**
 * Keeps one local database and the server in line.
 *
 * - Local changes are queued in `_sync_outbox` by the capture middleware, in the same transaction
 *   as the change, and sent in batches. An entry leaves the outbox only when the server has answered
 *   for that exact change.
 * - Server changes are pulled from this device's own cursor (the last server revision it applied).
 *   Notifications from the server only ever *trigger* a pull, so one that is missed, duplicated or
 *   out of order cannot lose or skip data.
 * - Applying a response and moving the cursor are one transaction.
 *
 * An engine is bound to the database instance it was created with and never looks up "the current
 * database", so a response that arrives after the user changed cannot be applied to another account.
 */
export class SyncEngine {
  private stopped = false;
  private activeCycle: Promise<void> | null = null;
  private rerunRequested = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failureCount = 0;
  private retryNotBefore = 0;
  private readonly lockName: string;

  constructor(
    private readonly db: DexieDb,
    private readonly api: SyncApi,
  ) {
    this.lockName = `jetstream-history-sync:${db.name}`;
  }

  /**
   * Sync soon. Repeated calls collapse into one cycle. A retry back-off is not cut short unless
   * `ignoreBackoff` is set, which is for syncs the user is visibly waiting on.
   */
  requestSync(delayMs = LOCAL_CHANGE_DEBOUNCE_MS, { ignoreBackoff = false } = {}) {
    if (this.stopped) {
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const delay = ignoreBackoff ? delayMs : Math.max(delayMs, this.retryNotBefore - Date.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      this.syncNow().catch(() => undefined);
    }, delay);
  }

  /** The server announced a change - nothing to do if this device already has that revision */
  async handlePoke(revision: number) {
    if (this.stopped) {
      return;
    }
    try {
      const state = await getSyncState(this.db);
      if (state?.reconciledAt && state.cursor >= revision) {
        return;
      }
    } catch (ex) {
      logger.warn('[SYNC] Unable to read sync state', ex);
    }
    this.requestSync(0);
  }

  /**
   * Run a full cycle now and resolve when it has finished. Never rejects: a failure is logged and
   * retried later with back-off.
   */
  async syncNow(): Promise<void> {
    if (this.stopped) {
      return;
    }
    if (this.activeCycle) {
      // Something may have changed after the running cycle read it - go around again once it is done
      this.rerunRequested = true;
      return await this.activeCycle;
    }
    this.activeCycle = this.runCycles().finally(() => {
      this.activeCycle = null;
    });
    return await this.activeCycle;
  }

  /**
   * Forget everything this device believes about the server and reconcile from scratch.
   * Unlike background syncs this rejects on failure, since it is something the user asked for.
   */
  async reset(): Promise<void> {
    await this.clearState();
    this.failureCount = 0;
    this.retryNotBefore = 0;
    await this.syncNow();
    if (this.failureCount > 0) {
      throw new Error('Unable to sync with the server');
    }
  }

  /** Drop the cursor and known revisions (queued local changes are kept) so the next sync reconciles from scratch */
  async clearState(): Promise<void> {
    await withSyncLock(this.lockName, () => this.clearSyncState());
  }

  stop() {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async clearSyncState() {
    await this.db.transaction('rw', this.db._sync_meta, this.db._sync_state, async () => {
      const state = await getSyncState(this.db);
      await this.db._sync_meta.clear();
      await this.db._sync_state.put({
        id: SYNC_STATE_ID,
        cursor: 0,
        lastSyncedAt: state?.lastSyncedAt ?? null,
        reconciledAt: null,
        legacyAddonStateMigrated: state?.legacyAddonStateMigrated,
      });
    });
  }

  private async runCycles() {
    do {
      this.rerunRequested = false;
      try {
        await withSyncLock(this.lockName, () => this.runCycle());
        this.failureCount = 0;
        this.retryNotBefore = 0;
      } catch (ex) {
        if (this.stopped) {
          return;
        }
        this.failureCount++;
        const backoff = isRefusedByServer(ex)
          ? BACKOFF_REFUSED_MS
          : Math.min(BACKOFF_BASE_MS * 2 ** (this.failureCount - 1), BACKOFF_MAX_MS) * (0.5 + Math.random() / 2);
        this.retryNotBefore = Date.now() + backoff;
        logger.warn(`[SYNC] Sync failed, retrying in ${Math.round(backoff / 1000)}s`, ex);
        this.requestSync(backoff);
        return;
      }
    } while (this.rerunRequested && !this.stopped);
  }

  private async runCycle() {
    // Every cycle pulls at least once, so a cycle with nothing to send still catches up on remote changes
    let needsPull = true;
    for (let round = 0; round < MAX_ROUNDS_PER_CYCLE; round++) {
      if (this.stopped) {
        return;
      }
      const state = await getSyncState(this.db);
      if (!state?.reconciledAt) {
        logger.info('[SYNC] Reconciling local history with the server');
        await reconcileWithServer(this.db, this.api);
        needsPull = false;
        continue;
      }

      const { entries, ops } = await this.buildBatch();
      if (entries.length === 0 && !needsPull) {
        return;
      }
      const response =
        entries.length > 0 ? await this.api.sync({ cursor: state.cursor, ops }) : await this.api.pull({ cursor: state.cursor });
      logger.info('[SYNC]', { sent: entries.length, received: response.changes.length, cursor: response.cursor });
      if (this.stopped) {
        return;
      }
      if (response.resetRequired) {
        await this.clearSyncState();
        continue;
      }
      await this.applyResponse(response, entries);
      needsPull = response.hasMore;
    }
    throw new Error('Sync did not settle');
  }

  /** Entries the server has ruled can never be accepted stay queued (so the record is not overwritten) but are not re-sent */
  private async getPendingEntries(): Promise<SyncOutboxEntry[]> {
    const entries = await this.db._sync_outbox
      .filter(({ error }) => !error)
      .limit(MAX_SYNC_RECORDS_PER_PUSH)
      .toArray();
    return entries.filter(({ table }) => isSyncableEntity(table));
  }

  /**
   * The next batch to send: as many pending changes as fit in one request. The server rejects a
   * request that is too large as a whole, so a batch that could never fit would be retried forever
   * and block everything behind it - including pulling.
   */
  private async buildBatch(): Promise<{ entries: SyncOutboxEntry[]; ops: SyncV2Op[] }> {
    const pendingEntries = await this.getPendingEntries();
    const pendingOps = await this.buildOps(pendingEntries);
    const entries: SyncOutboxEntry[] = [];
    const ops: SyncV2Op[] = [];
    let batchSize = 0;
    for (let i = 0; i < pendingOps.length; i++) {
      const op = pendingOps[i];
      const dataSize = op.type === 'put' ? JSON.stringify(op.data).length : 0;
      if (op.key.length > MAX_SYNC_KEY_LENGTH || dataSize > MAX_SYNC_RECORD_DATA_LENGTH) {
        // Larger than the server accepts for one record - set it aside without spending a request on it
        await this.db._sync_outbox
          .where({ key: op.key })
          .and(({ nonce }) => nonce === pendingEntries[i].nonce)
          .modify({ error: 'Record is too large to sync' });
        continue;
      }
      const opSize = dataSize + op.key.length + 256;
      if (ops.length > 0 && batchSize + opSize > PUSH_SIZE_BUDGET) {
        break;
      }
      batchSize += opSize;
      entries.push(pendingEntries[i]);
      ops.push(op);
    }
    return { entries, ops };
  }

  private async buildOps(entries: SyncOutboxEntry[]): Promise<SyncV2Op[]> {
    const metaEntries = await this.db._sync_meta.bulkGet(entries.map(({ key }) => key));
    return await Promise.all(
      entries.map(async ({ key, table, op, changedAt }, i): Promise<SyncV2Op> => {
        // A record edited on top of the revision the server still holds is accepted without comparing clocks
        const baseRevision = metaEntries[i]?.revision ?? null;
        const record = op === 'put' ? await getSyncableTable(this.db, table).get(key) : undefined;
        if (!record) {
          return { type: 'delete', key, entity: table, clientUpdatedAt: changedAt, baseRevision };
        }
        return {
          type: 'put',
          key,
          entity: table,
          orgId: typeof record.org === 'string' ? record.org : null,
          data: record,
          clientUpdatedAt: getRecordEditTime(record),
          baseRevision,
        };
      }),
    );
  }

  private async applyResponse(response: SyncV2Response, sentEntries: SyncOutboxEntry[]) {
    await runRemoteApplyTransaction(this.db, async () => {
      const { db } = this;
      const currentEntries = await db._sync_outbox.bulkGet(sentEntries.map(({ key }) => key));
      const recordsToApply: SyncV2Record[] = [];

      for (let i = 0; i < sentEntries.length; i++) {
        const sentEntry = sentEntries[i];
        const result = response.results[i];
        // The record was edited again while the request was in flight - that newer edit is still owed to the server
        const isUnchangedSinceSent = currentEntries[i]?.nonce === sentEntry.nonce;
        if (!result) {
          continue;
        }
        switch (result.status) {
          case 'accepted': {
            await db._sync_meta.put({ key: sentEntry.key, revision: result.revision });
            if (isUnchangedSinceSent) {
              await db._sync_outbox.delete(sentEntry.key);
            }
            break;
          }
          case 'rejected': {
            if (isUnchangedSinceSent) {
              await db._sync_outbox.delete(sentEntry.key);
              recordsToApply.push(result.record);
            }
            break;
          }
          case 'invalid': {
            logger.warn('[SYNC] Server cannot accept record', sentEntry.key, result.message);
            if (isUnchangedSinceSent) {
              await db._sync_outbox.update(sentEntry.key, { error: result.message });
            }
            break;
          }
        }
      }

      recordsToApply.push(...response.changes);
      await this.applyRemoteRecords(recordsToApply);

      await db._sync_state.update(SYNC_STATE_ID, { cursor: response.cursor, lastSyncedAt: new Date() });
    });
  }

  private async applyRemoteRecords(records: SyncV2Record[]) {
    const { db } = this;
    for (const record of records) {
      const { key, entity, revision, deleted, data } = record;
      if (!isSyncableEntity(entity)) {
        // Written by a newer client - nothing this build knows how to store
        continue;
      }
      const knownRevision = (await db._sync_meta.get(key))?.revision;
      if (knownRevision !== undefined && knownRevision >= revision) {
        continue;
      }
      if (await db._sync_outbox.get(key)) {
        // This device has its own unsent change to the record. Leave both the record and its known
        // revision alone: when that change is pushed the server sees it was not based on this
        // revision and settles the conflict.
        continue;
      }
      const table = getSyncableTable(db, entity);
      if (deleted) {
        await table.delete(key);
      } else {
        await table.put(normalizeSyncedRecord(entity, key, data));
      }
      await db._sync_meta.put({ key, revision });
    }
  }
}

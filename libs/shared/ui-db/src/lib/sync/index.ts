import { logger } from '@jetstream/shared/client-logger';
import { dataSyncV2Pull, dataSyncV2Sync, socketClient } from '@jetstream/shared/data';
import { SyncV2PokeSchema } from '@jetstream/types';
import { DexieDb, getDexieDb } from '../ui-db';
import { SyncEngine } from './sync-engine';

export { createSyncCaptureMiddleware } from './sync-capture.middleware';
export { SyncEngine } from './sync-engine';

/** Safety net for anything the event triggers below miss (e.g. a socket that never connected) */
const PERIODIC_SYNC_INTERVAL_MS = 10 * 60 * 1_000;
/** Returning to a tab only triggers a sync if it has been at least this long since the last trigger */
const VISIBILITY_SYNC_MIN_INTERVAL_MS = 60 * 1_000;

let activeEngine: SyncEngine | null = null;
let stopListening: (() => void) | null = null;

function startListening(engine: SyncEngine) {
  let lastTriggeredAt = Date.now();
  const syncNow = () => {
    lastTriggeredAt = Date.now();
    engine.requestSync(0);
  };
  const onPoke = (payload: unknown) => {
    const poke = SyncV2PokeSchema.safeParse(payload);
    if (poke.success) {
      engine.handlePoke(poke.data.revision).catch(() => undefined);
    } else {
      syncNow();
    }
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastTriggeredAt > VISIBILITY_SYNC_MIN_INTERVAL_MS) {
      syncNow();
    }
  };

  socketClient.subscribe('DATA_SYNC_POKE', onPoke);
  // Anything announced while the socket was down was missed, so catch up every time it (re)connects
  socketClient.onConnect(syncNow);
  globalThis.addEventListener?.('online', syncNow);
  globalThis.document?.addEventListener('visibilitychange', onVisibilityChange);
  const interval = setInterval(syncNow, PERIODIC_SYNC_INTERVAL_MS);

  return () => {
    socketClient.unsubscribe('DATA_SYNC_POKE', onPoke);
    socketClient.offConnect(syncNow);
    globalThis.removeEventListener?.('online', syncNow);
    globalThis.document?.removeEventListener('visibilitychange', onVisibilityChange);
    clearInterval(interval);
  };
}

/**
 * History sync for the active per-user database. Local changes are always recorded (see the capture
 * middleware registered in `db-hooks`), whether or not sync is running, so turning sync on later
 * sends everything that happened in the meantime.
 */
export const dataSync = {
  start(db: DexieDb) {
    if (activeEngine) {
      dataSync.stop();
    }
    activeEngine = new SyncEngine(db, { sync: dataSyncV2Sync, pull: dataSyncV2Pull });
    stopListening = startListening(activeEngine);
    activeEngine.requestSync(0);
  },
  stop() {
    activeEngine?.stop();
    activeEngine = null;
    stopListening?.();
    stopListening = null;
  },
  isRunning() {
    return !!activeEngine;
  },
  /**
   * The user just opened something that shows synced history - make sure it is current, even if a
   * previous attempt failed and the engine is waiting to retry. No-op when sync is off.
   */
  syncNow() {
    activeEngine?.requestSync(0, { ignoreBackoff: true });
  },
  /** A syncable record changed locally */
  notifyLocalChange() {
    activeEngine?.requestSync();
  },
  /**
   * Discard this device's sync state and reconcile with the server from scratch. With sync turned
   * off only the state is discarded, so the reconcile happens whenever sync is next enabled.
   */
  async reset() {
    if (activeEngine) {
      await activeEngine.reset();
      return;
    }
    logger.info('[SYNC] Sync is not running - clearing sync state only');
    await new SyncEngine(getDexieDb(), { sync: dataSyncV2Sync, pull: dataSyncV2Pull }).clearState();
  },
};

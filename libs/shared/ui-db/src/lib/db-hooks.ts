import { QueryHistoryItem } from '@jetstream/types';
import { saveQueryHistoryObject } from './query-history-object.db';
import type { DexieDb } from './ui-db';

/**
 * Table hooks applied to the active per-user database, passed to `createDexieInstance`.
 *
 * These live here rather than in `ui-db.ts` so that module stays free of feature-module imports
 * (it is the base every `*.db.ts` module imports from), and rather than as module-level side
 * effects — the database is now created per user, so hooks must be registered per instance.
 */
export function registerDbHooks(db: DexieDb) {
  /**
   * Boolean fields cannot be indexes, so we store a string version of the same field
   */
  db.query_history.hook('updating', function (mods) {
    if ('isFavorite' in mods) {
      return { ...mods, isFavoriteIdx: (mods as Partial<QueryHistoryItem>).isFavorite ? 'true' : 'false' };
    }
    return undefined;
  });

  /**
   * Save object mapping for query history — used on the query history modal to show the list of objects
   */
  db.query_history.hook('creating', function (_, obj) {
    obj.isFavoriteIdx = obj.isFavorite ? 'true' : 'false';
    this.onsuccess = function () {
      // Defer out of the current transaction — writing _query_history_object inline consistently fails.
      // The object being created is already in hand, so use it directly rather than re-reading it by key,
      // and write through the instance the hook was registered on: the active database may have been
      // swapped by the time this runs (logout / account switch).
      setTimeout(() => {
        saveQueryHistoryObject(db, obj);
      });
    };
  });
}

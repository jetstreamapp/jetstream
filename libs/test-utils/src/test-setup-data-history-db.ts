import { createDexieInstance, registerDbHooks, setDexieDbInstance } from '@jetstream/ui/db';

/**
 * Vitest setup for specs that exercise Data History capture wiring.
 *
 * The local database is created per authenticated user at login, so there is no module-level
 * instance for a spec to reach for. Bind one directly rather than going through `initDexieDb`,
 * which additionally drives the adopt-once legacy migration and record sync — neither of which
 * these specs exercise. The real hooks are registered so derived index fields (`pinnedIdx`,
 * `isFavoriteIdx`) behave exactly as they do in the app.
 *
 * Requires `test-setup-indexeddb.ts` to be listed BEFORE this file in `setupFiles` — creating a
 * Dexie instance is what pins `Dexie.dependencies.indexedDB`, so the fake must already be installed.
 */
setDexieDbInstance(createDexieInstance('jetstream-spec', registerDbHooks));

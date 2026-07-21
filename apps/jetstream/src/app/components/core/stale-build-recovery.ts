import { logger } from '@jetstream/shared/client-logger';
import { setItemInSessionStorage, tracker } from '@jetstream/shared/ui-utils';
import { BehaviorSubject } from 'rxjs';

const RELOAD_MARKER_KEY = 'jetstream-stale-build-reloaded-at';
const RELOAD_COOLDOWN_MS = 60_000;

// Typed locally because tsconfig.app.json overrides `types` and drops vite/client's global event map
interface VitePreloadErrorEvent extends Event {
  payload: Error;
}

const staleBuildDetected = new BehaviorSubject(false);

/**
 * Emits once a dynamic import has failed, which _may_ mean the running build no longer matches the
 * server. A failed import is not proof of a deploy - a dropped connection looks identical - so
 * AppInitializer confirms with a heartbeat before telling the user an update is available.
 */
export const staleBuildDetected$ = staleBuildDetected.asObservable();

/**
 * Single owner of the reload-to-recover policy: one marker key, one cooldown, one place to tune it.
 */
function isWithinReloadCooldown(): boolean {
  try {
    const lastReloadedAt = Number(window.sessionStorage.getItem(RELOAD_MARKER_KEY) || 0);
    return Date.now() - lastReloadedAt < RELOAD_COOLDOWN_MS;
  } catch (ex) {
    // Without sessionStorage the marker cannot be persisted, so reloading could loop forever
    logger.error('[STALE-BUILD] Unable to read sessionStorage, treating as within cooldown', ex);
    return true;
  }
}

/**
 * Recover from a chunk the running build can no longer fetch, for the only case where the user is
 * actually blocked by it: a route that cannot render without it. Each deploy replaces every hashed
 * chunk, so a tab running an older build 404s on a lazy load; the /app shell is served no-store, so
 * one reload always lands on a build whose chunk references are valid.
 *
 * Never reloads while offline - the shell is never served from the service worker cache, so a reload
 * without a network yields a dead page and throws away everything in memory. Reloads at most once
 * per cooldown so a persistently failing chunk cannot cause a reload loop.
 *
 * Returns whether a reload was started; when it was not, the caller must surface the original error.
 */
export function reloadForStaleBuild(error: unknown): boolean {
  staleBuildDetected.next(true);

  if (!navigator.onLine) {
    logger.error('[STALE-BUILD] Dynamic import failed while offline, skipping reload', error);
    return false;
  }
  if (isWithinReloadCooldown()) {
    logger.error('[STALE-BUILD] Dynamic import failed again shortly after a reload, skipping reload', error);
    return false;
  }

  tracker.error('Dynamic import failed, reloading to recover', error);
  setItemInSessionStorage(RELOAD_MARKER_KEY, String(Date.now()));
  window.location.reload();
  return true;
}

/**
 * Vite dispatches `vite:preloadError` for every failed dynamic import, including ones nothing is
 * waiting on: AppRoutes' speculative `preload()` calls and monaco-loader's boot-time
 * `import('@jetstream/monaco')`, both of which already degrade gracefully on their own. Reloading
 * the page out from under someone for one of those would interrupt in-flight work (data loads,
 * deployments) for no benefit, so this only records the signal and lets the error propagate to the
 * handler that owns it. The header update notification then lets the user refresh when it suits
 * them. Blocked route loads reload directly via `reloadForStaleBuild` (see LazyLoad).
 */
window.addEventListener('vite:preloadError', (event) => {
  logger.error('[STALE-BUILD] Dynamic import failed', (event as VitePreloadErrorEvent).payload);
  staleBuildDetected.next(true);
});

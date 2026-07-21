import { logger } from '@jetstream/shared/client-logger';
import { setItemInSessionStorage, tracker } from '@jetstream/shared/ui-utils';

const RELOADED_AT_KEY = 'vite-preload-error-reloaded-at';
const RELOAD_COOLDOWN_MS = 60_000;

// Typed locally because tsconfig.app.json overrides `types` and drops vite/client's global event map
interface VitePreloadErrorEvent extends Event {
  payload: Error;
}

/**
 * Global recovery for failed dynamic imports ("Failed to fetch dynamically imported module").
 *
 * Each deploy replaces every hashed chunk on the server, so a tab still running an older build gets a 404
 * when it lazy-loads a chunk it has not fetched yet. Vite dispatches `vite:preloadError` for every failed
 * dynamic import — including ones the LazyLoad route retry does not cover, such as monaco-loader's
 * `import('@jetstream/monaco')`. The /app shell is served with no-store, so one reload always picks up a
 * build whose chunk references are valid.
 *
 * If a reload already happened within the cooldown the event is left alone, letting the error propagate to
 * the existing handlers (LazyLoad retry, monaco-loader catch, ErrorBoundary) so a persistent failure cannot
 * cause a reload loop.
 */
window.addEventListener('vite:preloadError', (event) => {
  const { payload } = event as VitePreloadErrorEvent;
  let lastReloadedAt = 0;
  try {
    lastReloadedAt = Number(window.sessionStorage.getItem(RELOADED_AT_KEY) || 0);
  } catch (ex) {
    logger.error('[PRELOAD-ERROR] Unable to read sessionStorage', ex);
  }

  if (Date.now() - lastReloadedAt < RELOAD_COOLDOWN_MS) {
    logger.error('[PRELOAD-ERROR] Dynamic import failed again shortly after a reload, skipping reload', payload);
    return;
  }

  tracker.error('Dynamic import failed, reloading to recover', payload);
  setItemInSessionStorage(RELOADED_AT_KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

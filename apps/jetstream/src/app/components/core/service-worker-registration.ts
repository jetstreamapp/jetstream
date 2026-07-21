import { logger } from '@jetstream/shared/client-logger';
import { SW_PRECACHE_PREFIX } from '@jetstream/shared/constants';

const SW_URL = '/app/sw.js';
const SW_SCOPE = '/app';
// Set `localStorage['jetstream-sw-enabled'] = 'true'` to test the worker against a non-production build
const LOCAL_TESTING_KEY = 'jetstream-sw-enabled';

/**
 * Register the precache service worker (see sw.template.js for its design constraints).
 * Only registers on /app pages of built bundles (import.meta.env.PROD) - `sw.js` is only emitted
 * at build time, and a 404 on the dev server would cause the browser to drop the registration.
 * NOTE: environment.production is deliberately not used here - fileReplacements is not applied
 * by the Vite build, so that value is unreliable.
 */
export async function registerServiceWorker(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !window.location.pathname.startsWith(SW_SCOPE)) {
      return;
    }
    if (!import.meta.env.PROD && localStorage.getItem(LOCAL_TESTING_KEY) !== 'true') {
      return;
    }
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    logger.log('[SW] Registered', { scope: registration.scope });
  } catch (ex) {
    logger.error('[SW] Registration failed', ex);
  }
}

/**
 * Remove the registration and every precache. Called whenever the feature flag is off, which
 * doubles as a client-side kill switch (the server-side one is the SW_KILL_SWITCH env var).
 */
export async function unregisterServiceWorker(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) {
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (registration) {
      await registration.unregister();
      logger.log('[SW] Unregistered');
    }
    if ('caches' in window) {
      const cacheNames = (await caches.keys()).filter((cacheName) => cacheName.startsWith(SW_PRECACHE_PREFIX));
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
  } catch (ex) {
    logger.error('[SW] Unregister failed', ex);
  }
}

/** Ask the browser to re-fetch sw.js now (e.g. when the heartbeat reports a new server version). */
export async function checkForServiceWorkerUpdate(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) {
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    await registration?.update();
  } catch (ex) {
    logger.log('[SW] Update check failed', ex);
  }
}

/**
 * Reload to pick up a new version. If a new worker is waiting, activate it first so the reloaded
 * page is served from the new precache. Navigations are never service-worker-served, so the reload
 * gets the newest shell in every case - the SKIP_WAITING handshake only improves cache hit-rate.
 */
export async function applyServiceWorkerUpdateAndReload(): Promise<void> {
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration(SW_SCOPE) : undefined;
    const waitingWorker = registration?.waiting;
    if (!waitingWorker) {
      window.location.reload();
      return;
    }
    const fallbackTimeout = setTimeout(() => window.location.reload(), 1000);
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(fallbackTimeout);
        window.location.reload();
      },
      { once: true },
    );
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    window.location.reload();
  }
}

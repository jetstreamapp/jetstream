/// <reference lib="WebWorker" />
/* eslint-disable no-restricted-globals */ // `self` is the service-worker global scope
import { logger } from '@jetstream/shared/client-logger';
import * as Sentry from '@sentry/browser';
import browser from 'webextension-polyfill';
import { environment } from '../environments/environment';

let initialized = false;

/**
 * Crash diagnostics for the MV3 service worker.
 *
 * Routes through our own API via the `tunnel` option so no third party connects from the user's
 * machine. MV3 service workers are short-lived and have no DOM, so default browser integrations
 * (which assume `document`/`window`) are disabled — we capture manually instead (see
 * `captureServiceWorkerError`) and flush explicitly so events aren't lost when the worker is killed.
 *
 * No-op when the DSN is unset or the build-time kill switch is on.
 */
export function initServiceWorkerSentry(): void {
  if (initialized || !environment.sentryDsn || import.meta.env.NX_PUBLIC_DISABLE_ERROR_REPORTING === 'true') {
    return;
  }
  try {
    Sentry.init({
      dsn: environment.sentryDsn,
      tunnel: `${environment.serverUrl}/web-extension/crash`,
      release: browser.runtime.getManifest().version,
      environment: environment.production ? 'production' : 'development',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      // MV3 service workers have no DOM; the default browser integrations assume document/window.
      defaultIntegrations: false,
    });
    initialized = true;

    // Manual safety nets — the SW global is `self`. Capture + flush so we don't lose the event when
    // the worker is terminated shortly after.
    self.addEventListener('error', (event) => {
      void captureServiceWorkerError(event.error ?? event.message);
    });
    self.addEventListener('unhandledrejection', (event) => {
      void captureServiceWorkerError(event.reason);
    });
  } catch (ex) {
    logger.error('Failed to initialize crash diagnostics', ex);
  }
}

/** Attach the current user to subsequent crash reports. */
export function setServiceWorkerSentryUser(user: { id?: string; email?: string } | null): void {
  if (!initialized) {
    return;
  }
  Sentry.setUser(user);
}

/** Capture a handled error and flush — MV3 workers can be terminated when idle, so don't rely on async flush later. */
export async function captureServiceWorkerError(error: unknown): Promise<void> {
  if (!initialized) {
    return;
  }
  try {
    Sentry.captureException(error);
    await Sentry.flush(2000);
  } catch (ex) {
    logger.error('Failed to capture error', ex);
  }
}

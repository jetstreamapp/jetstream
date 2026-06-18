import * as Sentry from '@sentry/electron/main';
import { app } from 'electron';
import logger from 'electron-log';
import { ENV, SERVER_URL } from './environment';

let initialized = false;

/**
 * Initialize crash diagnostics for the Electron MAIN process (uncaught exceptions + native crashes).
 *
 * Everything routes through our own API via the `tunnel` option so no third party connects from the
 * user's machine. @sentry/electron's default `sentryMinidumpIntegration` captures native crash
 * minidumps to disk and sends them as envelope attachments through this same tunneled transport — so
 * native crashes are covered too, without a direct Sentry connection.
 *
 * The renderer process has its own SDK (errorTracker via @sentry/react), so we do NOT wire the
 * @sentry/electron renderer/preload integration here — that avoids double-reporting renderer JS errors.
 *
 * No-op when SENTRY_DSN is unset. Call as early as possible in main.ts, before app startup.
 */
export function initSentry(): void {
  if (initialized || !ENV.SENTRY_DSN) {
    return;
  }
  try {
    const tunnel = new URL('/desktop-app/crash', SERVER_URL).toString();
    Sentry.init({
      dsn: ENV.SENTRY_DSN,
      // Route all events (JS + native minidump attachments) through our first-party tunnel.
      tunnel,
      release: app.getVersion(),
      environment: ENV.ENVIRONMENT,
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    initialized = true;
    logger.info('Crash diagnostics initialized (tunneled)');
  } catch (ex) {
    logger.error('Failed to initialize crash diagnostics', ex);
  }
}

/** Report a handled error from the main process (e.g. auto-updater failures). No-op when uninitialized. */
export function captureMainProcessError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    return;
  }
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch (ex) {
    logger.error('Failed to capture error', ex);
  }
}

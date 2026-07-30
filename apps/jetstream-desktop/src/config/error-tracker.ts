import type { Maybe } from '@jetstream/types';
import * as Sentry from '@sentry/node';
import { app } from 'electron';
import logger from 'electron-log';
import { getUserPreferences } from '../services/persistence.service';
import { ENV } from './environment';

/**
 * Error tracking for the Electron MAIN (Node) process, reporting to the Jetstream Desktop
 * Better Stack project.
 *
 * The DSN is public and is baked into the RENDERER bundle at build time (Vite inlines
 * `NX_PUBLIC_SENTRY_DSN_DESKTOP`). The packaged main-process bundle has no build-time env, so the
 * renderer hands the DSN to the main process over IPC (`configureCrashReporter`) once it boots.
 * As a result, main-process errors are captured for the lifetime of a loaded window — which covers
 * normal app operation (IPC handlers, Salesforce requests, auto-updater). Crashes that occur before
 * the first window loads fall back to electron-log only.
 */

let initialized = false;

/**
 * The persisted preference is the single source of truth for consent — it is read on every event
 * instead of being mirrored here, so the menu checkbox and the settings page cannot disagree with it.
 * Preferences are cached in memory by the persistence service, so this is a cheap read.
 */
function isCrashReportingEnabled(): boolean {
  return getUserPreferences().crashReportingEnabled;
}

export function initMainErrorTracker(dsn: Maybe<string>): void {
  if (initialized || !dsn || ENV.ENVIRONMENT === 'development') {
    return;
  }
  try {
    Sentry.init({
      dsn,
      release: app.getVersion(),
      environment: ENV.ENVIRONMENT,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      initialScope: { tags: { process: 'main' } },
      beforeSend: (event) => (isCrashReportingEnabled() ? event : null),
    });
    initialized = true;
    logger.info('Main-process error tracker initialized');
  } catch (ex) {
    logger.error('Failed to initialize main-process error tracker', ex);
  }
}

export function captureMainException(error: unknown, extras?: Record<string, unknown>): void {
  if (!initialized || !isCrashReportingEnabled()) {
    return;
  }
  try {
    Sentry.withScope((scope) => {
      if (extras) {
        scope.setExtras(extras);
      }
      Sentry.captureException(error);
    });
  } catch (ex) {
    logger.error('[ERROR_TRACKER] Failed to capture main-process event', ex);
  }
}

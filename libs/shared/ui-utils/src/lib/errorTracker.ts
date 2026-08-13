import { logger } from '@jetstream/shared/client-logger';
import { INVALID_QUERY_LOCATOR_REGEX } from '@jetstream/shared/utils';
import { Environment, UserProfileUi } from '@jetstream/types';
import * as Sentry from '@sentry/react';

type Severity = 'error' | 'warning' | 'fatal' | 'info';

const ignoredMessageSubstrings = [
  'expired access/refresh token',
  'socket hang up',
  'ResizeObserver loop completed',
  'ResizeObserver loop limit exceeded',
  '/js/monaco/vs/',
  'Session expired or invalid',
  'This session is not valid for use with the REST API',
  'There was an error reading one or more date fields in your file',
  'There was an error reading one or more time fields in your file',
  // Generic auth-failure fallback from responseErrorInterceptor when the backend returns 401/403 with no JSON body.
  // The frontend cannot fix these (expired/revoked session); user is shown an in-app error state.
  'An unknown error has occurred (HTTP 401)',
  'An unknown error has occurred (HTTP 403)',
  // dexie-observable's unload-time localStorage write for users at storage quota — guarded in ui-db,
  // but old bundles remain in the field.
  'Dexie.Observable/deadnode',
];
// Expired/evicted Salesforce query cursor — the user must re-run their query; nothing to fix client-side.
// Shared with the UI so the "your query results expired" messaging and this ignore rule match the same errors.
const ignoredMessagePatterns = [INVALID_QUERY_LOCATOR_REGEX];
// 'DatabaseClosedError' matches the exception TYPE: dexie-observable closes the shared connection after
// a tab freeze/sleep. Every user-triggered read/write goes through `withReopenOnDatabaseClosed`, which
// reopens and retries, so anything still reaching here is residual and not actionable.
const ignoredExactMessages = new Set(['Canceled', 'ChunkLoadError', '(unknown)', 'DatabaseClosedError']);
const extensionUrlPrefixes = ['chrome-extension://', 'moz-extension://', 'safari-web-extension://', 'safari-extension://'];

// How browsers word a worker whose script could not be fetched: Firefox reports a bare NetworkError,
// Chromium names importScripts explicitly.
const workerScriptLoadFailurePattern = /^NetworkError: A network error occurred\.$|Failed to execute 'importScripts'/;
// A worker reports failure as an ErrorEvent, which Sentry wraps rather than reporting directly. The
// real message is quoted inside.
const wrappedErrorEventPattern = /^Event `ErrorEvent` captured as exception with message `(.+)`$/;

const PER_SESSION_MINUTE_LIMIT = 10;
const PER_SESSION_TOTAL_LIMIT = 20;

const rateLimitState: { minute: number[]; total: number } = { minute: [], total: 0 };

let initialized = false;
let optedOut = false;
let pendingUser: { id?: string; email?: string } | null | undefined;

interface InitOptions {
  dsn?: string | null;
  environment?: Environment;
  version?: string;
}

function isRateLimited(): boolean {
  const now = Date.now();
  rateLimitState.minute = rateLimitState.minute.filter((timestamp) => timestamp > now - 60_000);
  if (rateLimitState.total >= PER_SESSION_TOTAL_LIMIT || rateLimitState.minute.length >= PER_SESSION_MINUTE_LIMIT) {
    return true;
  }
  rateLimitState.minute.push(now);
  rateLimitState.total += 1;
  return false;
}

/** Exported for testing — the ignore rules are the only thing standing between us and alert storms. */
export function shouldIgnore(event: Sentry.ErrorEvent): boolean {
  const candidates: string[] = [];
  if (event.message) {
    candidates.push(event.message);
  }
  for (const value of event.exception?.values ?? []) {
    if (value.value) {
      candidates.push(value.value);
    }
    if (value.type) {
      candidates.push(value.type);
    }
  }
  for (const candidate of candidates) {
    if (ignoredExactMessages.has(candidate)) {
      return true;
    }
    if (ignoredMessageSubstrings.some((needle) => candidate.includes(needle))) {
      return true;
    }
    if (ignoredMessagePatterns.some((pattern) => pattern.test(candidate))) {
      return true;
    }
  }
  const allFrames = event.exception?.values?.flatMap((exception) => exception.stacktrace?.frames ?? []) ?? [];
  if (allFrames.some((frame) => frame.filename?.includes('/js/monaco/vs/'))) {
    return true;
  }
  if (allFrames.some((frame) => extensionUrlPrefixes.some((prefix) => frame.filename?.startsWith(prefix)))) {
    return true;
  }
  if (
    isWorkerScriptLoadFailure(
      candidates,
      allFrames.some((frame) => frame.filename?.startsWith('blob:')),
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Monaco builds its editor workers from a `blob:` bootstrap that `importScripts()` the real worker
 * file. When that fetch is blocked (browser extension, tracking protection, corporate proxy) the
 * failure arrives in two shapes, neither of which the `/js/monaco/vs/` rule can match: the raw error,
 * whose only stack frame is the blob URL, and the worker's ErrorEvent, whose frames are all Sentry
 * internals. Monaco catches this itself and falls back to running worker code on the main thread, so
 * neither is actionable.
 *
 * Filtering here is the only thing that stops the noise: every occurrence carries a fresh blob UUID,
 * so error tracking groups each one as a brand-new error and re-alerts. Marking them resolved
 * upstream does nothing.
 */
function isWorkerScriptLoadFailure(candidates: string[], hasBlobFrame: boolean): boolean {
  return candidates.some((candidate) => {
    const wrappedMessage = wrappedErrorEventPattern.exec(candidate)?.[1];
    if (!workerScriptLoadFailurePattern.test(wrappedMessage ?? candidate)) {
      return false;
    }
    // An ErrorEvent means the failure came from a worker rather than app code, which is attribution
    // enough on its own. A raw error needs the blob: frame, so a failed `fetch` in app code — which
    // Firefox words identically — still gets reported.
    return wrappedMessage !== undefined || hasBlobFrame;
  });
}

/**
 * Initialize the error tracker. Safe to call multiple times — only the first call with a non-empty dsn does anything.
 * Call this once at app boot (e.g. AppInitializer) before any errors need to be reported.
 */
export function initErrorTracker(options: InitOptions): void {
  if (initialized || optedOut || !options.dsn || !options.environment) {
    return;
  }
  // Build-time kill switch (e.g. staging pen tests). Backend reads DISABLE_ERROR_REPORTING.
  if (import.meta.env.NX_PUBLIC_DISABLE_ERROR_REPORTING === 'true') {
    optedOut = true;
    return;
  }
  Sentry.init({
    dsn: options.dsn,
    release: options.version,
    environment: options.environment,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event) => {
      if (optedOut) {
        return null;
      }
      if (shouldIgnore(event as Sentry.ErrorEvent)) {
        return null;
      }
      if (isRateLimited()) {
        return null;
      }
      return event;
    },
  });
  initialized = true;
  if (pendingUser !== undefined) {
    Sentry.setUser(pendingUser);
  }
}

/**
 * Attach the current user to all subsequent error reports. Call once when the user profile loads.
 */
export function setErrorTrackerUser(userProfile: Pick<UserProfileUi, 'id' | 'email'> | null | undefined): void {
  if (optedOut) {
    return;
  }
  const user = userProfile ? { id: userProfile.id, email: userProfile.email } : null;
  pendingUser = user;
  if (!initialized) {
    return;
  }
  Sentry.setUser(user);
}

/**
 * Disable all reporting at runtime (e.g. user opts out of telemetry).
 */
export function setErrorTrackerOptOut(value: boolean): void {
  optedOut = value;
}

function capture(severity: Severity, messageOrError: unknown, extras: unknown[]): void {
  if (!initialized || optedOut) {
    return;
  }
  try {
    Sentry.withScope((scope) => {
      scope.setLevel(severity);
      const merged: Record<string, unknown> = {};
      let errorFromExtras: Error | undefined;
      for (const arg of extras) {
        if (arg instanceof Error) {
          errorFromExtras = errorFromExtras ?? arg;
        } else if (arg && typeof arg === 'object') {
          Object.assign(merged, arg as Record<string, unknown>);
        }
      }
      if (Object.keys(merged).length > 0) {
        scope.setExtras(merged);
      }
      if (messageOrError instanceof Error) {
        Sentry.captureException(messageOrError);
      } else if (errorFromExtras) {
        if (typeof messageOrError === 'string') {
          // Wrap so the description becomes the issue title in the tracker,
          // while preserving the original stack and cause chain.
          const wrapped = new Error(`${messageOrError}: ${errorFromExtras.message}`, { cause: errorFromExtras });
          wrapped.name = errorFromExtras.name;
          wrapped.stack = errorFromExtras.stack;
          Sentry.captureException(wrapped);
        } else {
          Sentry.captureException(errorFromExtras);
        }
      } else if (typeof messageOrError === 'string') {
        Sentry.captureMessage(messageOrError, severity);
      } else {
        Sentry.captureException(new Error(String(messageOrError)));
      }
    });
  } catch (ex) {
    logger.log('[ERROR_TRACKER] Failed to capture event', ex);
  }
}

export interface ErrorTracker {
  error: (messageOrError: unknown, ...extras: unknown[]) => void;
  warn: (messageOrError: unknown, ...extras: unknown[]) => void;
  critical: (messageOrError: unknown, ...extras: unknown[]) => void;
  info: (messageOrError: unknown, ...extras: unknown[]) => void;
}

export const tracker: ErrorTracker = {
  error: (messageOrError, ...extras) => capture('error', messageOrError, extras),
  warn: (messageOrError, ...extras) => capture('warning', messageOrError, extras),
  critical: (messageOrError, ...extras) => capture('fatal', messageOrError, extras),
  info: (messageOrError, ...extras) => capture('info', messageOrError, extras),
};

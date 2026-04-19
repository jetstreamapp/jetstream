import { logBuffer, logger } from '@jetstream/shared/client-logger';
import { Environment, UserProfileUi } from '@jetstream/types';
import * as Sentry from '@sentry/react';

type Severity = 'error' | 'warning' | 'fatal' | 'info';

const ignoredMessageSubstrings = ['expired access/refresh token', 'socket hang up'];
const ignoredExactMessages = new Set(['Canceled', 'ChunkLoadError', '(unknown)']);

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

function shouldIgnore(event: Sentry.ErrorEvent): boolean {
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
  }
  const frames = event.exception?.values?.[0]?.stacktrace?.frames;
  const topFrame = frames?.[frames.length - 1];
  if (topFrame?.filename?.endsWith('/js/monaco/vs/loader.js')) {
    return true;
  }
  return false;
}

function getRecentLogs(): string {
  try {
    return JSON.stringify(logBuffer);
  } catch (ex) {
    return `[ERROR GETTING RECENT LOGS: ${ex instanceof Error ? ex.message : String(ex)}]`;
  }
}

/**
 * Initialize the error tracker. Safe to call multiple times — only the first call with a non-empty dsn does anything.
 * Call this once at app boot (e.g. AppInitializer) before any errors need to be reported.
 */
export function initErrorTracker(options: InitOptions): void {
  if (initialized || optedOut || !options.dsn || !options.environment) {
    return;
  }
  Sentry.init({
    dsn: options.dsn,
    release: options.version,
    environment: options.environment,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event) => {
      if (shouldIgnore(event as Sentry.ErrorEvent)) {
        return null;
      }
      if (isRateLimited()) {
        return null;
      }
      event.extra = { ...event.extra, recentLogs: getRecentLogs() };
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
          scope.setExtra('message', messageOrError);
        }
        Sentry.captureException(errorFromExtras);
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

import { logger } from '@jetstream/shared/client-logger';
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
];
const ignoredExactMessages = new Set(['Canceled', 'ChunkLoadError', '(unknown)']);
const extensionUrlPrefixes = ['chrome-extension://', 'moz-extension://', 'safari-web-extension://', 'safari-extension://'];

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
  /**
   * When set, Sentry routes all events through this URL instead of connecting to Sentry directly.
   * Used by the desktop app and web extension to keep reporting first-party (the URL points at our
   * own API tunnel). Leave undefined for the web app, which connects to Sentry directly.
   */
  tunnel?: string;
}

// Mirrors the server-side scrub (api-sentry-config.ts) so PII is redacted before it leaves the client —
// this is the PRIMARY scrub; the server tunnel only re-scrubs best-effort as defense-in-depth.
const SENSITIVE_KEY_SUBSTRINGS = [
  'password',
  'passwd',
  'secret',
  'token',
  'csrf',
  'cookie',
  'authorization',
  'privatekey',
  'samlresponse',
  'apikey',
  'credential',
  'sessionid',
  'verifier',
  'bearer',
];
const SENSITIVE_KEY_EXACT = new Set(['code', 'otp', 'mfa', 'sid', 'pin', 'auth']);
const REDACTED = '[REDACTED]';
const MAX_REDACT_DEPTH = 6;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_EXACT.has(lower) || SENSITIVE_KEY_SUBSTRINGS.some((needle) => lower.includes(needle));
}

function redactSensitiveDeep(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
    return value; // preserve special objects (Date, etc.)
  }
  if (depth >= MAX_REDACT_DEPTH) {
    return REDACTED;
  }
  if (Array.isArray(value)) {
    seen.add(value);
    return value.map((item) => redactSensitiveDeep(item, depth + 1, seen));
  }
  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redactSensitiveDeep(val, depth + 1, seen);
  }
  return result;
}

function scrubEventPii(event: Sentry.ErrorEvent): void {
  if (event.extra) {
    event.extra = redactSensitiveDeep(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = redactSensitiveDeep(event.contexts) as Sentry.ErrorEvent['contexts'];
  }
  if (event.request) {
    event.request = redactSensitiveDeep(event.request) as Sentry.ErrorEvent['request'];
  }
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
  const allFrames = event.exception?.values?.flatMap((exception) => exception.stacktrace?.frames ?? []) ?? [];
  if (allFrames.some((frame) => frame.filename?.includes('/js/monaco/vs/'))) {
    return true;
  }
  if (allFrames.some((frame) => extensionUrlPrefixes.some((prefix) => frame.filename?.startsWith(prefix)))) {
    return true;
  }
  return false;
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
    tunnel: options.tunnel,
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
      scrubEventPii(event as Sentry.ErrorEvent);
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

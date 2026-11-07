/**
 * Helpers for stripping secrets and customer data out of values before they are handed to
 * third-party telemetry (analytics page views, error trackers). Pure functions, safe to use in
 * the browser, workers and node.
 */

export const TELEMETRY_REDACTED_VALUE = '[REDACTED]';
const REDACTED_PATH_SEGMENT = ':redacted';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX_REGEX = /^[0-9a-f]{24,}$/i;
// Salesforce record ids are 15 or 18 alphanumeric characters and always contain a digit.
const SALESFORCE_ID_REGEX = /^(?:[a-z0-9]{15}|[a-z0-9]{18})$/i;
// Opaque tokens (base64url, signed tokens, api keys). Requires a digit so long human-readable
// slugs such as `salesforce-inspector-alternative` are kept.
const OPAQUE_TOKEN_REGEX = /^[a-z0-9_.~-]{20,}$/i;
const CONTAINS_DIGIT_REGEX = /\d/;

function isSecretLikePathSegment(segment: string): boolean {
  if (UUID_REGEX.test(segment) || LONG_HEX_REGEX.test(segment)) {
    return true;
  }
  if (!CONTAINS_DIGIT_REGEX.test(segment)) {
    return false;
  }
  return SALESFORCE_ID_REGEX.test(segment) || OPAQUE_TOKEN_REGEX.test(segment);
}

function redactPathname(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // keep the raw segment when it is not valid percent-encoding
      }
      return isSecretLikePathSegment(decoded) ? REDACTED_PATH_SEGMENT : segment;
    })
    .join('/');
}

/**
 * Reduce a URL to something safe to send to a third party:
 * - the query string and fragment are dropped entirely (one-time codes, tokens, oauth `code`/`state`, ...)
 * - path segments that look like ids or tokens (uuids, long hex, Salesforce ids, opaque strings) are replaced
 *
 * Absolute urls keep their origin, relative urls stay relative. Returns an empty string for empty input.
 */
export function sanitizeUrlForTelemetry(url: string | null | undefined): string {
  if (!url) {
    return '';
  }
  const trimmed = url.trim();
  const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  try {
    const parsed = new URL(trimmed, isAbsolute ? undefined : 'http://relative.invalid');
    const pathname = redactPathname(parsed.pathname);
    if (isAbsolute) {
      return `${parsed.origin}${pathname}`;
    }
    // Relative input without a leading slash (e.g. a transaction name) keeps its shape
    return trimmed.startsWith('/') ? pathname : pathname.replace(/^\//, '');
  } catch {
    // Not parseable as a URL: fall back to cutting at the first query/fragment delimiter.
    const stopIndex = trimmed.search(/[?#]/);
    return redactPathname(stopIndex === -1 ? trimmed : trimmed.slice(0, stopIndex));
  }
}

// Substring match (case-insensitive) — catches accessToken, refresh_token, csrfToken, clientSecret,
// SAMLResponse, sessionId, etc. without enumerating every variant.
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
// Exact match (case-insensitive) — short ambiguous keys only redacted when they are the WHOLE key,
// so `code`/`state`/`sid` don't also redact `statusCode`, `stateName` or `osId`.
const SENSITIVE_KEY_EXACT = new Set(['code', 'state', 'otp', 'mfa', 'sid', 'pin', 'auth']);

export function isSensitiveTelemetryKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (SENSITIVE_KEY_EXACT.has(normalized)) {
    return true;
  }
  return SENSITIVE_KEY_SUBSTRINGS.some((needle) => normalized.includes(needle));
}

export interface RedactTelemetryOptions {
  /** Nesting deeper than this is replaced with the redacted marker instead of being emitted un-scrubbed */
  maxDepth?: number;
  /** Strings longer than this are truncated (large payloads such as queries, records or response bodies) */
  maxStringLength?: number;
  /** Arrays longer than this are cut and a trailing marker is appended */
  maxArrayLength?: number;
}

const DEFAULT_REDACT_OPTIONS: Required<RedactTelemetryOptions> = {
  maxDepth: 6,
  maxStringLength: 2_000,
  maxArrayLength: 50,
};

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…[truncated ${value.length - maxLength} chars]`;
}

function redactDeep(value: unknown, options: Required<RedactTelemetryOptions>, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return truncateString(value, options.maxStringLength);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  // Special objects (Date, Error, Blob, ...) are left for the telemetry SDK to serialize.
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return value;
  }
  if (depth >= options.maxDepth) {
    return TELEMETRY_REDACTED_VALUE;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const items = value.slice(0, options.maxArrayLength).map((item) => redactDeep(item, options, depth + 1, seen));
    if (value.length > options.maxArrayLength) {
      items.push(`…[truncated ${value.length - options.maxArrayLength} items]`);
    }
    return items;
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveTelemetryKey(key) ? TELEMETRY_REDACTED_VALUE : redactDeep(entry, options, depth + 1, seen);
  }
  return result;
}

/**
 * Recursively redact values stored under secret-looking keys and bound the size of what remains
 * (long strings and arrays are truncated, deep nesting is cut off). Only plain objects and arrays
 * are traversed; other objects are returned untouched. Returns a new value, the input is not mutated.
 */
export function redactSensitiveTelemetryData<T>(value: T, options?: RedactTelemetryOptions): T {
  return redactDeep(value, { ...DEFAULT_REDACT_OPTIONS, ...options }, 0, new WeakSet<object>()) as T;
}

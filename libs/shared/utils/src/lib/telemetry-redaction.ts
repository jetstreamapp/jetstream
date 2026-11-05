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
    return isAbsolute ? `${parsed.origin}${pathname}` : pathname;
  } catch {
    // Not parseable as a URL: fall back to cutting at the first query/fragment delimiter.
    const stopIndex = trimmed.search(/[?#]/);
    return redactPathname(stopIndex === -1 ? trimmed : trimmed.slice(0, stopIndex));
  }
}

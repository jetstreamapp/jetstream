import { ENV } from '@jetstream/api-config';

const COOKIE_PATH_ATTR = /^path=/i;
const COOKIE_SAMESITE_ATTR = /^samesite=/i;
const COOKIE_SECURE_ATTR = /^secure$/i;

/**
 * Match Jetstream-origin cookies that must not be forwarded to Salesforce.
 * Covers exact `sessionid` and the `jetstream` namespace with optional `__Secure-` / `__Host-`
 * prefixes. The negative lookahead `(?![a-z0-9])` matches `jetstream` followed by any
 * non-identifier character (`-`, `.`, `_`, end-of-string), so future cookies using `_` as
 * a separator (or a bare `jetstream` name) still get stripped. `jetstreamfoo` — which
 * wouldn't be ours — is correctly not matched.
 */
const JETSTREAM_COOKIE_PATTERN = /^(?:__Secure-|__Host-)?(?:sessionid$|jetstream(?![a-z0-9]))/i;

/**
 * Remove Jetstream-origin cookies from a Cookie header before forwarding it to Salesforce
 * (platform-event proxy). Non-Jetstream cookies — including the normalized Salesforce cookies
 * that live under /platform-event — are preserved. Returns undefined when nothing remains so
 * callers can omit the header entirely.
 *
 * We intentionally split the raw header and rejoin the kept segments verbatim rather than
 * parse+serialize via the `cookie` package. That library's `serialize()` runs values through
 * `encodeURIComponent`, which percent-encodes characters (`/`, `+`, `=`, `:`, `!`) that appear
 * unencoded in Salesforce auth cookies like `t` and `sfdc-stream`. Re-encoding corrupts those
 * values and the CometD handshake fails with `403::Unknown client`.
 */
export function stripJetstreamCookies(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const forwarded = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const eqIndex = part.indexOf('=');
      const name = eqIndex === -1 ? part : part.slice(0, eqIndex);
      return !JETSTREAM_COOKIE_PATTERN.test(name);
    });
  if (forwarded.length === 0) {
    return undefined;
  }
  return forwarded.join('; ');
}

function shouldUseSecureProxyCookies() {
  return ENV.USE_SECURE_COOKIES || ENV.JETSTREAM_SERVER_URL.startsWith('https://');
}

export function normalizePlatformEventSetCookie(cookie: string) {
  const [nameValue, ...attributes] = cookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!nameValue) {
    return cookie;
  }

  const normalizedAttributes = attributes.filter(
    (attribute) => !COOKIE_PATH_ATTR.test(attribute) && !COOKIE_SAMESITE_ATTR.test(attribute) && !COOKIE_SECURE_ATTR.test(attribute),
  );

  normalizedAttributes.push('Path=/platform-event');
  if (shouldUseSecureProxyCookies()) {
    normalizedAttributes.push('Secure');
  }
  normalizedAttributes.push('SameSite=Lax');

  return [nameValue, ...normalizedAttributes].join('; ');
}

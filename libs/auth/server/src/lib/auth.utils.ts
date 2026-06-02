import { logger } from '@jetstream/api-config';
import { Request } from '@jetstream/api-types';
import { CookieConfig, CreateCSRFTokenParams, UserProfileSession, ValidateCSRFTokenParams } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { UserProfileUi } from '@jetstream/types';
import * as bcrypt from 'bcryptjs';
import * as Bowser from 'bowser';
import { Request as ExpressRequest } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const REMEMBER_DEVICE_DAYS = 30;

const TIME_15_MIN = 60 * 15;
const REMEMBER_DEVICE_MAX_AGE = REMEMBER_DEVICE_DAYS * 24 * 60 * 60;

export function getCookieConfig(useSecureCookies: boolean): CookieConfig {
  const cookiePrefix = useSecureCookies ? '__Secure-' : '';
  return {
    callbackUrl: {
      name: `${cookiePrefix}jetstream-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      // Default to __Host- for CSRF token for additional protection if using useSecureCookies
      // NB: The `__Host-` prefix is stricter than the `__Secure-` prefix.
      name: `${useSecureCookies ? '__Host-' : ''}jetstream-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}jetstream-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: TIME_15_MIN,
      },
    },
    linkIdentity: {
      name: `${cookiePrefix}jetstream-auth.link-identity`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: TIME_15_MIN,
      },
    },
    state: {
      name: `${cookiePrefix}jetstream-auth.state`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: TIME_15_MIN,
      },
    },
    nonce: {
      name: `${cookiePrefix}jetstream-auth.nonce`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    returnUrl: {
      name: `${cookiePrefix}jetstream-auth.return-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: TIME_15_MIN,
      },
    },
    webauthnChallenge: {
      name: `${cookiePrefix}jetstream-auth.challenge`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: TIME_15_MIN,
      },
    },
    rememberDevice: {
      name: `${cookiePrefix}jetstream-auth.remember-device`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: REMEMBER_DEVICE_MAX_AGE,
      },
    },
    redirectUrl: {
      name: `jetstream-auth.redirect-url`,
      options: {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: TIME_15_MIN,
      },
    },
    teamInviteState: {
      name: `jetstream-auth.team-invite`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: TIME_15_MIN,
      },
    },
    doubleCSRFToken: {
      name: `${useSecureCookies ? '__Host-' : ''}${HTTP.COOKIE.CSRF_SUFFIX}`,
      options: {
        httpOnly: false, // Must be readable by JavaScript for double CSRF
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  } as const;
}

export async function hashPassword(password: string): Promise<string> {
  try {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch {
    throw new Error('Error hashing the password');
  }
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch {
    throw new Error('Error verifying the password');
  }
}

export function createHMAC(secret: string, message: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('hex');
}

export function randomString(size: number) {
  const i2hex = (i: number) => ('0' + i.toString(16)).slice(-2);
  const r = (a: string, i: number): string => a + i2hex(i);
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes).reduce(r, '');
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * Converts strings to buffers and uses crypto.timingSafeEqual
 */
export function timingSafeStringCompare(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) {
    return false;
  }

  // Ensure both strings are the same length to prevent timing attacks
  // If lengths differ, we still need to do a constant-time comparison
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  // timingSafeEqual requires same length buffers
  if (bufferA.length !== bufferB.length) {
    return false;
  }

  try {
    return timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}

export function createCSRFToken({ secret }: CreateCSRFTokenParams) {
  if (!secret) {
    throw new Error('Secret is required to create a CSRF token');
  }

  const csrfToken = randomString(32);
  const csrfTokenHash = createHMAC(secret, csrfToken);
  const cookie = `${csrfToken}|${csrfTokenHash}`;

  return { cookie, csrfToken };
}

/**
 * Verify that the provided Csrf token matches the same token stored in the http only cookie
 */
export function validateCSRFToken({ secret, cookieValue, bodyValue }: ValidateCSRFTokenParams): boolean {
  if (!cookieValue) {
    logger.debug('No CSRF token found in cookie');
    return false;
  }
  const [csrfToken, csrfTokenHash] = cookieValue.split('|');

  const expectedCsrfTokenHash = createHMAC(secret, csrfToken);

  if (!timingSafeStringCompare(csrfTokenHash, expectedCsrfTokenHash)) {
    logger.debug('CSRF token hash does not match');
    return false;
  }

  if (!timingSafeStringCompare(csrfToken, bodyValue)) {
    logger.debug('CSRF token does not match');
    return false;
  }

  return true;
}

/**
 * Compares two user agents to make sure they are similar enough to be valid
 * This is used to ensure that sessions are not hijacked by a different browser
 */
export function checkUserAgentSimilarity(sessionUserAgent: string, currentUserAgent: string): boolean {
  const sessionUA = Bowser.getParser(sessionUserAgent);
  return (
    Bowser.getParser(currentUserAgent).satisfies({
      [sessionUA.getOSName(true)]: {
        [sessionUA.getBrowserName(true)]: `>=${sessionUA.getBrowserVersion()}`,
      },
    }) === true
  );
}

export const convertUserProfileToSession_External = (user: UserProfileUi): UserProfileSession => {
  return {
    id: user.id,
    userId: user.userId || user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    // TODO: External auth (desktop/extension) does not currently carry tosAcceptedVersion from the DB.
    // Setting to null to avoid falsely representing acceptance status.
    // A follow-up PR should propagate the real value from the DB and enforce ToS acceptance for external clients.
    tosAcceptedVersion: null,
    authFactors: [],
  };
};

// Max length of a textual IP address (IPv6 with an embedded IPv4, e.g. ::ffff:255.255.255.255)
const MAX_IP_ADDRESS_LENGTH = 45;

export function getApiAddressFromReq(req: Request<unknown, unknown, unknown> | ExpressRequest<unknown, unknown, unknown, unknown>): string {
  try {
    // Use Express's trust-proxy-aware `req.ip` instead of raw client-supplied headers.
    const ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
    // Defensive length cap so a malformed value cannot be injected into downstream sinks
    // (the GeoIP API request body, notification emails).
    if (typeof ipAddress === 'string' && ipAddress.length > 0 && ipAddress.length <= MAX_IP_ADDRESS_LENGTH) {
      return ipAddress;
    }
    return 'unknown';
  } catch (ex) {
    logger.error('Error fetching IP address', ex);
    return 'unknown';
  }
}

/**
 * Validates a redirect URL to prevent open redirect vulnerabilities.
 * Only allows:
 * - Relative paths starting with / (but not // which could be protocol-relative)
 * - Absolute URLs that match allowed origins (JETSTREAM_CLIENT_URL or JETSTREAM_SERVER_URL)
 *
 * @param url - The URL to validate (from user input, cookies, or query params)
 * @param allowedOrigins - Array of allowed origin URLs (e.g., ['https://app.example.com'])
 * @param defaultUrl - The default safe URL to return if validation fails
 * @returns The validated URL or the default URL if validation fails
 */
// Control chars, whitespace, and backslashes are rejected outright in redirect candidates.
// Browsers normalize "\" to "/" per the WHATWG URL spec, so "/\evil.com" would otherwise be
// parsed as the protocol-relative "//evil.com" and escape the origin even though it passes a
// naive `startsWith('//')` check.
const UNSAFE_REDIRECT_CHARS = /[\u0000-\u0020\u007F\\]/;

export function validateRedirectUrl(url: string | null | undefined, allowedOrigins: string[], defaultUrl: string): string {
  if (!url || typeof url !== 'string') {
    return defaultUrl;
  }

  // Trim whitespace
  url = url.trim();

  // Empty string
  if (!url) {
    return defaultUrl;
  }

  // Reject anything containing control chars, whitespace, or backslashes before any further
  // parsing — these are the characters browsers normalize in ways that bypass origin checks.
  if (UNSAFE_REDIRECT_CHARS.test(url)) {
    logger.warn({ url, allowedOrigins }, '[SECURITY] Redirect URL with unsafe characters blocked');
    return defaultUrl;
  }

  try {
    // Relative paths: must start with a single "/" (not "//"). Resolve against the first allowed
    // origin and re-emit only the normalized path/query/hash so that no parsing trick can carry an
    // authority component through. Falls back to the raw (already char-sanitized) path if no base.
    if (url.startsWith('/')) {
      if (url.startsWith('//')) {
        logger.warn({ url, allowedOrigins }, '[SECURITY] Protocol-relative redirect blocked');
        return defaultUrl;
      }
      const baseOrigin = allowedOrigins[0];
      if (!baseOrigin) {
        return url;
      }
      const resolved = new URL(url, baseOrigin);
      if (allowedOrigins.some((allowedOrigin) => new URL(allowedOrigin).origin === resolved.origin)) {
        return `${resolved.pathname}${resolved.search}${resolved.hash}`;
      }
      logger.warn({ url, origin: resolved.origin, allowedOrigins }, '[SECURITY] Attempted open redirect blocked');
      return defaultUrl;
    }

    // Absolute URLs: validate the origin against the allow list
    const parsedUrl = new URL(url);
    const origin = parsedUrl.origin;

    for (const allowedOrigin of allowedOrigins) {
      if (origin === new URL(allowedOrigin).origin) {
        return url;
      }
    }

    logger.warn({ url, origin, allowedOrigins }, '[SECURITY] Attempted open redirect blocked');
    return defaultUrl;
  } catch (ex) {
    // Invalid URL format
    logger.warn({ url, ...getErrorMessageAndStackObj(ex) }, '[SECURITY] Invalid redirect URL format blocked');
    return defaultUrl;
  }
}

/**
 * Generate an HMAC-based double CSRF token for session protection
 * Returns a token that can be used both as cookie and header value
 */
export function generateHMACDoubleCSRFToken(secret: string, sessionId: string): string {
  const randomValue = randomString(16); // 16 bytes = 32 hex chars
  const timestamp = Date.now().toString();
  const payload = `${randomValue}:${timestamp}:${sessionId}`;

  // Create HMAC using the session secret and session ID
  const hmac = createHMAC(secret, payload);

  // Return the payload and HMAC combined
  return `${payload}:${hmac}`;
}

/**
 * Validate HMAC-based double CSRF token
 * The token from cookie and header must match and be valid
 */
export function validateHMACDoubleCSRFToken(
  secret: string,
  cookieToken: string | undefined,
  headerToken: string | undefined,
  sessionId: string,
): boolean {
  if (!cookieToken || !headerToken || !timingSafeStringCompare(cookieToken, headerToken)) {
    return false;
  }

  try {
    const parts = cookieToken.split(':');
    // Expect format: randomValue:timestamp:sessionId:hmac (4 parts)
    if (parts.length !== 4) {
      return false;
    }

    const [randomValue, timestamp, tokenSessionId, providedHmac] = parts;
    // Verify session ID matches using timing-safe comparison
    if (!timingSafeStringCompare(tokenSessionId, sessionId)) {
      return false;
    }
    const payload = `${randomValue}:${timestamp}:${tokenSessionId}`;

    // Recreate HMAC using the same secret
    const expectedHmac = createHMAC(secret, payload);

    // Compare HMACs using timing-safe comparison
    if (!timingSafeStringCompare(expectedHmac, providedHmac)) {
      return false;
    }

    // Token is valid if HMAC matches - session expiration handles timeout
    // No additional age check needed since sessions use rolling expiration
    return true;
  } catch {
    return false;
  }
}

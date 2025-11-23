import { logger } from '@jetstream/api-config';
import { Request } from '@jetstream/api-types';
import { CookieConfig, CreateCSRFTokenParams, UserProfileSession, ValidateCSRFTokenParams } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import { UserProfileUi } from '@jetstream/types';
import * as bcrypt from 'bcryptjs';
import * as Bowser from 'bowser';
import { createHmac } from 'node:crypto';

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

  if (csrfTokenHash !== expectedCsrfTokenHash) {
    logger.debug('CSRF token hash does not match');
    return false;
  }

  const csrfTokenVerified = csrfToken === bodyValue;

  if (!csrfTokenVerified) {
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

export const convertUserProfileToSession = (user: UserProfileUi): UserProfileSession => {
  return {
    id: user.id,
    userId: user.userId || user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    authFactors: [],
  };
};

export function getApiAddressFromReq(req: Request<unknown, unknown, unknown>) {
  try {
    const ipAddress = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    if (Array.isArray(ipAddress)) {
      return ipAddress[ipAddress.length - 1];
    }
    return ipAddress;
  } catch (ex) {
    logger.error('Error fetching IP address', ex);
    return `unknown-${new Date().getTime()}`;
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
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return false;
  }

  try {
    const parts = cookieToken.split(':');
    // Expect format: randomValue:timestamp:sessionId:hmac (4 parts)
    if (parts.length !== 4) {
      return false;
    }

    const [randomValue, timestamp, tokenSessionId, providedHmac] = parts;
    // Verify session ID matches
    if (tokenSessionId !== sessionId) {
      return false;
    }
    const payload = `${randomValue}:${timestamp}:${tokenSessionId}`;

    // Recreate HMAC using the same secret
    const expectedHmac = createHMAC(secret, payload);

    // Compare HMACs using constant-time comparison
    if (expectedHmac.length !== providedHmac.length) {
      return false;
    }

    let isEqual = true;
    for (let i = 0; i < expectedHmac.length; i++) {
      if (expectedHmac[i] !== providedHmac[i]) {
        isEqual = false;
      }
    }

    if (!isEqual) {
      return false;
    }

    // Token is valid if HMAC matches - session expiration handles timeout
    // No additional age check needed since sessions use rolling expiration
    return true;
  } catch {
    return false;
  }
}

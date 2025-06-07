import { logger } from '@jetstream/api-config';
import { CookieConfig, CreateCSRFTokenParams, UserProfileSession, ValidateCSRFTokenParams } from '@jetstream/auth/types';
import { UserProfileUi } from '@jetstream/types';
import * as bcrypt from 'bcryptjs';
import * as Bowser from 'bowser';

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
  } as const;
}

export async function hashPassword(password: string): Promise<string> {
  try {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    throw new Error('Error hashing the password');
  }
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error('Error verifying the password');
  }
}

export async function createHash(message: string) {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toString();
}

export function randomString(size: number) {
  const i2hex = (i: number) => ('0' + i.toString(16)).slice(-2);
  const r = (a: string, i: number): string => a + i2hex(i);
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes).reduce(r, '');
}

export async function createCSRFToken({ secret }: CreateCSRFTokenParams) {
  if (!secret) {
    throw new Error('Secret is required to create a CSRF token');
  }

  const csrfToken = randomString(32);
  const csrfTokenHash = await createHash(`${csrfToken}${secret}`);
  const cookie = `${csrfToken}|${csrfTokenHash}`;

  return { cookie, csrfToken };
}

/**
 * Verify that the provided Csrf token matches the same token stored in the http only cookie
 */
export async function validateCSRFToken({ secret, cookieValue, bodyValue }: ValidateCSRFTokenParams): Promise<boolean> {
  if (!cookieValue) {
    logger.debug('No CSRF token found in cookie');
    return false;
  }
  const [csrfToken, csrfTokenHash] = cookieValue.split('|');

  const expectedCsrfTokenHash = await createHash(`${csrfToken}${secret}`);

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

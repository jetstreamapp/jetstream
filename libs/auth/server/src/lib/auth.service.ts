import { ENV, logger } from '@jetstream/api-config';
import type { Request, Response } from '@jetstream/api-types';
import { OauthProviderType, Providers, ResponseLocalsCookies, SessionIpData } from '@jetstream/auth/types';
import { GeoIpLookupResponse } from '@jetstream/types';
import { parseCookie } from 'cookie';
import * as crypto from 'crypto';
import { addHours, addMinutes } from 'date-fns';
import * as QRCode from 'qrcode';
import { OauthClientProvider, OauthClients } from './OauthClients';
import { CURRENT_TOS_VERSION, EMAIL_VERIFICATION_TOKEN_DURATION_HOURS, TOKEN_DURATION_MINUTES } from './auth.constants';
import { findUserById_UNSAFE, handleSignInOrRegistration } from './auth.db.service';
import { AuthError, InvalidCsrfToken, InvalidVerificationToken, InvalidVerificationType } from './auth.errors';
import { generateHMACDoubleCSRFToken, getApiAddressFromReq, getCookieConfig, validateCSRFToken } from './auth.utils';

const oauthPromise = import('oauth4webapi');
const osloEncodingPromise = import('@oslojs/encoding');
const osloOtpPromise = import('@oslojs/otp');

export const TOTP_DIGITS = 6;
export const TOTP_INTERVAL_SEC = 30;

export function ensureAuthError(ex: unknown, fallback?: AuthError) {
  if (ex instanceof AuthError) {
    return ex;
  }
  if (fallback) {
    return fallback;
  }
  return new AuthError();
}

export function getProviders(): Providers {
  return {
    google: {
      provider: 'google',
      type: 'oauth',
      label: 'Google',
      icon: 'https://res.cloudinary.com/getjetstream/image/upload/v1693697889/public/google-login-icon_bzw1hi.svg',
      signinUrl: `${ENV.JETSTREAM_SERVER_URL}/api/auth/signin/google`,
      callbackUrl: `${ENV.JETSTREAM_SERVER_URL}/api/auth/callback/google`,
    },
    salesforce: {
      provider: 'salesforce',
      type: 'oauth',
      label: 'Salesforce',
      icon: 'https://res.cloudinary.com/getjetstream/image/upload/v1724511801/salesforce-blue_qdptxw.svg',
      signinUrl: `${ENV.JETSTREAM_SERVER_URL}/api/auth/signin/salesforce`,
      callbackUrl: `${ENV.JETSTREAM_SERVER_URL}/api/auth/callback/salesforce`,
    },
    credentials: {
      provider: 'credentials',
      type: 'credentials',
      label: 'Jetstream',
      icon: 'https://res.cloudinary.com/getjetstream/image/upload/v1634516624/public/jetstream-icon.svg',
      signinUrl: `${ENV.JETSTREAM_SERVER_URL}/api/auth/signin/credentials`,
      callbackUrl: `${ENV.JETSTREAM_SERVER_URL}/api/auth/callback/credentials`,
    },
    // TODO: magic link
  };
}

export function clearOauthCookies(res: Response) {
  const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);

  res.locals['cookies'] = res.locals['cookies'] || {};
  const cookies = res.locals['cookies'] as ResponseLocalsCookies;

  cookies[cookieConfig.pkceCodeVerifier.name] = {
    clear: true,
    name: cookieConfig.pkceCodeVerifier.name,
    options: cookieConfig.pkceCodeVerifier.options,
  };

  cookies[cookieConfig.state.name] = {
    clear: true,
    name: cookieConfig.state.name,
    options: cookieConfig.state.options,
  };

  cookies[cookieConfig.nonce.name] = {
    clear: true,
    name: cookieConfig.nonce.name,
    options: cookieConfig.nonce.options,
  };

  cookies[cookieConfig.linkIdentity.name] = {
    clear: true,
    name: cookieConfig.linkIdentity.name,
    options: cookieConfig.linkIdentity.options,
  };

  cookies[cookieConfig.returnUrl.name] = {
    clear: true,
    name: cookieConfig.returnUrl.name,
    options: cookieConfig.returnUrl.options,
  };

  cookies[cookieConfig.webauthnChallenge.name] = {
    clear: true,
    name: cookieConfig.webauthnChallenge.name,
    options: cookieConfig.webauthnChallenge.options,
  };
}

export async function getAuthorizationUrl(provider: OauthProviderType) {
  const oauth = await oauthPromise;
  const oauthClients = OauthClients.getInstance();

  const code_challenge_method = 'S256';
  /**
   * The following MUST be generated for every redirect to the authorization_endpoint. You must store
   * the code_verifier, state, and nonce in cookies (that is, in per-user state that survives the
   * redirect) such that they can be recovered as the user gets redirected from the authorization
   * server back to your application.
   */
  const code_verifier = oauth.generateRandomCodeVerifier();
  const code_challenge = await oauth.calculatePKCECodeChallenge(code_verifier);
  const state = oauth.generateRandomState();
  let nonce: string | undefined;

  const { authorizationServer, client } = oauthClients[provider];
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const authorizationUrl = new URL(authorizationServer.authorization_endpoint!);
  authorizationUrl.searchParams.set('client_id', client.client_id);
  authorizationUrl.searchParams.set('redirect_uri', `${ENV.JETSTREAM_SERVER_URL}/api/auth/callback/${provider}`);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid profile email');
  authorizationUrl.searchParams.set('code_challenge', code_challenge);
  authorizationUrl.searchParams.set('code_challenge_method', code_challenge_method);
  authorizationUrl.searchParams.set('state', state);
  if (provider === 'salesforce') {
    authorizationUrl.searchParams.set('prompt', 'login');
  }
  if (provider === 'google') {
    authorizationUrl.searchParams.set('prompt', 'select_account');
  }

  /**
   * We cannot be sure the AS supports PKCE so we're going to use nonce too. Use of PKCE is
   * backwards compatible even if the AS doesn't support it which is why we're using it regardless.
   */
  if (authorizationServer.code_challenge_methods_supported?.includes('S256') !== true) {
    nonce = oauth.generateRandomNonce();
    authorizationUrl.searchParams.set('nonce', nonce);
  }

  return {
    code_verifier,
    code_challenge,
    state,
    nonce,
    authorizationUrl,
  };
}

export async function validateCallback(
  provider: OauthProviderType,
  parameters: URL | URLSearchParams,
  codeVerifier: string,
  expectedState: string,
  nonce?: string,
) {
  const oauthClients = OauthClients.getInstance();

  const clientProvider = oauthClients[provider];
  const { claims, idTokenResult } = await handleOauthCallback(clientProvider, provider, parameters, codeVerifier, expectedState, nonce);
  const userInfo = await getUserInfo(clientProvider, idTokenResult.access_token, claims.sub);

  return { claims, idTokenResult, userInfo };
}

export async function verifyCSRFFromRequestOrThrow(csrfToken: string, cookieString: string) {
  try {
    const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);
    const cookies = parseCookie(cookieString);
    const cookieValue = cookies[cookieConfig.csrfToken.name];
    const validCSRFToken = validateCSRFToken({
      secret: ENV.JETSTREAM_AUTH_SECRET,
      bodyValue: csrfToken,
      cookieValue,
    });

    if (!validCSRFToken) {
      throw new InvalidCsrfToken();
    }
  } catch (ex) {
    logger.error({ err: ex }, '[ERROR] verifyCSRFFromRequestOrThrow');
    throw new InvalidCsrfToken();
  }
}

export async function convertBase32ToHex(base32String: string) {
  const { encodeHexUpperCase, decodeBase32IgnorePadding } = await osloEncodingPromise;
  return encodeHexUpperCase(decodeBase32IgnorePadding(base32String));
}

export async function generate2faTotpSecret() {
  const { encodeHexUpperCase } = await osloEncodingPromise;
  return encodeHexUpperCase(crypto.getRandomValues(new Uint8Array(20)));
}

export async function verify2faTotpOrThrow(secret: string, code: string) {
  const { decodeHex } = await osloEncodingPromise;
  const { verifyTOTPWithGracePeriod } = await osloOtpPromise;
  const validOTP = verifyTOTPWithGracePeriod(decodeHex(secret), TOTP_INTERVAL_SEC, TOTP_DIGITS, code, TOTP_INTERVAL_SEC);
  if (!validOTP) {
    throw new InvalidVerificationToken();
  }
}

export async function generate2faTotpUrl(userId: string) {
  const { decodeHex } = await osloEncodingPromise;
  const { createTOTPKeyURI } = await osloOtpPromise;
  const secret = await generate2faTotpSecret();
  const uri = createTOTPKeyURI('jetstream', userId, decodeHex(secret), TOTP_INTERVAL_SEC, TOTP_DIGITS);
  const imageUri = await QRCode.toDataURL(uri);
  return { secret, uri, imageUri };
}

export const generateRandomCode = (length = 6) => {
  const max = Math.pow(10, length);
  return crypto.randomInt(0, max).toString().padStart(length, '0');
};

/**
 *
 * @param size size in bytes, default is 32 which produces a 64 character string
 * @returns
 */
export const generateRandomString = (size = 32) => {
  return crypto.randomBytes(size).toString('hex');
};

async function handleOauthCallback(
  { authorizationServer, client }: OauthClientProvider,
  provider: OauthProviderType,
  parameters: URL | URLSearchParams,
  codeVerifier: string,
  expectedState: string,
  nonce?: string,
) {
  const oauth = await oauthPromise;
  // TODO: should move to function to support other providers
  const clientAuth = oauth.ClientSecretPost(provider === 'salesforce' ? ENV.AUTH_SFDC_CLIENT_SECRET : ENV.AUTH_GOOGLE_CLIENT_SECRET);
  const params = oauth.validateAuthResponse(authorizationServer, client, parameters, expectedState);

  const response = await oauth.authorizationCodeGrantRequest(
    authorizationServer,
    client,
    clientAuth,
    params,
    `${ENV.JETSTREAM_SERVER_URL}/api/auth/callback/${provider}`,
    codeVerifier,
  );

  const idTokenResult = await oauth.processAuthorizationCodeResponse(authorizationServer, client, response, {
    expectedNonce: nonce,
    requireIdToken: true,
  });

  const claims = oauth.getValidatedIdTokenClaims(idTokenResult);

  if (!claims) {
    // TODO: is there a more specific error we can throw here?
    throw new AuthError('Invalid claims');
  }

  return {
    idTokenResult,
    claims,
  };
}

async function getUserInfo({ authorizationServer, client }: OauthClientProvider, access_token: string, sub: string) {
  const oauth = await oauthPromise;
  const response = await oauth.userInfoRequest(authorizationServer, client, access_token);

  const userInfo = await oauth.processUserInfoResponse(authorizationServer, client, sub, response);
  return userInfo;
}

export async function lookupGeoLocationFromIpAddresses(
  ipAddresses: string[],
): Promise<Array<{ ipAddress: string; location: SessionIpData | null }>> {
  if (!ipAddresses || ipAddresses.length === 0) {
    return [];
  }

  if (!ENV.GEO_IP_API_USERNAME || !ENV.GEO_IP_API_PASSWORD || !ENV.GEO_IP_API_HOSTNAME) {
    return ipAddresses.map((ipAddress) => ({ ipAddress, location: null }));
  }

  try {
    const response = await fetch(`${ENV.GEO_IP_API_HOSTNAME}/api/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${ENV.GEO_IP_API_USERNAME}:${ENV.GEO_IP_API_PASSWORD}`, 'utf-8').toString('base64')}`,
      },
      body: JSON.stringify({ ips: ipAddresses }),
    });

    if (!response.ok) {
      return ipAddresses.map((ipAddress) => ({ ipAddress, location: null }));
    }

    const data = (await response.json()) as GeoIpLookupResponse;

    return data.results.map((result) => {
      if (!result.isValid) {
        return { ipAddress: result.ipAddress, location: { status: 'fail' as const, query: result.ipAddress } };
      }
      return {
        ipAddress: result.ipAddress,
        location: {
          status: 'success' as const,
          country: result.country,
          countryCode: result.countryCode,
          region: result.region,
          regionName: result.regionName,
          city: result.city,
          isp: result.isp,
          lat: result.lat,
          lon: result.lon,
          query: result.ipAddress,
        },
      };
    });
  } catch (ex) {
    logger.warn({ err: ex }, 'Geo-IP lookup failed');
    return ipAddresses.map((ipAddress) => ({ ipAddress, location: null }));
  }
}

export function initSession(
  req: Request<unknown, unknown, unknown>,
  {
    user,
    isNewUser,
    sessionDetails,
    mfaEnrollmentRequired,
    verificationRequired,
    provider,
    providerAccountId,
  }: Awaited<ReturnType<typeof handleSignInOrRegistration>>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Regenerate session to avoid session fixation attacks
    req.session.regenerate((error) => {
      try {
        if (error) {
          logger.error({ err: error }, '[AUTH][INIT_SESSION][ERROR] Error regenerating session');
          reject(new AuthError('Error initializing session'));
          return;
        }

        // Generate HMAC double CSRF token for this session
        const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);

        const userAgent = req.get('User-Agent');
        if (userAgent) {
          req.session.userAgent = userAgent;
        }

        if (sessionDetails) {
          req.session.sessionDetails = sessionDetails;
        }

        req.session.ipAddress = getApiAddressFromReq(req);
        req.session.loginTime = new Date().getTime();
        req.session.provider = provider;
        req.session.providerAccountId = providerAccountId;
        req.session.user = user;
        req.session.pendingMfaEnrollment = undefined;
        req.session.pendingVerification = undefined;
        req.session.pendingVerificationAttempts = 0;
        req.session.pendingTosAcceptance = undefined;

        // Generate and set HMAC CSRF token (same token used for both cookie and header validation)
        const csrfToken = generateHMACDoubleCSRFToken(ENV.JETSTREAM_SESSION_SECRET, req.session.id);
        req.res?.cookie(cookieConfig.doubleCSRFToken.name, csrfToken, cookieConfig.doubleCSRFToken.options);

        if (mfaEnrollmentRequired && mfaEnrollmentRequired.factor === '2fa-otp') {
          req.session.pendingMfaEnrollment = mfaEnrollmentRequired;
        }

        if (verificationRequired) {
          const token = generateRandomCode(6);
          if (isNewUser) {
            req.session.sendNewUserEmailAfterVerify = true;
          }
          if (verificationRequired.email) {
            const exp = addHours(new Date(), EMAIL_VERIFICATION_TOKEN_DURATION_HOURS).getTime();
            // If email verification is required, we can consider that as 2fa as well, so do not need to combine with other 2fa factors
            req.session.pendingVerification = [{ type: 'email', exp, token }];
          } else if (verificationRequired.twoFactor?.length > 0) {
            const exp = addMinutes(new Date(), TOKEN_DURATION_MINUTES).getTime();
            req.session.pendingVerification = verificationRequired.twoFactor.map((factor) => {
              switch (factor.type) {
                case '2fa-otp':
                  return { type: '2fa-otp', exp };
                case '2fa-email':
                  return { type: '2fa-email', exp, token };
                default:
                  throw new InvalidVerificationType('Invalid two factor type');
              }
            });
          }
        }

        // Set ToS acceptance gate for users who haven't accepted the current version.
        // Skip for placeholder/temporary sessions (e.g., email-already-in-use during registration).
        if (!sessionDetails?.isTemporary && user.tosAcceptedVersion !== CURRENT_TOS_VERSION) {
          req.session.pendingTosAcceptance = true;
        }

        resolve();
      } catch (ex) {
        logger.error({ err: ex }, '[AUTH][INIT_SESSION][ERROR] Error initializing session');
        reject(new AuthError('Error initializing session'));
      }
    });
  });
}

/**
 * If the user is updated (e.x. added to a team) this can be used to ensure the session is updated
 */
export async function refreshSessionUser(req: Request<unknown, unknown, unknown>): Promise<void> {
  if (!req.session.user) {
    throw new AuthError('User not authenticated');
  }

  const user = await findUserById_UNSAFE(req.session.user.id);
  req.session.user = user;
}

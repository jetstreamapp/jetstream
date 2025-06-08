import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { OauthProviderType, Providers, ResponseLocalsCookies, SessionIpData } from '@jetstream/auth/types';
import { parse as parseCookie } from 'cookie';
import * as crypto from 'crypto';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
import { OauthClientProvider, OauthClients } from './OauthClients';
import { AuthError, InvalidCsrfToken, InvalidVerificationToken } from './auth.errors';
import { getCookieConfig, validateCSRFToken } from './auth.utils';

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
  const oauthClients = await OauthClients.getInstance();

  const code_challenge_method = 'S256';
  /**
   * The following MUST be generated for every redirect to the authorization_endpoint. You must store
   * the code_verifier and nonce in the end-user session such that it can be recovered as the user
   * gets redirected from the authorization server back to your application.
   */
  const code_verifier = oauth.generateRandomCodeVerifier();
  const code_challenge = await oauth.calculatePKCECodeChallenge(code_verifier);
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
    nonce,
    authorizationUrl,
  };
}

export async function validateCallback(
  provider: OauthProviderType,
  parameters: URL | URLSearchParams,
  codeVerifier: string,
  nonce?: string
) {
  const oauthClients = await OauthClients.getInstance();

  const clientProvider = oauthClients[provider];
  const { claims, idTokenResult } = await handleOauthCallback(clientProvider, provider, parameters, codeVerifier, nonce);
  const userInfo = await getUserInfo(clientProvider, idTokenResult.access_token, claims.sub);

  return { claims, idTokenResult, userInfo };
}

export async function verifyCSRFFromRequestOrThrow(csrfToken: string, cookieString: string) {
  try {
    const cookieConfig = getCookieConfig(ENV.USE_SECURE_COOKIES);
    const cookies = parseCookie(cookieString);
    const cookieValue = cookies[cookieConfig.csrfToken.name];
    const validCSRFToken = await validateCSRFToken({
      secret: ENV.JETSTREAM_AUTH_SECRET,
      bodyValue: csrfToken,
      cookieValue,
    });

    if (!validCSRFToken) {
      throw new InvalidCsrfToken();
    }
  } catch (ex) {
    logger.error(getExceptionLog(ex), '[ERROR] verifyCSRFFromRequestOrThrow');
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
  const { verifyTOTP } = await osloOtpPromise;
  console.log(decodeHex(secret));
  const validOTP = verifyTOTP(decodeHex(secret), TOTP_INTERVAL_SEC, TOTP_DIGITS, code);
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
  nonce?: string
) {
  const oauth = await oauthPromise;
  // TODO: should move to function to support other providers
  const clientAuth = oauth.ClientSecretPost(provider === 'salesforce' ? ENV.AUTH_SFDC_CLIENT_SECRET : ENV.AUTH_GOOGLE_CLIENT_SECRET);
  const params = oauth.validateAuthResponse(authorizationServer, client, parameters);

  const response = await oauth.authorizationCodeGrantRequest(
    authorizationServer,
    client,
    clientAuth,
    params,
    `${ENV.JETSTREAM_SERVER_URL}/api/auth/callback/${provider}`,
    codeVerifier
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

export async function lookupGeoLocationFromIpAddresses(ipAddresses: string[]) {
  if (!ipAddresses || ipAddresses.length === 0) {
    return [];
  }
  let response: Awaited<ReturnType<typeof fetch>> | null = null;
  if (ENV.IP_API_SERVICE === 'LOCAL' && ENV.GEO_IP_API_USERNAME && ENV.GEO_IP_API_PASSWORD && ENV.GEO_IP_API_HOSTNAME) {
    response = await fetch(`${ENV.GEO_IP_API_HOSTNAME}/api/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${ENV.GEO_IP_API_USERNAME}:${ENV.GEO_IP_API_PASSWORD}`, 'utf-8').toString('base64')}`,
      },
      body: JSON.stringify({ ips: ipAddresses }),
    });
  } else if (ENV.IP_API_KEY) {
    const params = new URLSearchParams({
      fields: 'status,country,countryCode,region,regionName,city,isp,lat,lon,query',
      key: ENV.IP_API_KEY,
    });

    response = await fetch(`https://pro.ip-api.com/batch?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(ipAddresses),
    });
  }
  if (response?.ok) {
    const locations = (await response.json()) as
      | { success: true; results: SessionIpData[] }
      | { success: false; message: string; details?: string };

    if (locations.success) {
      return ipAddresses.map((ipAddress, i) => ({
        ipAddress,
        location: locations.results[i],
      }));
    }
  }
  return ipAddresses.map((ipAddress) => ({
    ipAddress,
    location: null,
  }));
}

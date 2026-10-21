import * as oauth from 'oauth4webapi';
import { ADMIN_ENV } from '../config/admin-env.config';
import { GoogleIdentityClaims } from './admin-access';

/** Static copy of https://accounts.google.com/.well-known/openid-configuration to avoid a discovery call */
const googleAuthorizationServer: oauth.AuthorizationServer = {
  issuer: 'https://accounts.google.com',
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
  code_challenge_methods_supported: ['S256'],
};

/** A separate OAuth client from the main app's, so admin sign-in can be restricted to the Workspace */
const googleClient: oauth.Client = { client_id: ADMIN_ENV.ADMIN_GOOGLE_CLIENT_ID };
const googleClientAuth = oauth.ClientSecretPost(ADMIN_ENV.ADMIN_GOOGLE_CLIENT_SECRET);

export const GOOGLE_REDIRECT_URI = `${ADMIN_ENV.ADMIN_BASE_URL}/auth/callback`;

export async function createGoogleAuthorizationRequest() {
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.generateRandomState();
  const nonce = oauth.generateRandomNonce();

  const authorizationUrl = new URL(googleAuthorizationServer.authorization_endpoint as string);
  authorizationUrl.searchParams.set('client_id', googleClient.client_id);
  authorizationUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid email profile');
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('nonce', nonce);
  authorizationUrl.searchParams.set('prompt', 'select_account');
  // Only a hint for the account chooser; the `hd` claim is what gets enforced after sign-in
  authorizationUrl.searchParams.set('hd', ADMIN_ENV.ADMIN_ALLOWED_DOMAIN);

  return { authorizationUrl, codeVerifier, state, nonce };
}

/**
 * Exchanges the authorization code and validates the ID token (issuer, audience, expiry, nonce).
 * The token arrives straight from Google's token endpoint over TLS, which OIDC accepts in place of
 * a signature check.
 */
export async function completeGoogleAuthorization(
  callbackUrl: URL,
  { codeVerifier, state, nonce }: { codeVerifier: string; state: string; nonce: string },
): Promise<GoogleIdentityClaims> {
  const callbackParameters = oauth.validateAuthResponse(googleAuthorizationServer, googleClient, callbackUrl, state);

  const response = await oauth.authorizationCodeGrantRequest(
    googleAuthorizationServer,
    googleClient,
    googleClientAuth,
    callbackParameters,
    GOOGLE_REDIRECT_URI,
    codeVerifier,
  );

  const tokenResult = await oauth.processAuthorizationCodeResponse(googleAuthorizationServer, googleClient, response, {
    expectedNonce: nonce,
    requireIdToken: true,
  });

  const claims = oauth.getValidatedIdTokenClaims(tokenResult);
  if (!claims) {
    throw new Error('Google did not return ID token claims');
  }
  return claims;
}

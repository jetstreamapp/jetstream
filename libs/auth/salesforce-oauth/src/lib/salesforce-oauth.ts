import { Maybe, SalesforceUserInfo } from '@jetstream/types';
import * as oauth from 'oauth4webapi';

type OauthParams = {
  loginUrl: string;
  clientId: string;
  /**
   * Client secret is optional for public clients
   */
  clientSecret?: string;
};

type OauthInitParams = OauthParams & {
  redirectUri: string;
  addLoginParam?: Maybe<boolean>;
  loginHint?: Maybe<string>;
};

type OauthCallbackParams = OauthParams & {
  redirectUri: string;
};

/**
 * Initialize Salesforce Auth Client and Authorization Server
 */
function getSalesforceAuthClientAndServer({ clientId, loginUrl, clientSecret }: OauthParams) {
  const url = new URL(loginUrl);
  if (!url.hostname.endsWith('.salesforce.com')) {
    throw new Error('Invalid Salesforce login URL');
  }

  /**
   * To avoid having to callout to Salesforce's discovery endpoint,
   * we are manually creating the AuthorizationServer object
   * https://login.salesforce.com/.well-known/openid-configuration
   *
   * const as = await oauth
   *   .discoveryRequest(issuer, { algorithm })
   *   .then((response) => oauth.processDiscoveryResponse(issuer, response))
   */
  const authServer: oauth.AuthorizationServer = {
    authorization_endpoint: `${loginUrl}/services/oauth2/authorize`,
    claims_supported: [
      'active',
      'address',
      'email',
      'email_verified',
      'family_name',
      'given_name',
      'is_app_installed',
      'language',
      'locale',
      'name',
      'nickname',
      'organization_id',
      'phone_number',
      'phone_number_verified',
      'photos',
      'picture',
      'preferred_username',
      'profile',
      'sub',
      'updated_at',
      'urls',
      'user_id',
      'user_type',
      'zoneinfo',
    ],
    display_values_supported: ['page', 'popup', 'touch'],
    end_session_endpoint: `${loginUrl}/services/oauth2/logout`,
    id_token_signing_alg_values_supported: ['RS256'],
    introspection_endpoint: `${loginUrl}/services/oauth2/introspect`,
    issuer: loginUrl,
    jwks_uri: `${loginUrl}/id/keys`,
    registration_endpoint: `${loginUrl}/services/oauth2/register`,
    response_types_supported: ['code', 'token', 'token id_token'],
    revocation_endpoint: `${loginUrl}/services/oauth2/revoke`,
    scopes_supported: ['openid', 'api', 'web', 'refresh_token'],
    subject_types_supported: ['public'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'private_key_jwt'],
    token_endpoint: `${loginUrl}/services/oauth2/token`,
    userinfo_endpoint: `${loginUrl}/services/oauth2/userinfo`,
  };

  const authClient: oauth.Client = {
    client_id: clientId,
  };

  const clientAuth = clientSecret ? oauth.ClientSecretPost(clientSecret) : oauth.None();

  return { authClient, authServer, clientAuth };
}

/**
 * Get redirectUrl and authData for Salesforce OAuth
 */
export async function salesforceOauthInit({
  clientId,
  clientSecret,
  loginUrl,
  redirectUri,
  addLoginParam = false,
  loginHint,
}: OauthInitParams) {
  const { authServer } = getSalesforceAuthClientAndServer({ clientId, clientSecret, loginUrl });

  const nonce = oauth.generateRandomNonce();
  const code_verifier = oauth.generateRandomCodeVerifier();
  const state = oauth.generateRandomState();
  const code_challenge = await oauth.calculatePKCECodeChallenge(code_verifier);

  const authorizationUrl = new URL(authServer.authorization_endpoint!);
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('scope', 'api web refresh_token');
  authorizationUrl.searchParams.set('prompt', 'login');
  authorizationUrl.searchParams.set('nonce', nonce);
  authorizationUrl.searchParams.set('code_challenge', code_challenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');

  if (loginHint) {
    authorizationUrl.searchParams.set('login_hint', loginHint);
  }
  if (addLoginParam) {
    authorizationUrl.searchParams.set('login', 'true');
  }

  return { code_verifier, nonce, state, authorizationUrl };
}

/**
 * Verify OAuth callback and get access_token, refresh_token, and userInfo
 */
export async function salesforceOauthCallback(
  { clientId, clientSecret, loginUrl, redirectUri }: OauthCallbackParams,
  callbackQueryParams: URLSearchParams,
  authData: {
    code_verifier: string;
    nonce: string;
    state: string;
  },
) {
  const { authClient, authServer, clientAuth } = getSalesforceAuthClientAndServer({ clientId, clientSecret, loginUrl });
  const params = oauth.validateAuthResponse(authServer, authClient, callbackQueryParams, authData.state);

  const response = await oauth.authorizationCodeGrantRequest(
    authServer,
    authClient,
    clientAuth,
    params,
    redirectUri,
    authData.code_verifier,
  );

  const tokenSet = await oauth.processAuthorizationCodeResponse(authServer, authClient, response);

  const { id, access_token, refresh_token } = tokenSet;
  if (!access_token) {
    throw new Error('Missing access_token in token response');
  }
  const userInfoResponse = await oauth.userInfoRequest(authServer, authClient, tokenSet.access_token);
  const userInfo = (await oauth.processUserInfoResponse(
    authServer,
    authClient,
    id as string,
    userInfoResponse,
  )) as unknown as SalesforceUserInfo;

  return {
    access_token,
    refresh_token,
    userInfo,
  };
}

/**
 * Refresh Salesforce OAuth access_token using refresh_token
 */
export async function salesforceOauthRefresh(
  {
    clientId,
    clientSecret,
    loginUrl,
  }: {
    loginUrl: string;
    clientId: string;
    clientSecret?: string;
  },
  refreshToken: string,
) {
  const { authClient, authServer, clientAuth } = getSalesforceAuthClientAndServer({ clientId, clientSecret, loginUrl });

  const response = await oauth.refreshTokenGrantRequest(authServer, authClient, clientAuth, refreshToken);
  const tokenSet = await oauth.processRefreshTokenResponse(authServer, authClient, response);

  const { access_token } = tokenSet;
  return {
    access_token,
  };
}

/**
 * Login to Salesforce using username and password
 *
 * This is only used in tests to get an access_token to avoid having to go through OAuth+redirect flow
 */
export async function salesforceLoginUsernamePassword_UNSAFE(
  {
    clientId,
    clientSecret,
    loginUrl,
    redirectUri,
  }: {
    clientId: string;
    clientSecret: string;
    loginUrl: string;
    redirectUri: string;
  },
  username: string,
  password: string,
): Promise<{
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}> {
  return await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username,
      password,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
  }).then((res) => res.json());
}

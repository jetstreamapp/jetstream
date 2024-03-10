import { ENV } from '@jetstream/api-config';
import { SalesforceUserInfo } from '@jetstream/types';
import { CallbackParamsType, Issuer, generators } from 'openid-client';

const AUTH_URL = 'http://localhost:8080';
const JETSTREAM_CLIENT_ID = '257550850069692419@jetstream';
const JETSTREAM_REDIRECT_URL = 'http://localhost:3333/oauth/callback';

/**
 **************
 * JETSTREAM  *
 **************
 */

const { Client: JetstreamClient } = new Issuer({
  authorization_endpoint: `${AUTH_URL}/oauth/v2/authorize`,
  end_session_endpoint: `${AUTH_URL}/oidc/v1/end_session`,
  issuer: AUTH_URL,
  jwks_uri: `${AUTH_URL}/oauth/v2/keys`,
  // registration_endpoint: `${AUTH_URL}/services/oauth2/register`,
  introspection_endpoint: `${AUTH_URL}/oauth/v2/introspect`,
  revocation_endpoint: `${AUTH_URL}/oauth/v2/revoke`,
  device_authorization_endpoint: `${AUTH_URL}/oauth/v2/device_authorization`,
  token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'private_key_jwt'],
  token_endpoint: `${AUTH_URL}/oauth/v2/token`,
  userinfo_endpoint: `${AUTH_URL}/oidc/v1/userinfo`,
});

export const jetstreamAuthClient = new JetstreamClient({
  client_id: JETSTREAM_CLIENT_ID,
  redirect_uris: [JETSTREAM_REDIRECT_URL],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  // token_endpoint_auth_signing_alg: 'RS256',
});

export function jetstreamOauthInit() {
  // ${AUTH_URL}/.well-known/openid-configuration

  const nonce = generators.nonce();
  const code_verifier = generators.codeVerifier();
  const state = generators.state();
  const code_challenge = generators.codeChallenge(code_verifier);

  const authorizationUrl = jetstreamAuthClient.authorizationUrl({
    code_challenge_method: 'S256',
    code_challenge,
    nonce,
    scope: 'openid profile email',
    state,
  });

  return { code_verifier, nonce, state, authorizationUrl };
}

export async function jetstreamOauthCallback(
  loginUrl: string,
  callbackQueryParams: CallbackParamsType,
  authData: {
    code_verifier: string;
    nonce: string;
    state: string;
  }
) {
  const tokenSet = await jetstreamAuthClient.oauthCallback(ENV.SFDC_CALLBACK_URL, callbackQueryParams, authData);
  const { access_token, id_token, token_type, ...rest } = tokenSet;
  const token = await jetstreamAuthClient.introspect(access_token!, 'access_token');
  const userInfo = await jetstreamAuthClient.userinfo(tokenSet);

  return {
    access_token,
    userInfo,
  };
}

/**
 **************
 * SALESFORCE *
 **************
 */

function getSalesforceAuthClient(loginUrl: string) {
  const { Client: SalesforceClient } = new Issuer({
    authorization_endpoint: `${loginUrl}/services/oauth2/authorize`,
    end_session_endpoint: `${loginUrl}/services/oauth2/logout`,
    issuer: loginUrl,
    jwks_uri: `${loginUrl}/id/keys`,
    registration_endpoint: `${loginUrl}/services/oauth2/register`,
    revocation_endpoint: `${loginUrl}/services/oauth2/revoke`,
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post', 'private_key_jwt'],
    token_endpoint: `${loginUrl}/services/oauth2/token`,
    userinfo_endpoint: `${loginUrl}/services/oauth2/userinfo`,
  });

  const salesforceAuthClient = new SalesforceClient({
    client_id: ENV.SFDC_CONSUMER_KEY,
    client_secret: ENV.SFDC_CONSUMER_SECRET,
    redirect_uris: [ENV.SFDC_CALLBACK_URL],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
    token_endpoint_auth_signing_alg: 'RS256',
  });
  return salesforceAuthClient;
}

/**
 * Get redirectUrl and authData for Salesforce OAuth
 */
export function salesforceOauthInit(loginUrl: string, loginHint?: string) {
  // https://login.salesforce.com/.well-known/openid-configuration

  const nonce = generators.nonce();
  const code_verifier = generators.codeVerifier();
  const state = generators.state();
  const code_challenge = generators.codeChallenge(code_verifier);

  const authClient = getSalesforceAuthClient(loginUrl);

  const authorizationUrl = authClient.authorizationUrl({
    code_challenge_method: 'S256',
    code_challenge,
    login_hint: loginHint,
    nonce,
    prompt: 'login',
    scope: 'api web refresh_token',
    state,
  });

  return { code_verifier, nonce, state, authorizationUrl };
}

/**
 * Verify OAuth callback and get access_token, refresh_token, and userInfo
 */
export async function salesforceOauthCallback(
  loginUrl: string,
  callbackQueryParams: CallbackParamsType,
  authData: {
    code_verifier: string;
    nonce: string;
    state: string;
  }
) {
  const authClient = getSalesforceAuthClient(loginUrl);

  const tokenSet = await authClient.oauthCallback(ENV.SFDC_CALLBACK_URL, callbackQueryParams, authData);
  const { access_token, refresh_token } = tokenSet;
  const userInfo = await authClient.userinfo<SalesforceUserInfo>(access_token!);

  return {
    access_token,
    refresh_token,
    userInfo,
  };
}

export async function salesforceOauthRefresh(loginUrl: string, refreshToken: string) {
  const authClient = getSalesforceAuthClient(loginUrl);
  const tokenSet = await authClient.refresh(refreshToken);
  const { access_token } = tokenSet;
  return {
    access_token,
  };
}

/**
 * Login to Salesforce using username and password
 */
export async function salesforceLoginUsernamePassword_UNSAFE(
  loginUrl: string,
  username: string,
  password: string
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
      client_id: ENV.SFDC_CONSUMER_KEY,
      client_secret: ENV.SFDC_CONSUMER_SECRET,
      redirect_uri: ENV.SFDC_CALLBACK_URL,
    }).toString(),
  }).then((res) => res.json());
}

import { ENV } from '@jetstream/api-config';
import { SalesforceUserInfo } from '@jetstream/types';
import { AuthorizationParameters, BaseClient, CallbackParamsType, Issuer, TokenSet, UserinfoResponse, generators } from 'openid-client';

export const JETSTREAM_CALLBACK_URL = `${ENV.JETSTREAM_SERVER_URL}/oauth/callback`;
export const SFDC_CALLBACK_URL = ENV.SFDC_CALLBACK_URL;

const { Client: JetstreamClient } = new Issuer({
  authorization_endpoint: `${ENV.AUTH_DOMAIN}/oidc/auth`,
  end_session_endpoint: `${ENV.AUTH_DOMAIN}/oidc/session/end`,
  issuer: `${ENV.AUTH_DOMAIN}/oidc`,
  jwks_uri: `${ENV.AUTH_DOMAIN}/oidc/jwks`,
  registration_endpoint: `${ENV.AUTH_DOMAIN}/services/oauth2/register`, // FIXME:
  introspection_endpoint: `${ENV.AUTH_DOMAIN}/oidc/token/introspection`,
  revocation_endpoint: `${ENV.AUTH_DOMAIN}/oidc/token/revocation`,
  token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'private_key_jwt'],
  token_endpoint: `${ENV.AUTH_DOMAIN}/oidc/token`,
  userinfo_endpoint: `${ENV.AUTH_DOMAIN}/oidc/me`,
});

export const jetstreamAuthClient = new JetstreamClient({
  client_id: ENV.AUTH_CLIENT_ID!,
  client_secret: ENV.AUTH_CLIENT_SECRET!,
  redirect_uris: [`${ENV.JETSTREAM_SERVER_URL}/oauth/callback`],
  response_types: ['code'],
  token_endpoint_auth_method: 'client_secret_post',
  // token_endpoint_auth_signing_alg: 'RS256',
  token_endpoint_auth_signing_alg_values_supported: ['HS256', 'RS256', 'PS256', 'ES256', 'EdDSA'],
  claims_parameter_supported: false,
  claims_supported: [
    'sub',
    'name',
    'family_name',
    'given_name',
    'middle_name',
    'nickname',
    'preferred_username',
    'profile',
    'picture',
    'website',
    'gender',
    'birthdate',
    'zoneinfo',
    'locale',
    'updated_at',
    'username',
    'created_at',
    'email',
    'email_verified',
    'phone_number',
    'phone_number_verified',
    'address',
    'custom_data',
    'identities',
    'roles',
    'organizations',
    'organization_data',
    'organization_roles',
    'sid',
    'auth_time',
    'iss',
  ],
  authorization_signed_response_alg: 'ES384',
  id_token_signing_alg_values_supported: ['ES384'],
  id_token_signed_response_alg: 'ES384',
  code_challenge_methods_supported: ['S256'],
});

function getSalesforceAuthClient(loginUrl: string) {
  const { Client } = new Issuer({
    authorization_endpoint: `${loginUrl}/services/oauth2/authorize`,
    end_session_endpoint: `${loginUrl}/services/oauth2/logout`,
    issuer: loginUrl,
    jwks_uri: `${loginUrl}/id/keys`,
    registration_endpoint: `${loginUrl}/services/oauth2/register`,
    revocation_endpoint: `${loginUrl}/services/oauth2/revoke`,
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'private_key_jwt'],
    token_endpoint: `${loginUrl}/services/oauth2/token`,
    userinfo_endpoint: `${loginUrl}/services/oauth2/userinfo`,
  });

  const authClient = new Client({
    client_id: ENV.SFDC_CONSUMER_KEY,
    client_secret: ENV.SFDC_CONSUMER_SECRET,
    redirect_uris: [ENV.SFDC_CALLBACK_URL],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
    token_endpoint_auth_signing_alg: 'RS256',
  });
  return authClient;
}

/**
 * Initialize OAuth flow and get authorizationUrl and code challenge state
 */
export function initOauthAuthorization(authClient: BaseClient, { scope, ...options }: AuthorizationParameters = {}) {
  const nonce = generators.nonce();
  const code_verifier = generators.codeVerifier();
  const state = generators.state();
  const code_challenge = generators.codeChallenge(code_verifier);

  const authorizationUrl = authClient.authorizationUrl({
    ...options,
    code_challenge_method: 'S256',
    code_challenge,
    nonce,
    scope: scope || 'openid email profile',
    state,
  });

  return { code_verifier, nonce, state, authorizationUrl };
}

/**
 * Handle OAuth callback and get access_token, refresh_token, and userInfo
 */
export async function handleOauthCallback<T extends object>(
  authClient: BaseClient,
  callbackUrl: string,
  callbackQueryParams: CallbackParamsType,
  authData: {
    code_verifier: string;
    nonce: string;
    state: string;
  }
): Promise<{ tokenSet: TokenSet; userInfo: UserinfoResponse<T, any> }> {
  const tokenSet = await authClient.callback(callbackUrl, callbackQueryParams || {}, authData);
  if (!tokenSet.access_token) {
    throw new Error('Unable to obtain accessToken');
  }
  const userInfo = await authClient.userinfo<T>(tokenSet.access_token);

  return {
    tokenSet,
    userInfo,
  };
}

export async function oauthRefreshToken(authClient: BaseClient, refreshToken: string): Promise<TokenSet> {
  const tokenSet = await authClient.refresh(refreshToken);
  return tokenSet;
}

// export async function oauthLogout(authClient: BaseClient, refreshToken: string) {
//   const tokenSet = await authClient.endSessionUrl({
//     id_token_hint
//     post_logout_redirect_uri
//     state
//     client_id
//     logout_hint
//    });
//   const { access_token, refresh_token, expires_at, expires_in } = tokenSet;
//   return { access_token, refresh_token, expires_at, expires_in };
// }

/**
 * Get redirectUrl and authData for Salesforce OAuth
 */
export function salesforceOauthInit(loginUrl: string, loginHint?: string) {
  // https://login.salesforce.com/.well-known/openid-configuration
  return initOauthAuthorization(getSalesforceAuthClient(loginUrl), { login_hint: loginHint, scope: 'api web refresh_token' });
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
  return handleOauthCallback<SalesforceUserInfo>(getSalesforceAuthClient(loginUrl), SFDC_CALLBACK_URL, callbackQueryParams, authData);
}

export async function salesforceOauthRefresh(loginUrl: string, refreshToken: string) {
  const tokenSet = await oauthRefreshToken(getSalesforceAuthClient(loginUrl), refreshToken);
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

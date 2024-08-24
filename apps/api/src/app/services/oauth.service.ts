import { ENV } from '@jetstream/api-config';
import { SalesforceUserInfo } from '@jetstream/types';
import { AuthorizationParameters, CallbackParamsType, Issuer, generators } from 'openid-client';

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
 * Get redirectUrl and authData for Salesforce OAuth
 */
export function salesforceOauthInit(
  loginUrl: string,
  { loginHint, addLoginParam = false }: { addLoginParam?: boolean; loginHint?: string } = {}
) {
  // https://login.salesforce.com/.well-known/openid-configuration

  const nonce = generators.nonce();
  const code_verifier = generators.codeVerifier();
  const state = generators.state();
  const code_challenge = generators.codeChallenge(code_verifier);

  const authClient = getSalesforceAuthClient(loginUrl);

  const params: AuthorizationParameters = {
    code_challenge_method: 'S256',
    code_challenge,
    login_hint: loginHint,
    nonce,
    prompt: 'login',
    scope: 'api web refresh_token',
    state,
  };

  if (addLoginParam) {
    params['login'] = 'true';
  }

  const authorizationUrl = authClient.authorizationUrl(params);

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

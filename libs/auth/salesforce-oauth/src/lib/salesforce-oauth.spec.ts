import { authorizationCodeGrantRequest, OperationProcessingError, ResponseBodyError, userInfoRequest } from 'oauth4webapi';
import { salesforceOauthCallback, salesforceOauthInit } from './salesforce-oauth';

vi.mock('oauth4webapi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('oauth4webapi')>();
  return {
    ...actual,
    authorizationCodeGrantRequest: vi.fn(),
    userInfoRequest: vi.fn(),
  };
});

describe('Salesforce OAuth', () => {
  it('salesforceOauthInit should work with login hint', async () => {
    const { authorizationUrl, code_verifier, nonce, state } = await salesforceOauthInit({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
      loginUrl: 'https://login.salesforce.com',
      addLoginParam: true,
      loginHint: 'test@test.com',
    });

    expect(authorizationUrl.hostname).toEqual('login.salesforce.com');
    expect(authorizationUrl.pathname).toEqual('/services/oauth2/authorize');

    expect(authorizationUrl.searchParams.get('client_id')).toEqual('test-client-id');
    expect(authorizationUrl.searchParams.get('redirect_uri')).toEqual('https://example.com/callback');
    expect(authorizationUrl.searchParams.get('response_type')).toEqual('code');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toEqual('S256');
    expect(authorizationUrl.searchParams.get('code_challenge')).toBeDefined();
    expect(authorizationUrl.searchParams.get('nonce')).toEqual(nonce);
    expect(authorizationUrl.searchParams.get('state')).toEqual(state);
    expect(code_verifier).toBeDefined();
    expect(authorizationUrl.searchParams.get('login')).toEqual('true');
    expect(authorizationUrl.searchParams.get('login_hint')).toEqual('test@test.com');
  });

  it('salesforceOauthInit should work without login hint', async () => {
    const { authorizationUrl, code_verifier, nonce, state } = await salesforceOauthInit({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
      loginUrl: 'https://login.salesforce.com',
    });

    expect(authorizationUrl.hostname).toEqual('login.salesforce.com');
    expect(authorizationUrl.pathname).toEqual('/services/oauth2/authorize');

    expect(authorizationUrl.searchParams.get('client_id')).toEqual('test-client-id');
    expect(authorizationUrl.searchParams.get('redirect_uri')).toEqual('https://example.com/callback');
    expect(authorizationUrl.searchParams.get('response_type')).toEqual('code');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toEqual('S256');
    expect(authorizationUrl.searchParams.get('code_challenge')).toBeDefined();
    expect(authorizationUrl.searchParams.get('nonce')).toEqual(nonce);
    expect(authorizationUrl.searchParams.get('state')).toEqual(state);
    expect(code_verifier).toBeDefined();
    expect(authorizationUrl.searchParams.get('login')).toEqual(null);
    expect(authorizationUrl.searchParams.get('login_hint')).toEqual(null);
  });

  it('Salesforce OAuth End-to-end flow', async () => {
    vi.mocked(authorizationCodeGrantRequest).mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'test-access_token',
          refresh_token: 'test-refresh_token',
          signature: 'test-signature',
          scope: 'refresh_token web api',
          instance_url: 'https://test.my.salesforce.com',
          id: 'https://login.salesforce.com/id/00D6g000008KX1jEAG/0056g000001yApbAAE',
          token_type: 'bearer',
          issued_at: new Date().getTime().toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    vi.mocked(userInfoRequest).mockResolvedValue(
      new Response(
        JSON.stringify({
          sub: 'https://login.salesforce.com/id/00D6g000008KX1jEAG/0056g000001yApbAAE',
          email: 'test@test.com',
          email_verified: true,
          name: 'test-name',
          preferred_username: 'test-username',
          organization_id: 'test-organization-id',
          user_id: 'test-user-id',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const params = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
      loginUrl: 'https://login.salesforce.com',
    };

    const { code_verifier, nonce, state } = await salesforceOauthInit(params);

    const result = await salesforceOauthCallback(params, new URLSearchParams({ code: 'test-code', state }), {
      code_verifier,
      nonce,
      state,
    });

    expect(result.access_token).toEqual('test-access_token');
    expect(result.refresh_token).toEqual('test-refresh_token');
    expect(result.userInfo).toEqual({
      email_verified: true,
      email: 'test@test.com',
      name: 'test-name',
      organization_id: 'test-organization-id',
      preferred_username: 'test-username',
      sub: 'https://login.salesforce.com/id/00D6g000008KX1jEAG/0056g000001yApbAAE',
      user_id: 'test-user-id',
    });
  });

  it('Salesforce OAuth End-to-end flow - code validation error', async () => {
    vi.mocked(authorizationCodeGrantRequest).mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'code_verification_failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const params = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
      loginUrl: 'https://login.salesforce.com',
    };

    const { code_verifier, nonce, state } = await salesforceOauthInit(params);
    const result = salesforceOauthCallback(params, new URLSearchParams({ code: 'test-code', state }), {
      code_verifier,
      nonce,
      state,
    });

    const responseError = await result.catch((e) => e);

    await expect(result).rejects.toThrowError(/server responded with an error in the response body/);

    expect(responseError).toBeInstanceOf(ResponseBodyError);
  });

  it('Salesforce OAuth End-to-end flow - userInfo error', async () => {
    vi.mocked(authorizationCodeGrantRequest).mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'test-access_token',
          refresh_token: 'test-refresh_token',
          signature: 'test-signature',
          scope: 'refresh_token web api',
          instance_url: 'https://test.my.salesforce.com',
          id: 'https://login.salesforce.com/id/00D6g000008KX1jEAG/0056g000001yApbAAE',
          token_type: 'bearer',
          issued_at: new Date().getTime().toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    vi.mocked(userInfoRequest).mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'code_verification_failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const params = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
      loginUrl: 'https://login.salesforce.com',
    };

    const { code_verifier, nonce, state } = await salesforceOauthInit(params);
    const result = salesforceOauthCallback(params, new URLSearchParams({ code: 'test-code', state }), {
      code_verifier,
      nonce,
      state,
    });

    const responseError = await result.catch((e) => e);

    await expect(result).rejects.toThrowError(`"response" is not a conform UserInfo Endpoint response (unexpected HTTP status code)`);

    expect(responseError).toBeInstanceOf(OperationProcessingError);
  });
});

import { salesforceOauthExchangeScratchOrgAuthCode, ScratchOrgAuthCodeExchangeError } from './salesforce-oauth';

const PARAMS = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'https://example.com/callback',
  loginUrl: 'https://scratch-1234.scratch.my.salesforce.com',
  authCode: 'test-auth-code',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('salesforceOauthExchangeScratchOrgAuthCode', () => {
  it('exchanges the auth code and identifies the scratch org user', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        instance_url: 'https://scratch-1234.scratch.my.salesforce.com',
        id: 'https://test.salesforce.com/id/00D6g000008KX1jEAG/0056g000001yApbAAE',
      }),
    );

    const result = await salesforceOauthExchangeScratchOrgAuthCode({ ...PARAMS, fetchFn });

    expect(result).toEqual({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      instanceUrl: 'https://scratch-1234.scratch.my.salesforce.com',
      organizationId: '00D6g000008KX1jEAG',
      userId: '0056g000001yApbAAE',
    });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://scratch-1234.scratch.my.salesforce.com/services/oauth2/token');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(Object.fromEntries(init.body.entries())).toEqual({
      grant_type: 'authorization_code',
      code: 'test-auth-code',
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      redirect_uri: 'https://example.com/callback',
    });
  });

  it('omits the client secret for a public client', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'test-access-token',
        instance_url: 'https://scratch-1234.scratch.my.salesforce.com',
        id: 'https://test.salesforce.com/id/00D6g000008KX1jEAG/0056g000001yApbAAE',
      }),
    );

    const result = await salesforceOauthExchangeScratchOrgAuthCode({ ...PARAMS, clientSecret: undefined, fetchFn });

    expect(result.refresh_token).toBeUndefined();
    expect(fetchFn.mock.calls[0][1].body.has('client_secret')).toBe(false);
  });

  it('refuses a login url that is not Salesforce without making a request', async () => {
    const fetchFn = vi.fn();

    await expect(salesforceOauthExchangeScratchOrgAuthCode({ ...PARAMS, loginUrl: 'https://evil.example.com', fetchFn })).rejects.toThrow(
      'Invalid Salesforce login URL',
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports a refusal from Salesforce as final', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'invalid_grant', error_description: 'expired authorization code' }, 400));

    const error = await salesforceOauthExchangeScratchOrgAuthCode({ ...PARAMS, fetchFn }).catch((ex) => ex);

    expect(error).toBeInstanceOf(ScratchOrgAuthCodeExchangeError);
    expect(error.message).toBe('expired authorization code');
    expect(error.error).toBe('invalid_grant');
    expect(error.isUnreachable).toBe(false);
  });

  it('reports a scratch org that cannot be reached as something to try again', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    const error = await salesforceOauthExchangeScratchOrgAuthCode({ ...PARAMS, fetchFn }).catch((ex) => ex);

    expect(error).toBeInstanceOf(ScratchOrgAuthCodeExchangeError);
    expect(error.isUnreachable).toBe(true);
  });

  it('treats a server error without a JSON body as unreachable', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>Service Unavailable</html>', { status: 503 }));

    const error = await salesforceOauthExchangeScratchOrgAuthCode({ ...PARAMS, fetchFn }).catch((ex) => ex);

    expect(error.isUnreachable).toBe(true);
    expect(error.message).toContain('503');
  });

  it('fails when the token response does not identify the user', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'test-access-token',
        instance_url: 'https://scratch-1234.scratch.my.salesforce.com',
        id: 'https://test.salesforce.com/',
      }),
    );

    await expect(salesforceOauthExchangeScratchOrgAuthCode({ ...PARAMS, fetchFn })).rejects.toThrow('did not identify');
  });

  it.each(['http://scratch-1234.scratch.my.salesforce.com', 'https://evil.example.com', 'javascript:alert(1)'])(
    'refuses tokens for an instance url that is not a Salesforce https host (%s)',
    async (instanceUrl) => {
      const fetchFn = vi.fn().mockResolvedValue(
        jsonResponse({
          access_token: 'test-access-token',
          instance_url: instanceUrl,
          id: 'https://test.salesforce.com/id/00D6g000008KX1jEAG/0056g000001yApbAAE',
        }),
      );

      await expect(salesforceOauthExchangeScratchOrgAuthCode({ ...PARAMS, fetchFn })).rejects.toThrow('unexpected response');
    },
  );

  it('reports a successful status without a usable body as a readable error', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 }));

    const error = await salesforceOauthExchangeScratchOrgAuthCode({ ...PARAMS, fetchFn }).catch((ex) => ex);

    expect(error).toBeInstanceOf(ScratchOrgAuthCodeExchangeError);
    expect(error.message).toBe('Salesforce returned an unexpected response to the token request');
  });
});

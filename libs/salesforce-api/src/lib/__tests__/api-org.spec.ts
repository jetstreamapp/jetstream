import { describe, expect, it, vi } from 'vitest';
import { ApiOrg } from '../api-org';
import { ApiConnection } from '../connection';

const INSTANCE_URL = 'https://test.my.salesforce.com';
const ONE_TIME_URL = `${INSTANCE_URL}/secur/frontdoor.jsp?otp=one-time-code&cshc=abc`;

function createApiOrg(apiRequest = vi.fn().mockResolvedValue({ frontdoor_uri: ONE_TIME_URL })) {
  const logger = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const apiOrg = new ApiOrg({
    apiRequest,
    sessionInfo: {
      accessToken: 'test-token',
      instanceUrl: INSTANCE_URL,
      apiVersion: '65.0',
      userId: 'test-user-id',
      organizationId: 'test-org-id',
    },
    logger,
  } as unknown as ApiConnection);
  return { apiOrg, apiRequest, logger };
}

function getRequestedUrl(apiRequest: ReturnType<typeof vi.fn>) {
  return new URL(apiRequest.mock.calls[0][0].url);
}

describe('ApiOrg.getFrontdoorLoginUrl', () => {
  it('returns the one-time frontdoor url from the single access endpoint', async () => {
    const { apiOrg, apiRequest } = createApiOrg();

    const url = await apiOrg.getFrontdoorLoginUrl('/lightning/setup/SetupOneHome/home');

    expect(url).toBe(ONE_TIME_URL);
    expect(url).not.toContain('test-token');
    const requestedUrl = getRequestedUrl(apiRequest);
    expect(requestedUrl.origin + requestedUrl.pathname).toBe(`${INSTANCE_URL}/services/oauth2/singleaccess`);
    expect(requestedUrl.searchParams.get('redirect_uri')).toBe('/lightning/setup/SetupOneHome/home');
  });

  it.each([undefined, null, ''])('omits redirect_uri when no return path is given (%s)', async (returnUrl) => {
    const { apiOrg, apiRequest } = createApiOrg();

    await apiOrg.getFrontdoorLoginUrl(returnUrl);

    expect(getRequestedUrl(apiRequest).searchParams.has('redirect_uri')).toBe(false);
  });

  it.each(['https://evil.example/', '//evil.example/', '/\\evil.example', 'javascript:alert(1)', 'lightning/page/home', '/a\nb'])(
    'omits redirect_uri when the return path is not host-relative (%s)',
    async (returnUrl) => {
      const { apiOrg, apiRequest } = createApiOrg();

      await apiOrg.getFrontdoorLoginUrl(returnUrl);

      expect(getRequestedUrl(apiRequest).searchParams.has('redirect_uri')).toBe(false);
    },
  );

  describe('falls back to a plain link to the org, without the session', () => {
    it('when the single access endpoint refuses the request', async () => {
      const { apiOrg, logger } = createApiOrg(vi.fn().mockRejectedValue(new Error('No_Access')));

      const url = await apiOrg.getFrontdoorLoginUrl('/lightning/setup/SetupOneHome/home?tab=1');

      expect(url).toBe(`${INSTANCE_URL}/lightning/setup/SetupOneHome/home?tab=1`);
      expect(url).not.toContain('test-token');
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it.each([{}, { frontdoor_uri: 'https://evil.example/secur/frontdoor.jsp?otp=x' }, { frontdoor_uri: 42 }])(
      'when the response has no frontdoor url on the org instance (%o)',
      async (response) => {
        const { apiOrg } = createApiOrg(vi.fn().mockResolvedValue(response));

        const url = await apiOrg.getFrontdoorLoginUrl('/home/home.jsp');

        expect(url).toBe(`${INSTANCE_URL}/home/home.jsp`);
      },
    );

    it.each([undefined, 'https://evil.example/', '//evil.example/'])(
      'to the org root when the return path is missing or not host-relative (%s)',
      async (returnUrl) => {
        const { apiOrg } = createApiOrg(vi.fn().mockRejectedValue(new Error('No_Access')));

        const url = await apiOrg.getFrontdoorLoginUrl(returnUrl);

        expect(url).toBe(`${INSTANCE_URL}/`);
      },
    );
  });
});

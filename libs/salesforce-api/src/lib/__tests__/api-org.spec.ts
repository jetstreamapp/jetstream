import { describe, expect, it, vi } from 'vitest';
import { ApiOrg } from '../api-org';
import { ApiConnection } from '../connection';

function createApiOrg() {
  return new ApiOrg({
    apiRequest: vi.fn(),
    sessionInfo: {
      accessToken: 'test-token',
      instanceUrl: 'https://test.my.salesforce.com',
      apiVersion: '65.0',
      userId: 'test-user-id',
      organizationId: 'test-org-id',
    },
    logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as ApiConnection);
}

describe('ApiOrg.getFrontdoorLoginUrl', () => {
  it('forwards a host-relative return path as retURL', () => {
    const url = new URL(createApiOrg().getFrontdoorLoginUrl('/lightning/setup/SetupOneHome/home'));

    expect(url.origin + url.pathname).toBe('https://test.my.salesforce.com/secur/frontdoor.jsp');
    expect(url.searchParams.get('sid')).toBe('test-token');
    expect(url.searchParams.get('retURL')).toBe('/lightning/setup/SetupOneHome/home');
  });

  it.each([undefined, null, ''])('omits retURL when no return path is given (%s)', (returnUrl) => {
    const url = new URL(createApiOrg().getFrontdoorLoginUrl(returnUrl));

    expect(url.searchParams.has('retURL')).toBe(false);
  });

  it.each(['https://evil.example/', '//evil.example/', '/\\evil.example', 'javascript:alert(1)', 'lightning/page/home', '/a\nb'])(
    'omits retURL when the return path is not host-relative (%s)',
    (returnUrl) => {
      const url = new URL(createApiOrg().getFrontdoorLoginUrl(returnUrl));

      expect(url.searchParams.has('retURL')).toBe(false);
      expect(url.searchParams.get('sid')).toBe('test-token');
    },
  );
});

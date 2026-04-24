import { describe, expect, it, vi, beforeEach } from 'vitest';
import { oidcService } from '../oidc.service';

const userInfoRequestMock = vi.fn();
const processUserInfoResponseMock = vi.fn();

// Mock oauth4webapi dynamic import
vi.mock('oauth4webapi', async () => {
  const actual = await vi.importActual<typeof import('oauth4webapi')>('oauth4webapi');
  return {
    ...actual,
    generateRandomCodeVerifier: () => 'verifier-1234567890',
    calculatePKCECodeChallenge: async () => 'challenge-abc',
    generateRandomState: () => 'state-123',
    generateRandomNonce: () => 'nonce-123',
    discoveryRequest: vi.fn(async () =>
      new Response(
        JSON.stringify({
          issuer: 'https://issuer.test',
          authorization_endpoint: 'https://issuer.test/auth',
          token_endpoint: 'https://issuer.test/token',
          jwks_uri: 'https://issuer.test/jwks',
        }),
        { status: 200 },
      ),
    ),
    processDiscoveryResponse: vi.fn(async (_issuer, res) => {
      const json = await res.json();
      return {
        issuer: json.issuer,
        authorization_endpoint: json.authorization_endpoint,
        token_endpoint: json.token_endpoint,
        jwks_uri: json.jwks_uri,
      } as any;
    }),
    userInfoRequest: (...args: unknown[]) => userInfoRequestMock(...args),
    processUserInfoResponse: (...args: unknown[]) => processUserInfoResponseMock(...args),
  };
});

const baseConfig = {
  issuer: 'https://issuer.test',
  clientId: 'client-123',
  clientSecret: 'secret',
  authorizationEndpoint: 'https://issuer.test/auth',
  tokenEndpoint: 'https://issuer.test/token',
  jwksUri: 'https://issuer.test/jwks',
  scopes: ['openid', 'email'],
  responseType: 'code',
  attributeMapping: { email: 'email' },
  name: 'Test',
  id: '1',
  loginConfigId: 'team',
  userinfoEndpoint: null,
  endSessionEndpoint: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

const attributeMapping = { email: 'email' };

describe('oidcService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('caches discovery results per issuer', async () => {
    const first = await oidcService.discoverOidcConfiguration('https://issuer.test');
    const second = await oidcService.discoverOidcConfiguration('https://issuer.test');

    expect(first).toBe(second); // same cached object
  });

  it('produces auth URL with PKCE parameters', async () => {
    const { url, codeVerifier, state, nonce } = await oidcService.getAuthorizationUrl(baseConfig, 'team-1');

    const parsed = new URL(url);
    expect(parsed.searchParams.get('client_id')).toBe('client-123');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
    expect(codeVerifier.length).toBeGreaterThan(10);
    expect(state.length).toBeGreaterThan(5);
    expect(nonce.length).toBeGreaterThan(5);
  });

  describe('extractUserInfo email_verified handling', () => {
    beforeEach(() => {
      userInfoRequestMock.mockReset();
      processUserInfoResponseMock.mockReset();
    });

    it('accepts claims when email_verified is true', async () => {
      const claims = {
        sub: 'user-abc',
        email: 'user@example.com',
        email_verified: true,
      } as any;

      const userInfo = await oidcService.extractUserInfo(baseConfig, claims, undefined, attributeMapping);
      expect(userInfo.email).toBe('user@example.com');
      expect(userInfo.subject).toBe('user-abc');
    });

    it('accepts claims when email_verified is missing (Azure AD workforce case)', async () => {
      const claims = {
        sub: 'user-abc',
        email: 'user@contoso.com',
        // email_verified intentionally omitted — Entra ID / Azure AD workforce does not send it
      } as any;

      const userInfo = await oidcService.extractUserInfo(baseConfig, claims, undefined, attributeMapping);
      expect(userInfo.email).toBe('user@contoso.com');
    });

    it('rejects login when ID token email_verified is explicitly false', async () => {
      const claims = {
        sub: 'user-abc',
        email: 'user@example.com',
        email_verified: false,
      } as any;

      await expect(oidcService.extractUserInfo(baseConfig, claims, undefined, attributeMapping)).rejects.toThrow(
        /email address as unverified/i,
      );
    });

    it('rejects when userinfo endpoint returns email_verified=false even if ID token had true', async () => {
      // Userinfo merges AFTER the ID token; the userinfo value wins (most-current authoritative view).
      userInfoRequestMock.mockResolvedValue(new Response('{}', { status: 200 }));
      processUserInfoResponseMock.mockResolvedValue({
        email: 'user@example.com',
        email_verified: false,
      });

      const configWithUserinfo = { ...baseConfig, userinfoEndpoint: 'https://issuer.test/userinfo' };
      // Seed discovery cache with a userinfo_endpoint so extractUserInfo fetches it.
      const oauth = await import('oauth4webapi');
      (oauth.discoveryRequest as any).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            issuer: 'https://issuer.test',
            authorization_endpoint: 'https://issuer.test/auth',
            token_endpoint: 'https://issuer.test/token',
            jwks_uri: 'https://issuer.test/jwks',
            userinfo_endpoint: 'https://issuer.test/userinfo',
          }),
          { status: 200 },
        ),
      );
      (oauth.processDiscoveryResponse as any).mockImplementationOnce(async (_issuer: unknown, res: Response) => {
        const json = await res.json();
        return {
          issuer: json.issuer,
          authorization_endpoint: json.authorization_endpoint,
          token_endpoint: json.token_endpoint,
          jwks_uri: json.jwks_uri,
          userinfo_endpoint: json.userinfo_endpoint,
        } as any;
      });
      // Bust the discovery cache by using a fresh issuer URL.
      const freshConfig = { ...configWithUserinfo, issuer: 'https://issuer-userinfo-false.test' };

      const claims = {
        sub: 'user-abc',
        email: 'user@example.com',
        email_verified: true,
      } as any;

      await expect(oidcService.extractUserInfo(freshConfig, claims, 'access-token', attributeMapping)).rejects.toThrow(
        /email address as unverified/i,
      );
    });
  });
});

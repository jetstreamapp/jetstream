import { describe, expect, it, vi, beforeEach } from 'vitest';
import { oidcService } from '../oidc.service';

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
  };
});

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
    const config = {
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

    const { url, codeVerifier, state, nonce } = await oidcService.getAuthorizationUrl(config, 'team-1');

    const parsed = new URL(url);
    expect(parsed.searchParams.get('client_id')).toBe('client-123');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
    expect(codeVerifier.length).toBeGreaterThan(10);
    expect(state.length).toBeGreaterThan(5);
    expect(nonce.length).toBeGreaterThan(5);
  });
});

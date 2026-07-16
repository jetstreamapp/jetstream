import { describe, expect, it } from 'vitest';
import { OidcConfigurationRequestSchema } from '../auth-types';

/**
 * OIDC save-request schema.
 *
 * Regression guard for the "OIDC config save fails with a ZodError" bug: an admin providing only
 * the issuer (relying on server-side discovery to resolve the endpoints) must pass validation. The
 * IdP endpoints (authorizationEndpoint / tokenEndpoint / jwksUri / userinfoEndpoint /
 * endSessionEndpoint) are resolved server-side, so they are optional/nullable on the wire.
 */
describe('OidcConfigurationRequestSchema', () => {
  const baseRequest = {
    name: 'JumpCloud SSO',
    issuer: 'https://oauth.id.jumpcloud.com/',
    clientId: 'client-abc',
    clientSecret: 'super-secret',
    attributeMapping: { email: 'email', userName: 'email', firstName: 'given_name', lastName: 'family_name' },
  };

  it('accepts a request with no endpoints (endpoints are resolved server-side from the issuer)', () => {
    const result = OidcConfigurationRequestSchema.safeParse(baseRequest);
    expect(result.success).toBe(true);
  });

  it('accepts a request with null endpoints (client sends null when auto-discover was not run)', () => {
    const result = OidcConfigurationRequestSchema.safeParse({
      ...baseRequest,
      authorizationEndpoint: null,
      tokenEndpoint: null,
      userinfoEndpoint: null,
      jwksUri: null,
      endSessionEndpoint: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a request with valid discovered endpoint URLs (the auto-discover preview path)', () => {
    const result = OidcConfigurationRequestSchema.safeParse({
      ...baseRequest,
      authorizationEndpoint: 'https://oauth.id.jumpcloud.com/oauth2/auth',
      tokenEndpoint: 'https://oauth.id.jumpcloud.com/oauth2/token',
      jwksUri: 'https://oauth.id.jumpcloud.com/.well-known/jwks.json',
    });
    expect(result.success).toBe(true);
  });

  it('still rejects a non-URL endpoint when one is provided', () => {
    const result = OidcConfigurationRequestSchema.safeParse({ ...baseRequest, authorizationEndpoint: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('still requires the core fields (issuer must be a valid URL)', () => {
    const { issuer, ...withoutIssuer } = baseRequest;
    expect(OidcConfigurationRequestSchema.safeParse(withoutIssuer).success).toBe(false);
    expect(OidcConfigurationRequestSchema.safeParse({ ...baseRequest, issuer: 'not-a-url' }).success).toBe(false);
    expect(OidcConfigurationRequestSchema.safeParse({ ...baseRequest, name: '' }).success).toBe(false);
  });
});

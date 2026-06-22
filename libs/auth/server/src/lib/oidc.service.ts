/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ENV, logger } from '@jetstream/api-config';
import type { OidcConfiguration } from '@jetstream/prisma';
import { fetchWithPinnedPublicIp } from '@jetstream/shared/node-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { LRUCache } from 'lru-cache';
import * as oauth from 'oauth4webapi';
import { decryptSecret } from './sso-crypto.util';
import { AttributeMapping, DiscoveredOidcConfig, SsoUserInfo } from './sso.types';

const discoveryCache = new LRUCache<string, oauth.AuthorizationServer>({ max: 100, ttl: 1000 * 60 * 60 });

type OidcCustomFetch = (url: string, options: oauth.CustomFetchOptions<string, BodyInit | null | undefined>) => Promise<Response>;

/**
 * Builds an oauth4webapi `customFetch` that pins every request to a freshly-validated public IP
 * for the request URL's host. This covers the issuer (discovery) AND every discovered endpoint
 * (token_endpoint, userinfo_endpoint, jwks_uri) — whichever URL oauth4webapi decides to call is
 * re-validated and the connection is pinned to the validated address, closing the DNS-rebinding
 * TOCTOU window (the validated IP is the IP actually connected to).
 *
 * In dev/CI (USE_SECURE_COOKIES=false) we skip pinning so local/loopback IdPs remain reachable,
 * mirroring the SAML/file-verification fetch gating in team.controller.ts.
 */
function createPinnedCustomFetch(): OidcCustomFetch {
  return async (url, options) => {
    const fetchInit: RequestInit = {
      body: options.body,
      headers: options.headers,
      method: options.method,
      redirect: options.redirect,
      signal: options.signal,
    };
    // In prod, pin to a validated public IP (SSRF defense). `fetchWithPinnedPublicIp` uses undici's
    // own `fetch` so the pinned dispatcher and the fetch implementation are the same undici instance;
    // the global `fetch` would reject the foreign dispatcher with `invalid onRequestStart method`.
    // In dev/CI we skip pinning so local/loopback IdPs remain reachable.
    if (ENV.USE_SECURE_COOKIES) {
      return fetchWithPinnedPublicIp(url, fetchInit);
    }
    return fetch(url, fetchInit);
  };
}

export class OidcService {
  /**
   * Discover OIDC configuration from issuer
   * Uses oauth4webapi (same as existing OAuth implementation)
   */
  async discoverOidcConfiguration(issuer: string): Promise<oauth.AuthorizationServer> {
    try {
      const issuerUrl = new URL(issuer);

      // Check cache first
      const cached = discoveryCache.get(issuerUrl.toString());
      if (cached) {
        return cached;
      }

      // SSRF protection: re-check at runtime (not just at save time) so DNS rebinding
      // against a previously-public issuer cannot reach internal infrastructure. The pinned
      // customFetch resolves+validates the host once and connects to that exact IP, so the
      // address validated is the address fetched (no rebind window between check and fetch).
      // In dev/CI we allow insecure requests (loopback/private), so pinning is skipped there too.
      const response = await oauth.discoveryRequest(issuerUrl, {
        [oauth.allowInsecureRequests]: !ENV.USE_SECURE_COOKIES,
        [oauth.customFetch]: createPinnedCustomFetch(),
      });
      const authServer = await oauth.processDiscoveryResponse(issuerUrl, response);

      // Cache the result
      discoveryCache.set(issuerUrl.toString(), authServer);

      return authServer;
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      logger.error({ error, cause, issuer }, 'OIDC discovery failed');
      throw new Error(`OIDC discovery failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Generate authorization URL with PKCE for OIDC login
   * Stores code verifier, state, and nonce in cookie for later validation
   */
  async getAuthorizationUrl(
    config: OidcConfiguration,
    teamId: string,
  ): Promise<{ url: string; codeVerifier: string; state: string; nonce: string }> {
    const authServer = await this.discoverOidcConfiguration(config.issuer);
    const client: oauth.Client = {
      client_id: config.clientId,
      token_endpoint_auth_method: 'client_secret_post',
    };

    const code_verifier = oauth.generateRandomCodeVerifier();
    const code_challenge = await oauth.calculatePKCECodeChallenge(code_verifier);
    const code_challenge_method = 'S256';
    const state = oauth.generateRandomState();
    const nonce = oauth.generateRandomNonce();

    const authorizationUrl = new URL(authServer.authorization_endpoint!);
    authorizationUrl.searchParams.set('client_id', client.client_id);
    authorizationUrl.searchParams.set('redirect_uri', `${ENV.JETSTREAM_SERVER_URL}/api/auth/sso/oidc/${teamId}/callback`);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', config.scopes.join(' '));
    authorizationUrl.searchParams.set('code_challenge', code_challenge);
    authorizationUrl.searchParams.set('code_challenge_method', code_challenge_method);
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('nonce', nonce);

    return {
      url: authorizationUrl.toString(),
      codeVerifier: code_verifier,
      state,
      nonce,
    };
  }

  /**
   * Validate OIDC callback and exchange code for tokens
   * Follows the same pattern as existing OAuth implementation
   */
  async validateOidcCallback(
    config: OidcConfiguration,
    teamId: string,
    currentUrl: URL | URLSearchParams,
    expectedState: string,
    codeVerifier: string,
    expectedNonce?: string,
  ): Promise<{ claims: oauth.IDToken; idTokenResult: oauth.TokenEndpointResponse }> {
    const authServer = await this.discoverOidcConfiguration(config.issuer);
    const client: oauth.Client = {
      client_id: config.clientId,
      token_endpoint_auth_method: 'client_secret_post',
    };

    try {
      // Use ClientSecretPost for authentication (matches existing OAuth)
      const clientAuth = oauth.ClientSecretPost(decryptSecret(config.clientSecret));

      // Validate authorization response
      const params = oauth.validateAuthResponse(authServer, client, currentUrl, expectedState);

      // Exchange code for tokens
      const response = await oauth.authorizationCodeGrantRequest(
        authServer,
        client,
        clientAuth,
        params,
        `${ENV.JETSTREAM_SERVER_URL}/api/auth/sso/oidc/${teamId}/callback`,
        codeVerifier,
        {
          [oauth.allowInsecureRequests]: !ENV.USE_SECURE_COOKIES,
          [oauth.customFetch]: createPinnedCustomFetch(),
        },
      );

      // Process the token response (for OpenID Connect)
      const idTokenResult = await oauth.processAuthorizationCodeResponse(authServer, client, response, {
        expectedNonce,
        requireIdToken: true,
      });

      const claims = oauth.getValidatedIdTokenClaims(idTokenResult);

      if (!claims) {
        throw new Error('Invalid ID token claims');
      }

      return {
        idTokenResult,
        claims,
      };
    } catch (error) {
      logger.error({ error, teamId }, 'OIDC callback validation failed');
      throw new Error(`OIDC validation failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Extract user info from token response
   * Uses both ID token claims and userinfo endpoint (if available)
   */
  async extractUserInfo(
    config: OidcConfiguration,
    claims: oauth.IDToken,
    accessToken: string | undefined,
    attributeMapping: AttributeMapping,
  ): Promise<SsoUserInfo> {
    const authServer = await this.discoverOidcConfiguration(config.issuer);
    const client: oauth.Client = {
      client_id: config.clientId,
      token_endpoint_auth_method: 'client_secret_post',
    };

    try {
      // Start with claims from ID token
      let allClaims: Record<string, any> = { ...claims };

      // Optionally fetch from userinfo endpoint for additional claims
      if (authServer.userinfo_endpoint && accessToken) {
        const response = await oauth.userInfoRequest(authServer, client, accessToken, {
          [oauth.allowInsecureRequests]: !ENV.USE_SECURE_COOKIES,
          [oauth.customFetch]: createPinnedCustomFetch(),
        });
        const userinfoResponse = await oauth.processUserInfoResponse(authServer, client, claims.sub, response);
        allClaims = { ...allClaims, ...userinfoResponse };
      }

      // OIDC `email_verified` is optional: Azure AD workforce and other enterprise IdPs
      // legitimately omit it. Trust boundary here is the customer-configured IdP plus the
      // team-verified domain check in sso-auth.service; we only reject the explicit-false
      // case where a compliant IdP tells us the email is not verified.
      if (allClaims.email_verified === false) {
        logger.warn({ sub: claims.sub, issuer: config.issuer }, '[SSO][OIDC] Rejecting login: provider reported email_verified=false');
        throw new Error('OIDC provider reported the email address as unverified');
      }

      // Extract user info using attribute mapping with fallbacks to standard claims
      const email = allClaims[attributeMapping.email] || allClaims.email;
      const userName =
        (attributeMapping.userName && allClaims[attributeMapping.userName]) || allClaims.preferred_username || allClaims.email;
      const firstName = attributeMapping.firstName ? allClaims[attributeMapping.firstName] : allClaims.given_name;
      const lastName = attributeMapping.lastName ? allClaims[attributeMapping.lastName] : allClaims.family_name;
      if (!email) {
        throw new Error('Email not found in OIDC claims');
      }

      return {
        email,
        userName,
        firstName,
        lastName,
        subject: claims.sub,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to extract user info from OIDC token');
      throw new Error(`Failed to extract user info: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Test OIDC configuration
   * Returns the authorization URL for admin to test manually
   */
  async testOidcConfiguration(config: OidcConfiguration, teamId: string): Promise<{ authUrl: string; message: string }> {
    try {
      // Test discovery
      await this.discoverOidcConfiguration(config.issuer);

      // Generate test authorization URL
      const { url } = await this.getAuthorizationUrl(config, teamId);

      return {
        authUrl: url,
        message: 'Configuration valid. Admin should test the authorization URL manually.',
      };
    } catch (error) {
      logger.error({ error, teamId }, 'OIDC configuration test failed');
      throw new Error(`OIDC configuration test failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get discovered configuration in a format suitable for saving to database
   */
  async getDiscoveredConfigForSaving(issuer: string): Promise<DiscoveredOidcConfig> {
    const authServer = await this.discoverOidcConfiguration(issuer);

    return {
      issuer: authServer.issuer,
      authorizationEndpoint: authServer.authorization_endpoint!,
      tokenEndpoint: authServer.token_endpoint!,
      userinfoEndpoint: authServer.userinfo_endpoint,
      jwksUri: authServer.jwks_uri!,
      endSessionEndpoint: authServer.end_session_endpoint,
    };
  }
}

export const oidcService = new OidcService();

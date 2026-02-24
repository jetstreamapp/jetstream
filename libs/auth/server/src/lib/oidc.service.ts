/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ENV, logger } from '@jetstream/api-config';
import type { OidcConfiguration } from '@jetstream/prisma';
import { getErrorMessage } from '@jetstream/shared/utils';
import { LRUCache } from 'lru-cache';
import { AuthorizationServer, allowInsecureRequests } from 'oauth4webapi';
import { decryptSecret } from './sso-crypto.util';
import { AttributeMapping, DiscoveredOidcConfig, SsoUserInfo } from './sso.types';

const oauthPromise = import('oauth4webapi');

const discoveryCache = new LRUCache<string, AuthorizationServer>({ max: 100, ttl: 1000 * 60 * 60 });

export class OidcService {
  /**
   * Discover OIDC configuration from issuer
   * Uses oauth4webapi (same as existing OAuth implementation)
   */
  async discoverOidcConfiguration(issuer: string): Promise<import('oauth4webapi').AuthorizationServer> {
    try {
      const oauth = await oauthPromise;
      const issuerUrl = new URL(issuer);

      // Check cache first
      const cached = discoveryCache.get(issuerUrl.toString());
      if (cached) {
        return cached;
      }

      // Perform discovery (allow HTTP for non-prod/local testing)
      const response = await oauth.discoveryRequest(issuerUrl, {
        [allowInsecureRequests]: ENV.ENVIRONMENT !== 'production',
      });
      const authServer = await oauth.processDiscoveryResponse(issuerUrl, response);

      // Cache the result
      discoveryCache.set(issuerUrl.toString(), authServer);

      return authServer;
    } catch (error) {
      logger.error({ error, issuer }, 'OIDC discovery failed');
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
    const oauth = await oauthPromise;
    const authServer = await this.discoverOidcConfiguration(config.issuer);
    const client: import('oauth4webapi').Client = {
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
  ): Promise<{ claims: import('oauth4webapi').IDToken; idTokenResult: import('oauth4webapi').TokenEndpointResponse }> {
    const oauth = await oauthPromise;
    const authServer = await this.discoverOidcConfiguration(config.issuer);
    const client: import('oauth4webapi').Client = {
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
        { [allowInsecureRequests]: ENV.ENVIRONMENT !== 'production' },
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
    claims: import('oauth4webapi').IDToken,
    accessToken: string | undefined,
    attributeMapping: AttributeMapping,
  ): Promise<SsoUserInfo> {
    const oauth = await oauthPromise;
    const authServer = await this.discoverOidcConfiguration(config.issuer);
    const client: import('oauth4webapi').Client = {
      client_id: config.clientId,
      token_endpoint_auth_method: 'client_secret_post',
    };

    try {
      // Start with claims from ID token
      let allClaims: Record<string, any> = { ...claims };

      // Optionally fetch from userinfo endpoint for additional claims
      if (authServer.userinfo_endpoint && accessToken) {
        const response = await oauth.userInfoRequest(authServer, client, accessToken, {
          [allowInsecureRequests]: ENV.ENVIRONMENT !== 'production',
        });
        const userinfoResponse = await oauth.processUserInfoResponse(authServer, client, claims.sub, response);
        allClaims = { ...allClaims, ...userinfoResponse };
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

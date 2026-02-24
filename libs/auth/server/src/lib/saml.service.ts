import { ENV, logger } from '@jetstream/api-config';
import { SamlConfiguration } from '@jetstream/prisma';
import { getErrorMessage } from '@jetstream/shared/utils';
import { CacheItem, CacheProvider, Profile, SAML, SamlConfig, ValidateInResponseTo } from '@node-saml/node-saml';
import { LRUCache } from 'lru-cache';
import { parseStringPromise } from 'xml2js';
import { decryptSecret } from './sso-crypto.util';
import { AttributeMapping, ParsedIdpMetadata, SsoUserInfo } from './sso.types';

/** 10 minutes - maximum time between AuthnRequest generation and SAML response */
const SAML_REQUEST_ID_EXPIRATION_MS = 10 * 60 * 1000;

export function resolveSamlIdentifiers(teamId: string) {
  const urlPrefix = `${ENV.JETSTREAM_SERVER_URL}${ENV.JETSTREAM_SAML_ACS_PATH_PREFIX}/${teamId}`;
  const spEntityId = `${ENV.JETSTREAM_SAML_SP_ENTITY_ID_PREFIX}:${teamId}`;
  const acsUrl = `${urlPrefix}/acs`;

  const callbackUrls = {
    oidc: `${ENV.JETSTREAM_SERVER_URL}/api/auth/sso/oidc/${teamId}/callback`,
    saml: acsUrl,
    samlMetadata: `${urlPrefix}/metadata`,
    spEntityId,
  };

  return {
    spEntityId,
    acsUrl,
    callbackUrls,
  };
}

/**
 * In-memory cache for SAML AuthnRequest IDs used by node-saml's InResponseTo validation.
 *
 * When getAuthorizeUrlAsync is called, node-saml saves the AuthnRequest ID here.
 * When validatePostResponseAsync is called, node-saml checks that the response's
 * InResponseTo matches a cached request ID, then removes it (one-time use).
 * This prevents both CSRF (response must match a request we initiated) and
 * replay attacks (each request ID can only be consumed once).
 */
class SamlRequestCacheProvider implements CacheProvider {
  private cache: LRUCache<string, CacheItem>;

  constructor(expirationMs: number) {
    this.cache = new LRUCache<string, CacheItem>({
      max: 10_000,
      ttl: expirationMs,
    });
  }

  async saveAsync(key: string, value: string): Promise<CacheItem | null> {
    const item: CacheItem = { createdAt: Date.now(), value };
    this.cache.set(key, item);
    return item;
  }

  async getAsync(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    return item?.value ?? null;
  }

  async removeAsync(key: string | null): Promise<string | null> {
    if (!key) {
      return null;
    }
    const item = this.cache.get(key);
    this.cache.delete(key);
    return item?.value ?? null;
  }
}

/**
 * Shared cache provider instance — must persist across initializeSamlStrategy calls
 * so that request IDs saved during getAuthorizationUrl are available during validateSamlResponse.
 */
const sharedSamlCacheProvider = new SamlRequestCacheProvider(SAML_REQUEST_ID_EXPIRATION_MS);

/**
 * Tracks consumed SAML assertion InResponseTo values as defense-in-depth against replay.
 * Even though node-saml removes request IDs from the cache after validation, this provides
 * an additional layer: if an assertion somehow passes node-saml's check, we reject it here
 * if the InResponseTo value was already used.
 */
const consumedAssertionCache = new LRUCache<string, true>({
  max: 50_000,
  ttl: SAML_REQUEST_ID_EXPIRATION_MS,
});

export class SamlService {
  /**
   * Initialize SAML strategy from configuration
   */
  initializeSamlStrategy(config: SamlConfiguration, teamId: string): SAML {
    const samlConfig: SamlConfig = {
      // Service Provider (Jetstream)
      issuer: config.entityId,
      callbackUrl: config.acsUrl,

      // Identity Provider
      entryPoint: config.idpSsoUrl,
      idpCert: config.idpCertificate,

      // Options
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      identifierFormat: config.nameIdFormat,
      wantAssertionsSigned: config.wantAssertionsSigned,
      // Many IdPs (Okta, Google, etc.) sign only the assertion, not the response envelope.
      // Assertion-level signing is sufficient when wantAssertionsSigned is true.
      wantAuthnResponseSigned: false,

      // InResponseTo validation: ensures SAML responses correspond to requests we initiated
      // and that each response can only be consumed once (anti-replay).
      // Using ifPresent instead of always because some IdPs (notably Google Workspace)
      // omit InResponseTo from their SAML responses even in SP-initiated flows.
      validateInResponseTo: ValidateInResponseTo.ifPresent,
      requestIdExpirationPeriodMs: SAML_REQUEST_ID_EXPIRATION_MS,
      cacheProvider: sharedSamlCacheProvider,

      // If we need to sign requests
      ...(config.signRequests && config.spPrivateKey && config.spCertificate
        ? {
            privateKey: decryptSecret(config.spPrivateKey),
            decryptionPvk: decryptSecret(config.spPrivateKey),
            signatureAlgorithm: 'sha256',
          }
        : {}),
    };

    return new SAML(samlConfig);
  }

  /**
   * Generate Service Provider metadata XML for download
   */
  async generateServiceProviderMetadata(teamId: string, config: SamlConfiguration): Promise<string> {
    const saml = this.initializeSamlStrategy(config, teamId);

    // generateServiceProviderMetadata(decryptionCert, signingCert)
    // Both use the SP certificate (public key)
    // If not configured, pass undefined (metadata will be generated without signing/encryption capabilities)
    const metadata = saml.generateServiceProviderMetadata(config.spCertificate, config.spCertificate);

    return metadata;
  }

  generatePlaceholderSamlConfiguration(teamId: string): string {
    const { acsUrl, spEntityId } = resolveSamlIdentifiers(teamId);
    const saml = new SAML({
      issuer: spEntityId,
      callbackUrl: acsUrl,
      entryPoint: 'https://placeholder.invalid', // unused by generateServiceProviderMetadata
      idpCert: 'PLACEHOLDER', // unused by generateServiceProviderMetadata
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
    });

    return saml.generateServiceProviderMetadata(null, null);
  }

  /**
   * Parse uploaded IdP metadata XML and extract configuration
   */
  async parseIdpMetadata(metadataXml: string): Promise<ParsedIdpMetadata> {
    try {
      // Defense-in-depth against XXE: reject XML with DOCTYPE or ENTITY declarations.
      // While xml2js's underlying sax parser doesn't resolve external entities,
      // this guards against parser changes and is an OWASP-recommended practice.
      if (/<!DOCTYPE/i.test(metadataXml) || /<!ENTITY/i.test(metadataXml)) {
        throw new Error('Invalid SAML metadata: DOCTYPE and ENTITY declarations are not allowed');
      }

      const stripPrefix = (name: string) => name.replace(/^[^:]+:/, '');
      const parsed = await parseStringPromise(metadataXml, { explicitArray: true, tagNameProcessors: [stripPrefix] });

      // Extract entity ID
      const entityDescriptor = parsed.EntityDescriptor;
      const entityId = entityDescriptor.$?.entityID as string | undefined;

      // Extract SSO URL
      const idpSsoDescriptor = entityDescriptor.IDPSSODescriptor?.[0];
      const ssoService = idpSsoDescriptor?.SingleSignOnService?.find(
        (svc) => svc.$?.Binding?.includes('HTTP-Redirect') || svc.$?.Binding?.includes('HTTP-POST'),
      );
      const ssoUrl = ssoService?.$?.Location;

      // Extract certificate
      const keyDescriptor = idpSsoDescriptor?.KeyDescriptor?.find((kd: any) => kd.$?.use === 'signing' || !kd.$?.use);
      const certData = keyDescriptor?.KeyInfo?.[0]?.X509Data?.[0]?.X509Certificate?.[0];
      const certificate = certData?.trim().replace(/\s/g, '');
      let claimMapping: Partial<AttributeMapping> | null = null;

      // Special handling for Azure AD: their claims are namespaced
      if (entityId?.startsWith('https://sts.windows.net/')) {
        claimMapping = {
          email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          userName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
          lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        };
      }

      if (!entityId || !ssoUrl || !certificate) {
        throw new Error('Invalid SAML metadata: missing required fields');
      }

      return {
        entityId,
        ssoUrl,
        certificate,
        claimMapping,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to parse SAML metadata');
      throw new Error(`Failed to parse SAML metadata: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Validate SAML response from IdP.
   *
   * Security checks performed:
   * - Assertion signature verification (via idpCert)
   * - InResponseTo validation (response must match a request we initiated)
   * - One-time-use enforcement (request ID removed from cache after first use)
   * - Defense-in-depth replay check (consumed assertion cache)
   */
  async validateSamlResponse(samlResponse: string, config: SamlConfiguration, teamId: string): Promise<Profile> {
    const saml = this.initializeSamlStrategy(config, teamId);

    try {
      const { profile, loggedOut } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
      if (loggedOut) {
        throw new Error('Received a SAML LogoutResponse instead of an authentication response');
      }
      if (!profile) {
        throw new Error('No profile returned in SAML response');
      }

      // Defense-in-depth: check that this assertion's InResponseTo hasn't been consumed before.
      // node-saml already removes the request ID from the cache after validation, but this
      // guards against edge cases (e.g. race conditions between concurrent requests).
      // profile.ID is the assertion ID set by node-saml from the parsed response
      const assertionId = typeof profile.ID === 'string' ? profile.ID : undefined;
      if (assertionId) {
        if (consumedAssertionCache.has(assertionId)) {
          throw new Error('SAML assertion has already been consumed (replay detected)');
        }
        consumedAssertionCache.set(assertionId, true);
      }

      return profile;
    } catch (error) {
      logger.error({ error, teamId }, 'SAML response validation failed');
      throw new Error(`SAML validation failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Extract and map user info from SAML assertion
   */
  extractUserInfo(profile: Profile, attributeMapping: AttributeMapping): SsoUserInfo {
    const attributes = profile.attributes || {};

    // Helper to get attribute value (supports both single value and array)
    const getAttribute = (key: string): string | undefined => {
      const value = attributes[key];
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;
    };

    const email = getAttribute(attributeMapping.email) || profile.nameID;
    const userName = (attributeMapping.userName && getAttribute(attributeMapping.userName)) || profile.nameID;
    const firstName = attributeMapping.firstName ? getAttribute(attributeMapping.firstName) : undefined;
    const lastName = attributeMapping.lastName ? getAttribute(attributeMapping.lastName) : undefined;
    if (!email) {
      throw new Error('Email not found in SAML assertion');
    }

    return {
      email,
      userName,
      firstName,
      lastName,
    };
  }

  /**
   * Get authorization URL for initiating SAML login
   */
  async getAuthorizationUrl(config: SamlConfiguration, teamId: string, returnUrl?: string): Promise<string> {
    const saml = this.initializeSamlStrategy(config, teamId);

    try {
      // getAuthorizeUrlAsync(RelayState: string, host: string | undefined, options: AuthOptions)
      const loginUrl = await saml.getAuthorizeUrlAsync(
        returnUrl || '', // RelayState - will be returned after authentication
        undefined, // host - use default from config
        {}, // options - additional SAML options
      );
      return loginUrl;
    } catch (error) {
      logger.error({ error, teamId }, 'Failed to generate SAML authorization URL');
      throw new Error(`Failed to generate SAML login URL: ${getErrorMessage(error)}`);
    }
  }
}

export const samlService = new SamlService();

import { DbCacheProvider, ENV, logger } from '@jetstream/api-config';
import { SamlConfiguration } from '@jetstream/prisma';
import { getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Profile, SAML, SamlConfig, ValidateInResponseTo } from '@node-saml/node-saml';
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';
import { decryptSecret } from './sso-crypto.util';
import { AttributeMapping, ParsedIdpMetadata, SsoUserInfo } from './sso.types';

/** 10 minutes - maximum time between AuthnRequest generation and SAML response */
const SAML_REQUEST_ID_EXPIRATION_MS = 10 * 60 * 1000;

/**
 * Upper bound on how long after its IssueInstant we will accept an assertion, independent of the
 * IdP-controlled NotOnOrAfter. node-saml uses min(IssueInstant + maxAssertionAgeMs, NotOnOrAfter)
 * as the effective expiry, so this caps the replay window even when an IdP issues a long-lived
 * assertion. Kept equal to SAML_REQUEST_ID_EXPIRATION_MS so the request and assertion windows match.
 */
const SAML_MAX_ASSERTION_AGE_MS = SAML_REQUEST_ID_EXPIRATION_MS;

/**
 * TTL for the consumed-assertion replay markers. Must be >= the assertion validity window so a
 * "consumed" marker can never expire before the assertion it guards, which would otherwise allow a
 * single late replay. The effective assertion window is bounded by SAML_MAX_ASSERTION_AGE_MS plus
 * node-saml's accepted clock skew (default 0 here); we add a generous margin to stay safely above it.
 */
const CONSUMED_ASSERTION_TTL_MS = SAML_MAX_ASSERTION_AGE_MS + 5 * 60 * 1000;

export function resolveSamlIdentifiers(teamId: string) {
  const urlPrefix = `${ENV.JETSTREAM_SERVER_URL}${ENV.JETSTREAM_SAML_ACS_PATH_PREFIX}/${teamId}`;
  const spEntityId = `${ENV.JETSTREAM_SAML_SP_ENTITY_ID_PREFIX}:${teamId}`;
  const acsUrl = `${urlPrefix}/acs`;

  const callbackUrls = {
    oidc: `${ENV.JETSTREAM_SERVER_URL}/api/auth/sso/oidc/${teamId}/callback`,
    oidcInitiateLogin: `${ENV.JETSTREAM_SERVER_URL}/api/auth/sso/oidc/${teamId}/initiate`,
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
 * Postgres-backed cache for SAML AuthnRequest IDs used by node-saml's InResponseTo validation.
 *
 * When getAuthorizeUrlAsync is called, node-saml saves the AuthnRequest ID here.
 * When validatePostResponseAsync is called, node-saml checks that the response's
 * InResponseTo matches a cached request ID, then removes it (one-time use).
 * This prevents both CSRF (response must match a request we initiated) and
 * replay attacks (each request ID can only be consumed once).
 *
 * Using Postgres (rather than in-memory) so that AuthnRequest IDs generated on one
 * worker process are visible to whichever worker handles the ACS callback.
 */
const sharedSamlCacheProvider = new DbCacheProvider('saml:authn-request', SAML_REQUEST_ID_EXPIRATION_MS);

/**
 * Tracks consumed SAML assertion IDs across all workers as defense-in-depth against replay.
 *
 * Why DB-backed (not in-memory LRU): for IdP-initiated assertions (no InResponseTo), node-saml's
 * AuthnRequest cache is not consulted — so this is the ONLY replay defense. An in-memory LRU
 * is per-worker, which means a captured assertion could be replayed once per worker before
 * expiry. DbCacheProvider.consumeOnceAsync performs an atomic INSERT whose primary-key conflict
 * detects any prior consumption across the whole cluster in a single round-trip.
 */
const consumedAssertionCache = new DbCacheProvider('saml:consumed-assertion', CONSUMED_ASSERTION_TTL_MS);

/**
 * Derive a stable, replay-detecting identifier from the VERIFIED assertion.
 *
 * We must NOT use profile.ID: node-saml only sets it on the logout path, never on the
 * authentication-assertion path, so it is always undefined here. Instead we read the parsed,
 * signature-verified assertion via profile.getAssertion() and build a composite key from the
 * assertion's @ID, @IssueInstant, and the Subject NameID. The @ID alone uniquely identifies an
 * assertion; IssueInstant and NameID are folded in as defense-in-depth so two distinct assertions
 * cannot collide on a malformed/duplicated @ID.
 *
 * The composite is SHA-256 hashed to a fixed-length digest before being returned. The @ID,
 * IssueInstant, and NameID are all IdP-controlled and unbounded in length; a long value could
 * otherwise overflow the cache key column (cache_entry.key is VARCHAR(512), which DbCacheProvider
 * further prefixes with its namespace) and throw on insert — failing SAML login closed instead of
 * recording the replay marker. Hashing bounds the key while SHA-256's collision resistance keeps
 * the guarantee that two distinct assertions cannot share a replay key.
 *
 * Returns undefined only when the assertion has no usable @ID — callers MUST fail closed in that
 * case rather than skip the replay check.
 */
function deriveAssertionReplayKey(profile: Profile): string | undefined {
  if (typeof profile.getAssertion !== 'function') {
    return undefined;
  }

  const assertionDoc = profile.getAssertion() as { Assertion?: { $?: { ID?: string; AssertionID?: string; IssueInstant?: string } } };
  const assertion = assertionDoc?.Assertion;
  const assertionId = assertion?.$?.ID || assertion?.$?.AssertionID;
  if (!assertionId) {
    return undefined;
  }

  const issueInstant = assertion?.$?.IssueInstant || '';
  const subjectNameId = profile.nameID || '';
  const composite = [assertionId, issueInstant, subjectNameId].join('|');
  return crypto.createHash('sha256').update(composite).digest('hex');
}

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
      // Many IdPs (Okta, Google, etc.) sign only the assertion, not the response envelope, so we
      // cannot require a signed <Response> without breaking those integrations.
      wantAuthnResponseSigned: false,
      // Delegate authentication-strength decisions to the IdP. node-saml defaults to
      // requesting PasswordProtectedTransport, which rejects users authenticating via
      // certificates, FIDO2, passwordless, etc. and triggers errors like Azure's AADSTS75011.
      // Letting the IdP enforce its own conditional-access / MFA policy is the modern norm.
      disableRequestedAuthnContext: true,

      // InResponseTo validation: ensures SAML responses correspond to requests we initiated
      // and that each response can only be consumed once (anti-replay).
      validateInResponseTo: ValidateInResponseTo.ifPresent,
      requestIdExpirationPeriodMs: SAML_REQUEST_ID_EXPIRATION_MS,
      // Bound the replay window to our own tight limit rather than trusting the IdP-set NotOnOrAfter.
      maxAssertionAgeMs: SAML_MAX_ASSERTION_AGE_MS,
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
   * - InResponseTo validation (response must match a request we initiated, when present)
   * - One-time-use enforcement (request ID removed from cache after first use)
   * - Mandatory replay check keyed off the verified assertion (consumed assertion cache); fails
   *   closed if no assertion identifier can be derived
   */
  async validateSamlResponse(samlResponse: string, config: SamlConfiguration, teamId: string): Promise<Profile> {
    const saml = this.initializeSamlStrategy(config, teamId);

    logger.info(
      { teamId, entityId: config.entityId, acsUrl: config.acsUrl, nameIdFormat: config.nameIdFormat },
      '[SAML] Validating SAML response',
    );

    try {
      const { profile, loggedOut } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
      if (loggedOut) {
        throw new Error('Received a SAML LogoutResponse instead of an authentication response');
      }
      if (!profile) {
        throw new Error('No profile returned in SAML response');
      }

      // MANDATORY replay gate: atomically record the assertion across all workers. For
      // IdP-initiated assertions (no InResponseTo) node-saml's AuthnRequest cache is not
      // consulted, so this is the only replay defense in that case. consumeOnceAsync folds
      // the existence check and the write into a single INSERT whose PK conflict is the
      // atomicity boundary — there is no get→set race across concurrent workers.
      //
      // The key is derived from the VERIFIED assertion (not profile.ID, which node-saml never
      // sets on the authentication path). If no usable assertion id can be derived we fail closed
      // rather than silently skip the check, since skipping would re-open the replay vector.
      const assertionReplayKey = deriveAssertionReplayKey(profile);
      if (!assertionReplayKey) {
        throw new Error('Unable to derive a SAML assertion identifier for replay protection');
      }
      const wasFirstUse = await consumedAssertionCache.consumeOnceAsync(assertionReplayKey);
      if (!wasFirstUse) {
        throw new Error('SAML assertion has already been consumed (replay detected)');
      }

      logger.info({ teamId, nameId: profile.nameID, nameIdFormat: profile.nameIDFormat }, '[SAML] SAML response validated successfully');
      return profile;
    } catch (error) {
      logger.error({ ...getErrorMessageAndStackObj(error), teamId }, 'SAML response validation failed');
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
      subject: profile.nameID,
    };
  }

  /**
   * Get authorization URL for initiating SAML login
   */
  async getAuthorizationUrl(config: SamlConfiguration, teamId: string, returnUrl?: string): Promise<string> {
    const saml = this.initializeSamlStrategy(config, teamId);

    logger.info(
      { teamId, entityId: config.entityId, acsUrl: config.acsUrl, idpSsoUrl: config.idpSsoUrl, nameIdFormat: config.nameIdFormat },
      '[SAML] Generating authorization URL',
    );

    try {
      // getAuthorizeUrlAsync(RelayState: string, host: string | undefined, options: AuthOptions)
      const loginUrl = await saml.getAuthorizeUrlAsync(
        returnUrl || '', // RelayState - will be returned after authentication
        undefined, // host - use default from config
        {}, // options - additional SAML options
      );
      logger.info({ teamId }, '[SAML] Authorization URL generated, AuthnRequest ID saved to cache');
      return loginUrl;
    } catch (error) {
      logger.error({ ...getErrorMessageAndStackObj(error), teamId }, 'Failed to generate SAML authorization URL');
      throw new Error(`Failed to generate SAML login URL: ${getErrorMessage(error)}`);
    }
  }
}

export const samlService = new SamlService();

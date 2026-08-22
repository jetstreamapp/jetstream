/**
 * Normalizes whatever a user pastes into the "Custom Login URL" field into a Salesforce login URL.
 *
 * Salesforce My Domain hosts follow a small number of shapes:
 *   production / developer   <myDomain>.my.salesforce.com
 *   sandbox                  <myDomain>--<sandboxName>.sandbox.my.salesforce.com
 *   scratch / developer edition
 *                            <myDomain>.develop.my.salesforce.com
 *
 * Users frequently paste the Lightning equivalent (`*.lightning.force.com`) or a deep link, so those
 * are reduced back to the login host. A `--` in the domain implies a sandbox, which is how the
 * standard Salesforce "Use Custom Domain" login page infers the `.sandbox.` segment.
 */

const MY_SALESFORCE_SUFFIX = '.my.salesforce.com';
const SANDBOX_SEGMENT = 'sandbox';

/**
 * Suffixes that identify a My Domain host, longest/most specific first.
 * Deliberately excludes bare `.salesforce.com` and `.force.com`: those also match login endpoints
 * (`login.salesforce.com`) and legacy instance urls (`na139.salesforce.com`), which are not My
 * Domains, and stripping them would silently produce a bogus domain like `login.my.salesforce.com`.
 */
const KNOWN_HOST_SUFFIXES = ['.my.salesforce.com', '.lightning.force.com', '.my.salesforce-setup.com', '.my.site.com'];

/**
 * Environment segments Salesforce documents for enhanced domains. Only consulted for shorthand the
 * user typed by hand (`acme.develop`); a full host we recognized is passed through verbatim, so new
 * segments Salesforce adds keep working without a change here.
 */
const ENVIRONMENT_SEGMENTS = [SANDBOX_SEGMENT, 'develop', 'scratch', 'trailblaze', 'demo', 'patch', 'free'];

const DOMAIN_LABEL_REGEX = /^[a-z0-9-]+$/;

export interface ParsedLoginUrlSuccess {
  success: true;
  /**
   * The customer portion of the host, e.g. `acme`, `acme--uat.sandbox` or `acme.develop`.
   * Not guaranteed to re-parse: legacy instance-scoped hosts produce values like `acme--uat.cs123`,
   * which are not valid shorthand. `loginUrl` (or its hostname) is the round-trippable value.
   */
  myDomain: string;
  isSandbox: boolean;
  /** Fully qualified login url safe to hand to the OAuth flow */
  loginUrl: string;
}

export interface ParsedLoginUrlError {
  success: false;
  error: string;
}

export type ParsedLoginUrl = ParsedLoginUrlSuccess | ParsedLoginUrlError;

const SHORTHAND_ERROR = 'Enter a Salesforce domain, such as acme or acme--uat.sandbox';

/** Strips protocol, path, query, fragment, port and credentials, leaving a bare lowercase hostname. */
function extractHostname(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.split(/[/?#]/)[0];
  // Strip credentials and port
  value = value.split('@').pop() || '';
  value = value.split(':')[0];
  return value;
}

/**
 * Removes the Salesforce-owned suffix if one is present, returning the customer portion of the host.
 * A host with no recognized suffix is returned untouched so the caller can still accept shorthand
 * such as `acme` or `acme--uat.sandbox`.
 */
function stripKnownSuffix(hostname: string): { domain: string; matchedKnownSuffix: boolean } {
  const matchedSuffix = KNOWN_HOST_SUFFIXES.find((suffix) => hostname.endsWith(suffix));
  if (!matchedSuffix) {
    return { domain: hostname, matchedKnownSuffix: false };
  }
  return { domain: hostname.slice(0, -matchedSuffix.length), matchedKnownSuffix: true };
}

/**
 * Shorthand is a single domain label plus at most one known environment segment. Anything else
 * (`evil.com`, `acme.my.salesforce.com.evil.com`) is a shape we did not understand - saying so beats
 * silently inventing a host the user never asked for.
 */
function isSupportedShorthand(segments: string[]): boolean {
  if (segments.length === 1) {
    return true;
  }
  return segments.length === 2 && ENVIRONMENT_SEGMENTS.includes(segments[1]);
}

export function parseSalesforceLoginUrl(input: string): ParsedLoginUrl {
  const hostname = extractHostname(input || '');

  if (!hostname) {
    return { success: false, error: 'Enter your Salesforce domain' };
  }

  const { domain, matchedKnownSuffix } = stripKnownSuffix(hostname);

  if (!domain) {
    return { success: false, error: SHORTHAND_ERROR };
  }

  const segments = domain.split('.');

  if (!segments.every((segment) => DOMAIN_LABEL_REGEX.test(segment))) {
    return { success: false, error: 'Domains can only contain letters, numbers, and hyphens' };
  }

  if (!matchedKnownSuffix && !isSupportedShorthand(segments)) {
    return { success: false, error: SHORTHAND_ERROR };
  }

  // Salesforce infers a sandbox from the `--` that separates the domain from the sandbox name, but
  // only when the user did not already say which environment they meant.
  const myDomain = !matchedKnownSuffix && segments.length === 1 && domain.includes('--') ? `${domain}.${SANDBOX_SEGMENT}` : domain;

  // `--` implies a sandbox unless the host explicitly names a different environment (`acme--dev.develop`).
  // Legacy instance-scoped hosts (`acme--uat.cs123`) carry an instance rather than an environment, so
  // the `--` still marks them as sandboxes.
  const namesOtherEnvironment = segments.length > 1 && segments[1] !== SANDBOX_SEGMENT && ENVIRONMENT_SEGMENTS.includes(segments[1]);

  return {
    success: true,
    myDomain,
    isSandbox: myDomain.endsWith(`.${SANDBOX_SEGMENT}`) || (segments[0].includes('--') && !namesOtherEnvironment),
    loginUrl: `https://${myDomain}${MY_SALESFORCE_SUFFIX}`,
  };
}

import { ENV } from '@jetstream/api-config';

/**
 * Identity provider URLs come from a team's SSO configuration (typed in, or read from SAML metadata or an OIDC
 * discovery document) and become the browser's navigation target when a member signs in.
 */

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Whether a value is an absolute http or https URL, the only schemes that may be used as a sign-in redirect. */
export function isHttpUrl(value: string | null | undefined): boolean {
  const url = value ? parseUrl(value) : null;
  return url?.protocol === 'https:' || url?.protocol === 'http:';
}

/**
 * Whether an identity provider URL may be saved: https only, plus http when secure cookies are off (local
 * development and CI, where the mock identity providers are served over http).
 */
export function isAllowedIdpUrl(value: string | null | undefined): boolean {
  const url = value ? parseUrl(value) : null;
  if (!url) {
    return false;
  }
  return url.protocol === 'https:' || (url.protocol === 'http:' && !ENV.USE_SECURE_COOKIES);
}

/** Throws unless {@link isAllowedIdpUrl}. `label` names the setting in the error message. */
export function assertAllowedIdpUrl(value: string | null | undefined, label: string): string {
  if (!value || !isAllowedIdpUrl(value)) {
    throw new Error(`${label} must be an https URL`);
  }
  return value;
}

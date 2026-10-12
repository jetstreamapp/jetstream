import { AdminSessionUser } from '@jetstream/admin/types';

export interface GoogleIdentityClaims {
  [claim: string]: unknown;
  email?: unknown;
  email_verified?: unknown;
  hd?: unknown;
  name?: unknown;
  picture?: unknown;
}

export type AdminSignInDecision = { allowed: true; user: AdminSessionUser } | { allowed: false; reason: string };

/**
 * Decides whether a Google identity may use the admin app. Every rule must pass:
 * the address is verified, the account belongs to the Workspace domain (`hd` is only present on
 * Workspace accounts, so a consumer Gmail account fails), and the exact address is allowlisted.
 */
export function evaluateAdminSignIn(
  claims: GoogleIdentityClaims,
  { allowedDomain, allowedEmails }: { allowedDomain: string; allowedEmails: ReadonlySet<string> },
): AdminSignInDecision {
  if (typeof claims.email !== 'string' || !claims.email) {
    return { allowed: false, reason: 'Google did not return an email address' };
  }
  const email = claims.email.trim().toLowerCase();

  if (claims.email_verified !== true) {
    return { allowed: false, reason: `Email is not verified: ${email}` };
  }
  if (typeof claims.hd !== 'string' || claims.hd.toLowerCase() !== allowedDomain) {
    return { allowed: false, reason: `Account is not part of the ${allowedDomain} Workspace: ${email}` };
  }
  if (!email.endsWith(`@${allowedDomain}`)) {
    return { allowed: false, reason: `Email is outside ${allowedDomain}: ${email}` };
  }
  if (!allowedEmails.has(email)) {
    return { allowed: false, reason: `Email is not on the admin allowlist: ${email}` };
  }

  return {
    allowed: true,
    user: {
      email,
      name: typeof claims.name === 'string' ? claims.name : null,
      picture: typeof claims.picture === 'string' ? claims.picture : null,
    },
  };
}

/**
 * Only same-origin relative paths are accepted as a post-login destination, so the login flow
 * cannot be used as an open redirect (`//evil.com` and `/\evil.com` are protocol-relative in browsers).
 */
export function sanitizeReturnTo(returnTo: unknown): string {
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.startsWith('/\\')) {
    return '/';
  }
  if (returnTo.startsWith('/auth/')) {
    return '/';
  }
  return returnTo;
}

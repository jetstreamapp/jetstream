import { prisma } from '@jetstream/api-config';

/**
 * Default number of Salesforce orgs an entitled subscription may authorize for the Canvas app
 * ("Canvas deployment to one org"). Enforced only in the web-app registration flow — the access
 * gate never checks this, so manually-inserted DB rows intentionally bypass the cap for one-off
 * edge cases (e.g. the occasional consultant working across several orgs).
 */
export const CANVAS_ORG_LIMIT_DEFAULT = 1;

/**
 * Resolves the authorized-org cap for a scope. Kept as a function so it can vary per plan later
 * without touching the registration controller.
 */
export function getCanvasOrgLimit(): number {
  return CANVAS_ORG_LIMIT_DEFAULT;
}

/**
 * Parses the "My Domain" base from a Salesforce instance URL so an entitled production org can
 * extend access to its sandboxes (which share the My Domain base but get a brand-new org id).
 *
 *   prod:    https://acme.my.salesforce.com               -> "acme"
 *   sandbox: https://acme--uat.sandbox.my.salesforce.com  -> "acme"
 *
 * This is a usability convenience, not a security boundary (admins can rename My Domain).
 */
export function parseMyDomainBase(instanceUrl: string): string | null {
  try {
    const { hostname } = new URL(instanceUrl);
    const [subdomain] = hostname.split('.');
    // Strip any sandbox suffix ("acme--uat" -> "acme")
    return subdomain?.split('--')[0] || null;
  } catch {
    return null;
  }
}

/**
 * Confirms the owning scope of an authorized-org record still holds the `salesforceCanvas`
 * entitlement, so a cancelled subscription immediately revokes all of that owner's orgs.
 */
async function ownerHasCanvasEntitlement(owner: { jetstreamUserId: string | null; teamId: string | null }): Promise<boolean> {
  if (owner.teamId) {
    return prisma.teamEntitlement.count({ where: { teamId: owner.teamId, salesforceCanvas: true } }).then((result) => result > 0);
  }
  if (owner.jetstreamUserId) {
    return prisma.entitlement.count({ where: { userId: owner.jetstreamUserId, salesforceCanvas: true } }).then((result) => result > 0);
  }
  return false;
}

/**
 * Determines whether a Salesforce org may use the Jetstream Canvas app.
 *
 * Access requires BOTH:
 *  1. an ACTIVE `SalesforceCanvasOrg` authorization record (matched by org id, or by My Domain base
 *     so an entitled production org also covers its sandboxes), AND
 *  2. the owning user/team still holding the `salesforceCanvas` entitlement.
 *
 * Authorization records are created via the web-app management UI (cap-enforced) or inserted
 * manually for edge cases. This gate deliberately does not check the org cap.
 */
export async function isCanvasOrgEntitled(organizationId: string, instanceUrl?: string | null): Promise<boolean> {
  const orgIdPrefix = organizationId.slice(0, 15);
  const myDomainBase = instanceUrl ? parseMyDomainBase(instanceUrl) : null;

  const authorizedOrgs = await prisma.salesforceCanvasOrg.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ organizationId: { startsWith: orgIdPrefix } }, ...(myDomainBase ? [{ myDomainBase }] : [])],
    },
    select: { jetstreamUserId: true, teamId: true },
  });

  for (const owner of authorizedOrgs) {
    if (await ownerHasCanvasEntitlement(owner)) {
      return true;
    }
  }
  return false;
}

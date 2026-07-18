import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import {
  SALESFORCE_CANVAS_ORG_LIMIT,
  SalesforceCanvasOrg,
  SalesforceCanvasOrgSchema,
  SalesforceCanvasOrgStatus,
  SalesforceCanvasOrgStatusSchema,
} from '@jetstream/types';
import { NotFoundError, UserFacingError } from '../utils/error-handler';

/**
 * Resolves the authorized-org cap for a scope. Kept as a function so it can vary per plan later
 * without touching the callers. Enforced by `createCanvasOrg`; the access gate never checks it, so
 * manually-inserted DB rows intentionally still bypass the cap for one-off edge cases.
 */
export function getCanvasOrgLimit(): number {
  return SALESFORCE_CANVAS_ORG_LIMIT;
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
 * Authorization records are created manually for MVP
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

/**
 * Identifies which scope owns a set of authorized Canvas orgs. Ownership is a strict user XOR team
 * (enforced by the `salesforce_canvas_org_owner_check` DB constraint), so every query is scoped to
 * exactly one of these for tenant isolation.
 */
export type CanvasOrgOwnerScope = { type: 'user'; userId: string } | { type: 'team'; teamId: string };

function ownerWhere(owner: CanvasOrgOwnerScope): Prisma.SalesforceCanvasOrgWhereInput {
  return owner.type === 'team' ? { teamId: owner.teamId } : { jetstreamUserId: owner.userId };
}

const CANVAS_ORG_SELECT = {
  id: true,
  organizationId: true,
  instanceUrl: true,
  myDomainBase: true,
  orgName: true,
  isSandbox: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SalesforceCanvasOrgSelect;

export async function listCanvasOrgsForOwner(owner: CanvasOrgOwnerScope): Promise<SalesforceCanvasOrg[]> {
  return prisma.salesforceCanvasOrg
    .findMany({ where: ownerWhere(owner), select: CANVAS_ORG_SELECT, orderBy: { createdAt: 'asc' } })
    .then((items) => SalesforceCanvasOrgSchema.array().parse(items));
}

export async function createCanvasOrg({
  owner,
  authorizedByUserId,
  organizationId,
  myDomainBase,
  orgName,
}: {
  owner: CanvasOrgOwnerScope;
  authorizedByUserId: string;
  organizationId: string;
  myDomainBase: string;
  orgName?: string | null;
}): Promise<SalesforceCanvasOrg> {
  // Normalize to the 15-char id prefix so the 15/18-char forms of the same org collapse to a single
  // row (via the unique constraint) and match the access gate's `startsWith` lookup in isCanvasOrgEntitled.
  const normalizedOrgId = organizationId.trim().slice(0, 15);
  const normalizedDomain = myDomainBase.trim().toLowerCase();

  const currentCount = await prisma.salesforceCanvasOrg.count({ where: ownerWhere(owner) });
  if (currentCount >= getCanvasOrgLimit()) {
    throw new UserFacingError(
      `You have reached the limit of ${getCanvasOrgLimit()} authorized orgs. Remove an existing org or contact support if you need more.`,
    );
  }

  try {
    return await prisma.salesforceCanvasOrg
      .create({
        select: CANVAS_ORG_SELECT,
        data: {
          organizationId: normalizedOrgId,
          instanceUrl: `https://${normalizedDomain}.my.salesforce.com`,
          myDomainBase: normalizedDomain,
          orgName: orgName?.trim() || null,
          isSandbox: false,
          status: SalesforceCanvasOrgStatusSchema.enum.ACTIVE,
          authorizedByUserId,
          ...(owner.type === 'team' ? { teamId: owner.teamId } : { jetstreamUserId: owner.userId }),
        },
      })
      .then((item) => SalesforceCanvasOrgSchema.parse(item));
  } catch (ex) {
    if (ex instanceof Prisma.PrismaClientKnownRequestError && ex.code === 'P2002') {
      throw new UserFacingError('This Salesforce org is already authorized for the Canvas app.');
    }
    throw ex;
  }
}

export async function updateCanvasOrg({
  owner,
  id,
  data,
}: {
  owner: CanvasOrgOwnerScope;
  id: string;
  data: { orgName?: string | null; status?: SalesforceCanvasOrgStatus };
}): Promise<SalesforceCanvasOrg> {
  // updateMany scopes the write by owner so one tenant can never mutate another's record.
  const result = await prisma.salesforceCanvasOrg.updateMany({
    where: { id, ...ownerWhere(owner) },
    data: {
      ...(data.orgName !== undefined ? { orgName: data.orgName?.trim() || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
  if (result.count === 0) {
    throw new NotFoundError('Authorized org not found');
  }
  return prisma.salesforceCanvasOrg
    .findFirstOrThrow({ where: { id, ...ownerWhere(owner) }, select: CANVAS_ORG_SELECT })
    .then((item) => SalesforceCanvasOrgSchema.parse(item));
}

export async function deleteCanvasOrg({ owner, id }: { owner: CanvasOrgOwnerScope; id: string }): Promise<void> {
  const result = await prisma.salesforceCanvasOrg.deleteMany({ where: { id, ...ownerWhere(owner) } });
  if (result.count === 0) {
    throw new NotFoundError('Authorized org not found');
  }
}

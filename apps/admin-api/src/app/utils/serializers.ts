import { AuditLogItem, EntitlementFlags, SubscriptionItem } from '@jetstream/admin/types';
import { prisma } from '@jetstream/api-config';
import { AuditLogResource } from '@jetstream/audit-logs';
import { Prisma } from '@jetstream/prisma';

export function toIsoString(value: Date): string;
export function toIsoString(value: Date | null | undefined): string | null;
export function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export const ENTITLEMENT_SELECT = {
  chromeExtension: true,
  googleDrive: true,
  recordSync: true,
  desktop: true,
  analysisTools: true,
  salesforceCanvas: true,
} satisfies Prisma.TeamEntitlementSelect;

export const SUBSCRIPTION_SELECT = {
  subscriptionId: true,
  priceId: true,
  status: true,
  createdAt: true,
} satisfies Prisma.TeamSubscriptionSelect;

export function toEntitlementFlags(entitlements: EntitlementFlags | null | undefined): EntitlementFlags | null {
  return entitlements ? { ...entitlements } : null;
}

export function toSubscriptionItem({
  subscriptionId,
  priceId,
  status,
  createdAt,
}: Prisma.TeamSubscriptionGetPayload<{
  select: typeof SUBSCRIPTION_SELECT;
}>): SubscriptionItem {
  return { subscriptionId, priceId, status, createdAt: createdAt.toISOString() };
}

export async function findAuditLogs(where: Prisma.AuditLogWhereInput, limit = 50): Promise<AuditLogItem[]> {
  const auditLogs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
  return auditLogs.map(({ id, action, resource, resourceId, userId, teamId, metadata, ipAddress, createdAt }) => ({
    id,
    action,
    resource,
    resourceId,
    userId,
    teamId,
    metadata,
    ipAddress,
    createdAt: createdAt.toISOString(),
  }));
}

/**
 * A team's own audit log plus the admin app's entries about it, which are keyed by resource instead of
 * teamId, and the admin app's entries about its Stripe customer
 */
export function teamAuditLogWhere(teamId: string, customerId?: string | null): Prisma.AuditLogWhereInput {
  const conditions: Prisma.AuditLogWhereInput[] = [{ teamId }, { resource: AuditLogResource.TEAM, resourceId: teamId }];
  if (customerId) {
    conditions.push({ resource: AuditLogResource.STRIPE_CUSTOMER, resourceId: customerId });
  }
  return { OR: conditions };
}

/** A user's own audit log plus the admin app's entries about their personal Stripe customer */
export function userAuditLogWhere(userId: string, customerId?: string | null): Prisma.AuditLogWhereInput {
  if (!customerId) {
    return { userId };
  }
  return { OR: [{ userId }, { resource: AuditLogResource.STRIPE_CUSTOMER, resourceId: customerId }] };
}

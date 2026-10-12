import { SearchQuery, UserDetail, UserListItem, UserWebSessionItem } from '@jetstream/admin/types';
import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import { z } from 'zod';
import { NotFoundError } from '../utils/route.utils';
import {
  ENTITLEMENT_SELECT,
  findAuditLogs,
  SUBSCRIPTION_SELECT,
  toEntitlementFlags,
  toIsoString,
  toSubscriptionItem,
} from '../utils/serializers';

const ACTIVE_SUBSCRIPTION_STATUS = 'ACTIVE';
const RECENT_ACTIVITY_LIMIT = 50;

function buildUserSearchWhere(query: string | undefined): Prisma.UserWhereInput {
  if (!query) {
    return {};
  }
  const conditions: Prisma.UserWhereInput[] = [
    { email: { contains: query, mode: 'insensitive' } },
    { name: { contains: query, mode: 'insensitive' } },
    { billingAccount: { customerId: query } },
  ];
  if (z.guid().safeParse(query).success) {
    conditions.push({ id: query });
  }
  return { OR: conditions };
}

export async function searchUsers({ query, limit }: SearchQuery): Promise<UserListItem[]> {
  const users = await prisma.user.findMany({
    where: buildUserSearchWhere(query),
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      lastLoggedIn: true,
      lockedUntil: true,
      teamMembership: { select: { role: true, team: { select: { id: true, name: true } } } },
      _count: { select: { subscriptions: { where: { status: ACTIVE_SUBSCRIPTION_STATUS } } } },
    },
  });

  return users.map(({ id, email, name, emailVerified, createdAt, lastLoggedIn, lockedUntil, teamMembership, _count }) => ({
    id,
    email,
    name,
    emailVerified,
    createdAt: createdAt.toISOString(),
    lastLoggedIn: toIsoString(lastLoggedIn),
    lockedUntil: toIsoString(lockedUntil),
    teamId: teamMembership?.team.id ?? null,
    teamName: teamMembership?.team.name ?? null,
    teamRole: teamMembership?.role ?? null,
    hasActiveSubscription: _count.subscriptions > 0,
  }));
}

const SessionJsonSchema = z
  .object({
    provider: z.string().nullish(),
    ipAddress: z.string().nullish(),
    userAgent: z.string().nullish(),
    loginTime: z.number().nullish(),
  })
  .loose();

/** Session rows hold express-session JSON; only the descriptive fields are returned, never the sid or tokens */
async function getWebSessions(userId: string): Promise<UserWebSessionItem[]> {
  const sessions = await prisma.sessions.findMany({
    where: { userId, expire: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { sess: true, expire: true, createdAt: true },
  });
  return sessions.map(({ sess, expire, createdAt }) => {
    const parsed = SessionJsonSchema.safeParse(sess);
    const session = parsed.success ? parsed.data : {};
    return {
      createdAt: toIsoString(createdAt),
      expiresAt: expire.toISOString(),
      provider: session.provider ?? null,
      ipAddress: session.ipAddress ?? null,
      userAgent: session.userAgent ?? null,
      loginTime: session.loginTime ? new Date(session.loginTime).toISOString() : null,
    };
  });
}

export async function getUserDetail(userId: string): Promise<UserDetail> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      lastLoggedIn: true,
      lockedUntil: true,
      failedLoginAttempts: true,
      forcePasswordReset: true,
      hasPasswordSet: true,
      identities: { select: { provider: true, email: true, isPrimary: true, createdAt: true } },
      // `secret` is deliberately not selected
      authFactors: { select: { type: true, enabled: true } },
      teamMembership: { select: { role: true, status: true, team: { select: { id: true, name: true } } } },
      billingAccount: { select: { customerId: true, manualBilling: true } },
      subscriptions: { select: SUBSCRIPTION_SELECT, orderBy: { createdAt: 'desc' } },
      entitlements: { select: ENTITLEMENT_SELECT },
      // tokenHash is deliberately not selected
      webExtensionTokens: {
        where: { expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, source: true, platform: true, appVersion: true, ipAddress: true, createdAt: true, expiresAt: true },
      },
      loginActivity: {
        orderBy: { createdAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
        select: {
          id: true,
          action: true,
          method: true,
          success: true,
          errorMessage: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      },
      _count: { select: { salesforceOrgs: true } },
    },
  });

  if (!user) {
    throw new NotFoundError(`User ${userId} not found`);
  }

  const [webSessions, auditLogs] = await Promise.all([getWebSessions(userId), findAuditLogs({ userId }, RECENT_ACTIVITY_LIMIT)]);
  const { teamMembership } = user;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoggedIn: toIsoString(user.lastLoggedIn),
    lockedUntil: toIsoString(user.lockedUntil),
    failedLoginAttempts: user.failedLoginAttempts,
    forcePasswordReset: user.forcePasswordReset,
    hasPasswordSet: user.hasPasswordSet,
    identities: user.identities.map(({ provider, email, isPrimary, createdAt }) => ({
      provider,
      email: email ?? null,
      isPrimary,
      createdAt: createdAt.toISOString(),
    })),
    authFactors: user.authFactors,
    teamMembership: teamMembership
      ? { teamId: teamMembership.team.id, teamName: teamMembership.team.name, role: teamMembership.role, status: teamMembership.status }
      : null,
    billingAccount: user.billingAccount,
    subscriptions: user.subscriptions.map(toSubscriptionItem),
    entitlements: toEntitlementFlags(user.entitlements),
    salesforceOrgCount: user._count.salesforceOrgs,
    webSessions,
    externalSessions: user.webExtensionTokens.map(({ id, source, platform, appVersion, ipAddress, createdAt, expiresAt }) => ({
      id,
      source,
      platform: platform ?? null,
      appVersion: appVersion ?? null,
      ipAddress: ipAddress ?? null,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })),
    loginActivity: user.loginActivity.map(({ id, action, method, success, errorMessage, ipAddress, userAgent, createdAt }) => ({
      id,
      action,
      method: method ?? null,
      success,
      errorMessage: errorMessage ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      createdAt: createdAt.toISOString(),
    })),
    auditLogs,
  };
}

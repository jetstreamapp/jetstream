import { PaginatedResult, PaginatedSearchQuery, TeamDetail, TeamListItem } from '@jetstream/admin/types';
import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import { BILLABLE_ROLES, TEAM_MEMBER_STATUS_ACTIVE } from '@jetstream/types';
import { z } from 'zod';
import { NotFoundError } from '../utils/route.utils';
import {
  ENTITLEMENT_SELECT,
  findAuditLogs,
  SUBSCRIPTION_SELECT,
  teamAuditLogWhere,
  toEntitlementFlags,
  toIsoString,
  toSubscriptionItem,
} from '../utils/serializers';

function buildTeamSearchWhere(query: string | undefined): Prisma.TeamWhereInput {
  if (!query) {
    return {};
  }
  const conditions: Prisma.TeamWhereInput[] = [
    { name: { contains: query, mode: 'insensitive' } },
    { members: { some: { user: { email: { contains: query, mode: 'insensitive' } } } } },
    { billingAccount: { customerId: query } },
  ];
  if (z.guid().safeParse(query).success) {
    conditions.push({ id: query });
  }
  return { OR: conditions };
}

export async function searchTeams({ query, page, pageSize }: PaginatedSearchQuery): Promise<PaginatedResult<TeamListItem>> {
  const where = buildTeamSearchWhere(query);
  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        status: true,
        billingStatus: true,
        createdAt: true,
        billingAccount: { select: { customerId: true, manualBilling: true, licenseCountLimit: true } },
        _count: { select: { members: true } },
      },
    }),
    prisma.team.count({ where }),
  ]);

  const items = teams.map(({ id, name, status, billingStatus, createdAt, billingAccount, _count }) => ({
    id,
    name,
    status,
    billingStatus,
    createdAt: createdAt.toISOString(),
    memberCount: _count.members,
    customerId: billingAccount?.customerId ?? null,
    manualBilling: billingAccount?.manualBilling ?? false,
    licenseCountLimit: billingAccount?.licenseCountLimit ?? null,
  }));

  return { items, total, page, pageSize };
}

export async function getTeamDetail(teamId: string): Promise<TeamDetail> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      status: true,
      billingStatus: true,
      createdAt: true,
      updatedAt: true,
      billingAccount: {
        select: {
          customerId: true,
          manualBilling: true,
          licenseCountLimit: true,
          seatQuantity: true,
          includedSeats: true,
          seatPeriodEnd: true,
          pendingSeatQuantity: true,
          pendingSeatEffectiveAt: true,
        },
      },
      subscriptions: { select: SUBSCRIPTION_SELECT, orderBy: { createdAt: 'desc' } },
      entitlements: { select: ENTITLEMENT_SELECT },
      members: {
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          status: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true, lastLoggedIn: true } },
        },
      },
      invitations: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, role: true, expiresAt: true, lastSentAt: true, createdAt: true },
      },
      loginConfig: { select: { domains: true, requireMfa: true, ssoProvider: true, ssoEnabled: true, autoAddToTeam: true } },
      // verificationCode is deliberately not selected
      domainVerifications: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, domain: true, status: true, verifiedAt: true, createdAt: true },
      },
    },
  });

  if (!team) {
    throw new NotFoundError(`Team ${teamId} not found`);
  }

  const now = new Date();
  const { billingAccount, members, invitations } = team;

  return {
    id: team.id,
    name: team.name,
    status: team.status,
    billingStatus: team.billingStatus,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
    billingAccount: billingAccount
      ? {
          ...billingAccount,
          seatPeriodEnd: toIsoString(billingAccount.seatPeriodEnd),
          pendingSeatEffectiveAt: toIsoString(billingAccount.pendingSeatEffectiveAt),
        }
      : null,
    subscriptions: team.subscriptions.map(toSubscriptionItem),
    entitlements: toEntitlementFlags(team.entitlements),
    seats: {
      used: members.filter(({ role, status }) => status === TEAM_MEMBER_STATUS_ACTIVE && BILLABLE_ROLES.has(role)).length,
      reserved: invitations.filter(({ role, expiresAt }) => BILLABLE_ROLES.has(role) && expiresAt >= now).length,
      limit: billingAccount?.licenseCountLimit ?? null,
    },
    members: members.map(({ role, status, createdAt, user }) => ({
      userId: user.id,
      email: user.email,
      name: user.name,
      role,
      status,
      lastLoggedIn: toIsoString(user.lastLoggedIn),
      createdAt: createdAt.toISOString(),
    })),
    invitations: invitations.map(({ id, email, role, expiresAt, lastSentAt, createdAt }) => ({
      id,
      email,
      role,
      expiresAt: expiresAt.toISOString(),
      lastSentAt: lastSentAt.toISOString(),
      createdAt: createdAt.toISOString(),
    })),
    loginConfig: team.loginConfig,
    domains: team.domainVerifications.map(({ id, domain, status, verifiedAt, createdAt }) => ({
      id,
      domain,
      status,
      verifiedAt: toIsoString(verifiedAt),
      createdAt: createdAt.toISOString(),
    })),
    auditLogs: await findAuditLogs(teamAuditLogWhere(teamId, billingAccount?.customerId)),
  };
}

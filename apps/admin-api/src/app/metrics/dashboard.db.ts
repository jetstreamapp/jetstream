import { DashboardSummary } from '@jetstream/admin/types';
import { prisma } from '@jetstream/api-config';
import { TEAM_STATUS_ACTIVE } from '@jetstream/types';
import { subDays } from 'date-fns';

const ACTIVE_SUBSCRIPTION_STATUS = 'ACTIVE';

/** Same definitions as the weekly stats email (apps/cron-tasks/src/utils/stats-summary.utils.ts) so the numbers agree */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const thirtyDaysAgo = subDays(now, 30);

  const [
    totalUsers,
    newUsersLast7Days,
    newUsersLast30Days,
    activeUsersLast7Days,
    activeWebSessions,
    activeWebSessionUsers,
    activeExternalSessions,
    totalTeams,
    activeTeams,
    payingUsers,
    payingTeams,
    salesforceOrgs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gt: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gt: thirtyDaysAgo } } }),
    // Prisma's `distinct` de-duplicates in memory after loading every matching row, so count in SQL
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(DISTINCT "userId") AS count
      FROM "LoginActivity"
      WHERE "action" = 'LOGIN' AND "success" = true AND "createdAt" > ${sevenDaysAgo} AND "userId" IS NOT NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.sessions.count({ where: { expire: { gt: now } } }),
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(DISTINCT "user_id") AS count
      FROM "sessions"
      WHERE "expire" > ${now}
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.webExtensionToken.count({ where: { expiresAt: { gt: now } } }),
    prisma.team.count(),
    prisma.team.count({ where: { status: TEAM_STATUS_ACTIVE } }),
    prisma.billingAccount.count({ where: { subscriptions: { some: { status: ACTIVE_SUBSCRIPTION_STATUS } } } }),
    prisma.teamBillingAccount.count({ where: { subscriptions: { some: { status: ACTIVE_SUBSCRIPTION_STATUS } } } }),
    prisma.salesforceOrg.count(),
  ]);

  return {
    totalUsers,
    newUsersLast7Days,
    newUsersLast30Days,
    activeUsersLast7Days,
    activeWebSessions,
    activeWebSessionUsers,
    activeExternalSessions,
    totalTeams,
    activeTeams,
    payingUsers,
    payingTeams,
    salesforceOrgs,
    generatedAt: now.toISOString(),
  };
}

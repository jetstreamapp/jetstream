import { sendStatsSummaryEmail } from '@jetstream/email';
import { PrismaClient } from '@jetstream/prisma';
import { startOfYear, subDays } from 'date-fns';
import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';
import { formatLocation, lookupIpAddresses } from './geo-ip.utils';
import { SECURITY_CHECKS, SecurityCheckRow } from './security-anomaly.utils';

export async function gatherAndSendStatsSummary(prisma: PrismaClient): Promise<void> {
  const adminNotificationEmail = ENV.ADMIN_NOTIFICATION_EMAIL;
  if (!adminNotificationEmail) {
    throw new Error('adminNotificationEmail is not configured');
  }

  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const thirtyDaysAgo = subDays(now, 30);
  const ytdStart = startOfYear(now);

  logger.info('Gathering platform stats...');

  // --- Platform stats (run in parallel) ---
  const [
    activeSessions,
    newUsersLast7d,
    newUsersLast30d,
    newUsersYtd,
    salesforceOrgsTotal,
    salesforceOrgsNew7d,
    salesforceOrgsNew30d,
    payingIndividualUsers,
    payingTeams,
    passwordResetRequests7d,
    activeUserIds,
  ] = await Promise.all([
    prisma.sessions.count({ where: { expire: { gt: now } } }),
    prisma.user.count({ where: { createdAt: { gt: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gt: thirtyDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gt: ytdStart } } }),
    prisma.salesforceOrg.count(),
    prisma.salesforceOrg.count({ where: { createdAt: { gt: sevenDaysAgo } } }),
    prisma.salesforceOrg.count({ where: { createdAt: { gt: thirtyDaysAgo } } }),
    prisma.billingAccount.count({ where: { subscriptions: { some: { status: 'active' } } } }),
    prisma.teamBillingAccount.count({ where: { subscriptions: { some: { status: 'active' } } } }),
    prisma.loginActivity.count({ where: { action: 'PASSWORD_RESET_REQUEST', createdAt: { gt: sevenDaysAgo } } }),
    // Use findMany with distinct to count unique active users
    prisma.loginActivity.findMany({
      where: { action: 'LOGIN', success: true, createdAt: { gt: sevenDaysAgo }, userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    }),
  ]);

  const stats = {
    activeSessions,
    newUsersLast7d,
    newUsersLast30d,
    newUsersYtd,
    activeUsersLast7d: activeUserIds.length,
    salesforceOrgsTotal,
    salesforceOrgsNew7d,
    salesforceOrgsNew30d,
    payingIndividualUsers,
    payingTeams,
    passwordResetRequests7d,
  };

  logger.info(stats, 'Platform stats gathered');

  // --- Security checks (run in parallel) ---
  logger.info('Running security checks...');

  const checkResults = await Promise.all(
    SECURITY_CHECKS.map(async (check) => {
      try {
        const rows = await check.query(prisma);
        return { check, rows };
      } catch (error) {
        logger.error({ error, checkTitle: check.title }, 'Security check failed');
        return { check, rows: [] as SecurityCheckRow[] };
      }
    }),
  );

  // --- Geo-IP enrichment ---
  const allIps = new Set<string>();
  for (const { rows } of checkResults) {
    for (const row of rows) {
      if (row.ipAddress && typeof row.ipAddress === 'string') {
        allIps.add(row.ipAddress);
      }
    }
  }

  const geoIpMap = await lookupIpAddresses(Array.from(allIps));

  const enrichedResults = checkResults.map(({ check, rows }) => ({
    title: check.title,
    description: check.description,
    severity: check.severity,
    rows: rows.map((row) => {
      if (!row.ipAddress || typeof row.ipAddress !== 'string') {
        return row;
      }
      const geo = geoIpMap.get(row.ipAddress);
      return { ...row, location: formatLocation(geo) || null };
    }),
  }));

  const findingCounts = enrichedResults.filter((result) => result.rows.length > 0).length;
  logger.info({ findingCounts, totalChecks: enrichedResults.length }, 'Security checks complete');

  // --- Send email ---
  await sendStatsSummaryEmail({
    to: adminNotificationEmail,
    stats,
    securityResults: enrichedResults,
    generatedAt: now.toLocaleString('en-US', { timeZone: 'America/Denver', dateStyle: 'full', timeStyle: 'short' }),
  });

  logger.info({ to: adminNotificationEmail }, 'Stats summary email sent');
}

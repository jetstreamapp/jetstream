import { PrismaClient } from '@jetstream/prisma';
import { subDays, subHours } from 'date-fns';

export interface SecurityCheckRow {
  ipAddress?: string | null;
  [key: string]: unknown;
}

export interface SecurityCheck {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  query: (prisma: PrismaClient) => Promise<SecurityCheckRow[]>;
}

export const SECURITY_CHECKS: SecurityCheck[] = [
  {
    title: 'Brute Force — Failed Logins by IP (24h)',
    description: 'IPs with 10+ failed login attempts in the last 24 hours',
    severity: 'high',
    query: async (prisma) => {
      const last24h = subHours(new Date(), 24);
      const rows = await prisma.loginActivity.groupBy({
        by: ['ipAddress'],
        where: {
          success: false,
          action: 'LOGIN',
          createdAt: { gt: last24h },
          ipAddress: { not: null },
        },
        _count: { id: true },
        having: { id: { _count: { gte: 10 } } },
        orderBy: { _count: { id: 'desc' } },
      });
      return rows.map((row) => ({
        ipAddress: row.ipAddress,
        failedAttempts: row._count.id,
      }));
    },
  },
  {
    title: 'CAPTCHA Failures by IP (24h)',
    description: 'IPs with 5+ CAPTCHA failures in the last 24 hours — indicates likely bot activity',
    severity: 'high',
    query: async (prisma) => {
      const last24h = subHours(new Date(), 24);
      const rows = await prisma.loginActivity.groupBy({
        by: ['ipAddress'],
        where: {
          action: 'CAPTCHA_FAILED',
          createdAt: { gt: last24h },
          ipAddress: { not: null },
        },
        _count: { id: true },
        having: { id: { _count: { gte: 5 } } },
        orderBy: { _count: { id: 'desc' } },
      });
      return rows.map((row) => ({
        ipAddress: row.ipAddress,
        captchaFailures: row._count.id,
      }));
    },
  },
  {
    title: 'Currently Locked Accounts',
    description: 'Accounts locked due to too many failed login attempts',
    severity: 'medium',
    query: async (prisma) => {
      const rows = await prisma.user.findMany({
        where: { lockedUntil: { gt: new Date() } },
        select: { email: true, failedLoginAttempts: true, lockedUntil: true },
        orderBy: { lockedUntil: 'desc' },
      });
      return rows.map((row) => ({
        email: row.email,
        failedLoginAttempts: row.failedLoginAttempts,
        lockedUntil: row.lockedUntil?.toISOString() ?? null,
      }));
    },
  },
  // Token reuse is a common flow as they are long-lived tokens
  // {
  //   title: 'Login Token Reuse (7 days)',
  //   description: 'Desktop or web extension login tokens that were reused — may indicate token theft',
  //   severity: 'high',
  //   query: async (prisma) => {
  //     const last7d = subDays(new Date(), 7);
  //     const rows = await prisma.loginActivity.findMany({
  //       where: {
  //         action: { in: ['DESKTOP_LOGIN_TOKEN_REUSED', 'WEB_EXTENSION_LOGIN_TOKEN_REUSED'] },
  //         createdAt: { gt: last7d },
  //       },
  //       select: { action: true, email: true, ipAddress: true, userAgent: true, createdAt: true },
  //       orderBy: { createdAt: 'desc' },
  //     });
  //     return rows.map((row) => ({
  //       action: row.action,
  //       email: row.email ?? null,
  //       ipAddress: row.ipAddress ?? null,
  //       userAgent: row.userAgent ?? null,
  //       createdAt: row.createdAt.toISOString(),
  //     }));
  //   },
  // },
  {
    title: 'Login Failure Rate (7 days)',
    description: 'Overall login failure rate for the past 7 days — high values may indicate a coordinated attack',
    severity: 'low',
    query: async (prisma) => {
      const last7d = subDays(new Date(), 7);
      const [total, failed] = await Promise.all([
        prisma.loginActivity.count({ where: { action: 'LOGIN', createdAt: { gt: last7d } } }),
        prisma.loginActivity.count({ where: { action: 'LOGIN', success: false, createdAt: { gt: last7d } } }),
      ]);
      const failureRatePct = total > 0 ? ((failed / total) * 100).toFixed(1) : '0.0';
      // Only report if failure rate is noteworthy (>5%)
      if (total === 0 || parseFloat(failureRatePct) < 5) {
        return [];
      }
      return [{ period: 'Last 7 days', totalAttempts: total, failedAttempts: failed, failureRatePct: `${failureRatePct}%` }];
    },
  },
  {
    title: 'Credential Stuffing — IP Hitting Many Accounts (24h)',
    description: 'IPs with failed logins across 5+ distinct email addresses — spray attack pattern',
    severity: 'high',
    query: async (prisma) => {
      const last24h = subHours(new Date(), 24);
      const rows = await prisma.$queryRaw<Array<{ ipAddress: string; distinctEmails: bigint; failCount: bigint }>>`
        SELECT "ipAddress", COUNT(DISTINCT email) AS "distinctEmails", COUNT(*) AS "failCount"
        FROM "LoginActivity"
        WHERE action = 'LOGIN' AND success = false
          AND "createdAt" > ${last24h}
          AND "ipAddress" IS NOT NULL
        GROUP BY "ipAddress"
        HAVING COUNT(DISTINCT email) >= 5
        ORDER BY "distinctEmails" DESC
      `;
      return rows.map((row) => ({
        ipAddress: row.ipAddress,
        distinctEmails: Number(row.distinctEmails),
        failedAttempts: Number(row.failCount),
      }));
    },
  },
  {
    title: 'Successful Login After Repeated Failures (24h)',
    description: 'Accounts where 3+ failures were followed by a success within 1 hour — potential breach',
    severity: 'high',
    query: async (prisma) => {
      const last24h = subHours(new Date(), 24);
      const rows = await prisma.$queryRaw<
        Array<{ email: string; ipAddress: string | null; failCount: bigint; lastFail: Date; successfulLogin: Date }>
      >`
        WITH failed AS (
          SELECT email, "ipAddress", COUNT(*) AS fail_count, MAX("createdAt") AS last_fail
          FROM "LoginActivity"
          WHERE action = 'LOGIN' AND success = false
            AND "createdAt" > ${last24h}
          GROUP BY email, "ipAddress"
          HAVING COUNT(*) >= 3
        )
        SELECT f.email, f."ipAddress", f.fail_count AS "failCount", f.last_fail AS "lastFail",
               s."createdAt" AS "successfulLogin"
        FROM failed f
        JOIN "LoginActivity" s
          ON s.email = f.email AND s.action = 'LOGIN' AND s.success = true
          AND s."createdAt" > f.last_fail
          AND s."createdAt" < f.last_fail + INTERVAL '1 hour'
        ORDER BY f.fail_count DESC
      `;
      return rows.map((row) => ({
        email: row.email,
        ipAddress: row.ipAddress,
        failedAttempts: Number(row.failCount),
        lastFailure: row.lastFail instanceof Date ? row.lastFail.toISOString() : String(row.lastFail),
        successfulLogin: row.successfulLogin instanceof Date ? row.successfulLogin.toISOString() : String(row.successfulLogin),
      }));
    },
  },
  {
    title: 'Password Reset Abuse (24h)',
    description: 'Accounts with 3+ password reset requests in the last 24 hours — targeted reset flooding',
    severity: 'medium',
    query: async (prisma) => {
      const last24h = subHours(new Date(), 24);
      const rows = await prisma.loginActivity.groupBy({
        by: ['email'],
        where: {
          action: 'PASSWORD_RESET_REQUEST',
          createdAt: { gt: last24h },
          email: { not: null },
        },
        _count: { id: true },
        having: { id: { _count: { gte: 3 } } },
        orderBy: { _count: { id: 'desc' } },
      });
      return rows.map((row) => ({
        email: row.email,
        resetRequests: row._count.id,
      }));
    },
  },
  {
    title: 'Bot User Agents (7 days)',
    description: 'Login attempts from automated tools, scripts, or headless browsers',
    severity: 'medium',
    query: async (prisma) => {
      const last7d = subDays(new Date(), 7);
      const rows = await prisma.$queryRaw<
        Array<{ userAgent: string | null; eventCount: bigint; distinctUsers: bigint; distinctIps: bigint }>
      >`
        SELECT "userAgent", COUNT(*) AS "eventCount",
               COUNT(DISTINCT email) AS "distinctUsers",
               COUNT(DISTINCT "ipAddress") AS "distinctIps"
        FROM "LoginActivity"
        WHERE "createdAt" > ${last7d}
          AND ("userAgent" ILIKE '%python%'
            OR "userAgent" ILIKE '%curl%'
            OR "userAgent" ILIKE '%wget%'
            OR "userAgent" ILIKE '%httpclient%'
            OR "userAgent" ILIKE '%bot%'
            OR "userAgent" ILIKE '%headless%'
            OR "userAgent" ILIKE '%phantom%'
            OR "userAgent" ILIKE '%selenium%'
            OR "userAgent" ILIKE '%puppeteer%')
        GROUP BY "userAgent"
        ORDER BY "eventCount" DESC
      `;
      return rows.map((row) => ({
        userAgent: row.userAgent,
        eventCount: Number(row.eventCount),
        distinctUsers: Number(row.distinctUsers),
        distinctIps: Number(row.distinctIps),
      }));
    },
  },
];

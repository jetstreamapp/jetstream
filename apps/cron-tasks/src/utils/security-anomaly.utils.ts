import { PrismaClient } from '@jetstream/prisma';
import { subHours } from 'date-fns';
import { logger } from '../config/logger.config';

export const FAILED_LOGIN_THRESHOLD = 10;
export const SUSPICIOUS_IP_COUNT_THRESHOLD = 5;
export const IP_ATTACK_THRESHOLD = 20;
export const ANOMALY_WINDOW_HOURS = 24;

export interface UserAnomalyResult {
  userId: string;
  email: string | null;
  failedLoginCount: number;
  uniqueIpCount: number;
  reasons: string[];
}

export interface IpAnomalyResult {
  ipAddress: string;
  failedLoginCount: number;
  uniqueEmailCount: number;
}

export interface SecurityAnomalyReport {
  windowHours: number;
  scannedAt: Date;
  userAnomalies: UserAnomalyResult[];
  ipAnomalies: IpAnomalyResult[];
  totalAnomalousUsers: number;
  totalAnomalousIps: number;
}

/**
 * Build a list of human-readable reasons why a user's login activity is considered anomalous.
 * Pure function — no side effects, suitable for unit testing in isolation.
 */
export function buildUserAnomalyReasons(
  failedLoginCount: number,
  uniqueIpCount: number,
  failedLoginThreshold = FAILED_LOGIN_THRESHOLD,
  ipThreshold = SUSPICIOUS_IP_COUNT_THRESHOLD,
): string[] {
  const reasons: string[] = [];

  if (failedLoginCount >= failedLoginThreshold) {
    reasons.push(`${failedLoginCount} failed login attempts within the window (threshold: ${failedLoginThreshold})`);
  }

  if (uniqueIpCount >= ipThreshold) {
    reasons.push(`Login activity from ${uniqueIpCount} distinct IP addresses (threshold: ${ipThreshold})`);
  }

  return reasons;
}

/**
 * Scan recent LoginActivity records for suspicious patterns:
 *  1. Users with >= FAILED_LOGIN_THRESHOLD failed attempts in the window
 *  2. Users logging in from >= SUSPICIOUS_IP_COUNT_THRESHOLD distinct IPs
 *  3. Single IP addresses with >= IP_ATTACK_THRESHOLD failed attempts (brute-force / credential stuffing)
 */
export async function detectSecurityAnomalies(
  prisma: PrismaClient,
  windowHours = ANOMALY_WINDOW_HOURS,
  now = new Date(),
): Promise<SecurityAnomalyReport> {
  const windowStart = subHours(now, windowHours);

  // Aggregate failed-login counts per userId within the window.
  // Group only by userId (not email) to avoid splitting counts when multiple email values exist for one user.
  const failedByUser = await prisma.loginActivity.groupBy({
    by: ['userId'],
    where: {
      success: false,
      createdAt: { gte: windowStart },
      userId: { not: null },
    },
    _count: { id: true },
  });

  // Fetch all activity within the window that has both a userId and ipAddress.
  // This is used to compute IP diversity per user and to derive a representative email.
  const activityWithIp = await prisma.loginActivity.findMany({
    where: {
      createdAt: { gte: windowStart },
      userId: { not: null },
      ipAddress: { not: null },
    },
    select: {
      userId: true,
      email: true,
      ipAddress: true,
    },
  });

  // Build a userId → Set<ipAddress> map and a userId → email map (first non-null email wins)
  const ipsByUser = new Map<string, Set<string>>();
  const emailByUser = new Map<string, string | null>();
  for (const { userId, ipAddress, email } of activityWithIp) {
    if (!userId || !ipAddress) {
      continue;
    }
    if (!ipsByUser.has(userId)) {
      ipsByUser.set(userId, new Set());
    }
    ipsByUser.get(userId)!.add(ipAddress);
    if (!emailByUser.has(userId)) {
      emailByUser.set(userId, email);
    }
  }

  // Merge failed-login counts and IP diversity to identify anomalous users
  const failedCountByUser = new Map(failedByUser.map(({ userId, _count }) => [userId!, _count.id]));
  const allUserIds = new Set([...failedCountByUser.keys(), ...ipsByUser.keys()]);
  const userAnomalies: UserAnomalyResult[] = [];

  for (const userId of allUserIds) {
    const failedLoginCount = failedCountByUser.get(userId) ?? 0;
    const email = emailByUser.get(userId) ?? null;
    const uniqueIpCount = ipsByUser.get(userId)?.size ?? 0;
    const reasons = buildUserAnomalyReasons(failedLoginCount, uniqueIpCount);

    if (reasons.length > 0) {
      userAnomalies.push({ userId, email, failedLoginCount, uniqueIpCount, reasons });
    }
  }

  // Aggregate failed-login counts per IP address to find brute-force / credential-stuffing sources
  const failedByIp = await prisma.loginActivity.groupBy({
    by: ['ipAddress'],
    where: {
      success: false,
      createdAt: { gte: windowStart },
      ipAddress: { not: null },
    },
    _count: { id: true },
  });

  const suspiciousIpEntries = failedByIp.filter(({ _count }) => _count.id >= IP_ATTACK_THRESHOLD);

  const ipAnomalies: IpAnomalyResult[] = await Promise.all(
    suspiciousIpEntries.map(async ({ ipAddress, _count }) => {
      const distinctEmails = await prisma.loginActivity.findMany({
        where: {
          ipAddress,
          success: false,
          createdAt: { gte: windowStart },
          email: { not: null },
        },
        select: { email: true },
        distinct: ['email'],
      });

      return {
        ipAddress: ipAddress!,
        failedLoginCount: _count.id,
        uniqueEmailCount: distinctEmails.length,
      };
    }),
  );

  logger.info({ userAnomalyCount: userAnomalies.length, ipAnomalyCount: ipAnomalies.length }, 'Security anomaly scan complete');

  return {
    windowHours,
    scannedAt: now,
    userAnomalies,
    ipAnomalies,
    totalAnomalousUsers: userAnomalies.length,
    totalAnomalousIps: ipAnomalies.length,
  };
}

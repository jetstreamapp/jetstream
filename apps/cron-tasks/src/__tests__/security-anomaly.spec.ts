import { PrismaClient } from '@jetstream/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { subHours } from 'date-fns';
import * as dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';
import {
  buildUserAnomalyReasons,
  detectSecurityAnomalies,
  ANOMALY_WINDOW_HOURS,
  FAILED_LOGIN_THRESHOLD,
  IP_ATTACK_THRESHOLD,
  SUSPICIOUS_IP_COUNT_THRESHOLD,
} from '../utils/security-anomaly.utils';

dotenv.config();

const TEST_PREFIX = 'security-anomaly-test';

const adapter = new PrismaPg({
  connectionString: process.env.PRISMA_TEST_DB_URI || 'postgres://postgres:postgres@postgres:5432/testdb',
});
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestUser(lastLoggedIn: Date | null = new Date()) {
  const userId = uuid();
  return prisma.user.create({
    data: { id: userId, email: `${TEST_PREFIX}-${userId}@test.com`, name: userId, userId, lastLoggedIn },
  });
}

interface CreateLoginActivityOptions {
  userId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  success: boolean;
  createdAt?: Date;
  action?: string;
}

function buildLoginActivityData({
  userId = null,
  email = null,
  ipAddress = null,
  success,
  createdAt = new Date(),
  action = 'login',
}: CreateLoginActivityOptions) {
  return { userId, email: email ?? `${TEST_PREFIX}-anon@test.com`, ipAddress, success, createdAt, action };
}

async function insertLoginActivities(records: CreateLoginActivityOptions[]) {
  return prisma.loginActivity.createMany({
    data: records.map(buildLoginActivityData),
  });
}

// ---------------------------------------------------------------------------
// Unit tests — pure function, no database needed
// ---------------------------------------------------------------------------

describe('buildUserAnomalyReasons', () => {
  it('returns an empty array when both counts are below their thresholds', () => {
    const reasons = buildUserAnomalyReasons(FAILED_LOGIN_THRESHOLD - 1, SUSPICIOUS_IP_COUNT_THRESHOLD - 1);
    expect(reasons).toHaveLength(0);
  });

  it('returns a reason when failed-login count meets the threshold', () => {
    const reasons = buildUserAnomalyReasons(FAILED_LOGIN_THRESHOLD, 0);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain(String(FAILED_LOGIN_THRESHOLD));
  });

  it('returns a reason when failed-login count exceeds the threshold', () => {
    const count = FAILED_LOGIN_THRESHOLD + 5;
    const reasons = buildUserAnomalyReasons(count, 0);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain(String(count));
  });

  it('returns a reason when unique-IP count meets the threshold', () => {
    const reasons = buildUserAnomalyReasons(0, SUSPICIOUS_IP_COUNT_THRESHOLD);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain(String(SUSPICIOUS_IP_COUNT_THRESHOLD));
  });

  it('returns a reason when unique-IP count exceeds the threshold', () => {
    const count = SUSPICIOUS_IP_COUNT_THRESHOLD + 3;
    const reasons = buildUserAnomalyReasons(0, count);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain(String(count));
  });

  it('returns two reasons when both counts meet their thresholds', () => {
    const reasons = buildUserAnomalyReasons(FAILED_LOGIN_THRESHOLD, SUSPICIOUS_IP_COUNT_THRESHOLD);
    expect(reasons).toHaveLength(2);
  });

  it('respects custom threshold overrides', () => {
    // With a custom low threshold, a count of 3 should trigger
    const reasons = buildUserAnomalyReasons(3, 0, 3, 99);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('3');
  });

  it('does not flag activity when count is exactly one below the custom threshold', () => {
    const reasons = buildUserAnomalyReasons(2, 0, 3, 99);
    expect(reasons).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — require a running PostgreSQL instance
// ---------------------------------------------------------------------------

describe('detectSecurityAnomalies', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    // Remove test login activity and users created by previous runs
    await prisma.loginActivity.deleteMany({
      where: { email: { contains: TEST_PREFIX } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns an empty report when there is no login activity', async () => {
    const report = await detectSecurityAnomalies(prisma);

    expect(report.userAnomalies).toHaveLength(0);
    expect(report.ipAnomalies).toHaveLength(0);
    expect(report.totalAnomalousUsers).toBe(0);
    expect(report.totalAnomalousIps).toBe(0);
    expect(report.windowHours).toBe(ANOMALY_WINDOW_HOURS);
  });

  it('returns an empty report when failed logins are below the user threshold', async () => {
    const user = await createTestUser();
    const count = FAILED_LOGIN_THRESHOLD - 1;
    const now = new Date();

    await insertLoginActivities(
      Array.from({ length: count }, () => ({
        userId: user.id,
        email: user.email,
        ipAddress: '10.0.0.1',
        success: false,
        createdAt: subHours(now, 1),
      })),
    );

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    expect(report.userAnomalies).toHaveLength(0);
    expect(report.totalAnomalousUsers).toBe(0);
  });

  it('flags a user who has >= FAILED_LOGIN_THRESHOLD failed logins within the window', async () => {
    const user = await createTestUser();
    const now = new Date();

    await insertLoginActivities(
      Array.from({ length: FAILED_LOGIN_THRESHOLD }, () => ({
        userId: user.id,
        email: user.email,
        ipAddress: '10.0.0.2',
        success: false,
        createdAt: subHours(now, 1),
      })),
    );

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    const anomaly = report.userAnomalies.find(({ userId }) => userId === user.id);
    expect(anomaly).toBeDefined();
    expect(anomaly!.failedLoginCount).toBe(FAILED_LOGIN_THRESHOLD);
    expect(anomaly!.reasons.some((reason) => reason.includes('failed login'))).toBe(true);
    expect(report.totalAnomalousUsers).toBeGreaterThanOrEqual(1);
  });

  it('flags a user with more failed logins than the threshold', async () => {
    const user = await createTestUser();
    const extraCount = FAILED_LOGIN_THRESHOLD + 5;
    const now = new Date();

    await insertLoginActivities(
      Array.from({ length: extraCount }, () => ({
        userId: user.id,
        email: user.email,
        ipAddress: '10.0.0.3',
        success: false,
        createdAt: subHours(now, 2),
      })),
    );

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    const anomaly = report.userAnomalies.find(({ userId }) => userId === user.id);
    expect(anomaly).toBeDefined();
    expect(anomaly!.failedLoginCount).toBe(extraCount);
  });

  it('flags a user logging in from >= SUSPICIOUS_IP_COUNT_THRESHOLD distinct IPs', async () => {
    const user = await createTestUser();
    const now = new Date();

    // One successful login per unique IP address
    await insertLoginActivities(
      Array.from({ length: SUSPICIOUS_IP_COUNT_THRESHOLD }, (_, index) => ({
        userId: user.id,
        email: user.email,
        ipAddress: `192.168.1.${index + 1}`,
        success: true,
        createdAt: subHours(now, 1),
      })),
    );

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    const anomaly = report.userAnomalies.find(({ userId }) => userId === user.id);
    expect(anomaly).toBeDefined();
    expect(anomaly!.uniqueIpCount).toBe(SUSPICIOUS_IP_COUNT_THRESHOLD);
    expect(anomaly!.reasons.some((reason) => reason.includes('IP'))).toBe(true);
  });

  it('flags a user who triggers both failed-login and multi-IP anomalies', async () => {
    const user = await createTestUser();
    const now = new Date();

    // Many failed logins from many IPs
    await insertLoginActivities(
      Array.from({ length: FAILED_LOGIN_THRESHOLD }, (_, index) => ({
        userId: user.id,
        email: user.email,
        ipAddress: `172.16.0.${(index % SUSPICIOUS_IP_COUNT_THRESHOLD) + 1}`,
        success: false,
        createdAt: subHours(now, 1),
      })),
    );
    // Additional IPs to ensure diversity meets threshold
    await insertLoginActivities(
      Array.from({ length: SUSPICIOUS_IP_COUNT_THRESHOLD }, (_, index) => ({
        userId: user.id,
        email: user.email,
        ipAddress: `172.17.0.${index + 1}`,
        success: true,
        createdAt: subHours(now, 1),
      })),
    );

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    const anomaly = report.userAnomalies.find(({ userId }) => userId === user.id);
    expect(anomaly).toBeDefined();
    expect(anomaly!.reasons).toHaveLength(2);
  });

  it('does not count failed logins that are outside the time window', async () => {
    const user = await createTestUser();
    const now = new Date();

    // Old failed logins — beyond the window
    await insertLoginActivities(
      Array.from({ length: FAILED_LOGIN_THRESHOLD }, () => ({
        userId: user.id,
        email: user.email,
        ipAddress: '10.1.1.1',
        success: false,
        createdAt: subHours(now, ANOMALY_WINDOW_HOURS + 1),
      })),
    );

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    const anomaly = report.userAnomalies.find(({ userId }) => userId === user.id);
    expect(anomaly).toBeUndefined();
  });

  it('counts only recent failed logins when mixed with old ones', async () => {
    const user = await createTestUser();
    const now = new Date();
    const recentCount = FAILED_LOGIN_THRESHOLD - 1;

    // Old records that should be ignored
    await insertLoginActivities(
      Array.from({ length: FAILED_LOGIN_THRESHOLD }, () => ({
        userId: user.id,
        email: user.email,
        ipAddress: '10.2.2.2',
        success: false,
        createdAt: subHours(now, ANOMALY_WINDOW_HOURS + 2),
      })),
    );

    // Recent records below the threshold
    await insertLoginActivities(
      Array.from({ length: recentCount }, () => ({
        userId: user.id,
        email: user.email,
        ipAddress: '10.2.2.2',
        success: false,
        createdAt: subHours(now, 1),
      })),
    );

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    const anomaly = report.userAnomalies.find(({ userId }) => userId === user.id);
    expect(anomaly).toBeUndefined();
  });

  it('flags an IP address with >= IP_ATTACK_THRESHOLD failed attempts', async () => {
    const attackIp = '203.0.113.1';
    const now = new Date();

    await insertLoginActivities(
      Array.from({ length: IP_ATTACK_THRESHOLD }, (_, index) => ({
        userId: null,
        email: `${TEST_PREFIX}-victim-${index}@test.com`,
        ipAddress: attackIp,
        success: false,
        createdAt: subHours(now, 1),
      })),
    );

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    const ipAnomaly = report.ipAnomalies.find(({ ipAddress }) => ipAddress === attackIp);
    expect(ipAnomaly).toBeDefined();
    expect(ipAnomaly!.failedLoginCount).toBe(IP_ATTACK_THRESHOLD);
    expect(ipAnomaly!.uniqueEmailCount).toBe(IP_ATTACK_THRESHOLD);
    expect(report.totalAnomalousIps).toBeGreaterThanOrEqual(1);
  });

  it('does not flag an IP with fewer failed attempts than the threshold', async () => {
    const safeIp = '203.0.113.2';
    const now = new Date();

    await insertLoginActivities(
      Array.from({ length: IP_ATTACK_THRESHOLD - 1 }, (_, index) => ({
        userId: null,
        email: `${TEST_PREFIX}-victim2-${index}@test.com`,
        ipAddress: safeIp,
        success: false,
        createdAt: subHours(now, 1),
      })),
    );

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    const ipAnomaly = report.ipAnomalies.find(({ ipAddress }) => ipAddress === safeIp);
    expect(ipAnomaly).toBeUndefined();
  });

  it('correctly deduplicates emails when counting unique targets for an IP', async () => {
    const attackIp = '203.0.113.3';
    const now = new Date();
    const distinctEmails = 3;
    const attemptsPerEmail = Math.ceil(IP_ATTACK_THRESHOLD / distinctEmails) + 1;

    const records = Array.from({ length: distinctEmails }).flatMap((_, emailIndex) =>
      Array.from({ length: attemptsPerEmail }, () => ({
        userId: null,
        email: `${TEST_PREFIX}-target-${emailIndex}@test.com`,
        ipAddress: attackIp,
        success: false,
        createdAt: subHours(now, 1),
      })),
    );

    await insertLoginActivities(records);

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    const ipAnomaly = report.ipAnomalies.find(({ ipAddress }) => ipAddress === attackIp);
    expect(ipAnomaly).toBeDefined();
    expect(ipAnomaly!.uniqueEmailCount).toBe(distinctEmails);
  });

  it('scopes anomaly detection correctly across multiple users', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const now = new Date();

    // User A: anomalous — many failed logins
    await insertLoginActivities(
      Array.from({ length: FAILED_LOGIN_THRESHOLD }, () => ({
        userId: userA.id,
        email: userA.email,
        ipAddress: '10.10.0.1',
        success: false,
        createdAt: subHours(now, 1),
      })),
    );

    // User B: normal — few failed logins
    await insertLoginActivities(
      Array.from({ length: 2 }, () => ({
        userId: userB.id,
        email: userB.email,
        ipAddress: '10.10.0.2',
        success: false,
        createdAt: subHours(now, 1),
      })),
    );

    const report = await detectSecurityAnomalies(prisma, ANOMALY_WINDOW_HOURS, now);

    const anomalyA = report.userAnomalies.find(({ userId }) => userId === userA.id);
    const anomalyB = report.userAnomalies.find(({ userId }) => userId === userB.id);

    expect(anomalyA).toBeDefined();
    expect(anomalyB).toBeUndefined();
  });

  it('includes scannedAt and windowHours in the report metadata', async () => {
    const customWindowHours = 12;
    const now = new Date('2025-06-15T10:00:00Z');

    const report = await detectSecurityAnomalies(prisma, customWindowHours, now);

    expect(report.scannedAt).toEqual(now);
    expect(report.windowHours).toBe(customWindowHours);
  });
});

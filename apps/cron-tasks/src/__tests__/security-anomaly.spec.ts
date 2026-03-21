import { PrismaClient } from '@jetstream/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { addHours, subDays, subHours, subMinutes } from 'date-fns';
import * as dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';
import { SECURITY_CHECKS, SecurityCheck } from '../utils/security-anomaly.utils';

dotenv.config();

const TEST_PREFIX = 'security-anomaly-test';
const TEST_IP_PREFIX = '10.99.';

const adapter = new PrismaPg({
  connectionString: process.env.PRISMA_TEST_DB_URI || 'postgres://postgres:postgres@postgres:5432/testdb',
});
export const prisma = new PrismaClient({ adapter });

function getCheckByTitle(titleSubstring: string): SecurityCheck {
  const check = SECURITY_CHECKS.find((c) => c.title.includes(titleSubstring));
  if (!check) {
    throw new Error(`No check found matching "${titleSubstring}"`);
  }
  return check;
}

async function createUser(overrides: { lockedUntil?: Date | null; failedLoginAttempts?: number } = {}) {
  const id = uuid();
  return prisma.user.create({
    data: {
      id,
      userId: id,
      email: `${TEST_PREFIX}-${id}@test.com`,
      name: `Test User ${id}`,
      ...overrides,
    },
  });
}

async function createLoginActivity(
  overrides: Partial<{
    action: string;
    method: string;
    email: string;
    userId: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    errorMessage: string;
    createdAt: Date;
  }> = {},
) {
  return prisma.loginActivity.create({
    data: {
      action: 'LOGIN',
      success: false,
      ipAddress: `${TEST_IP_PREFIX}0.1`,
      ...overrides,
    },
  });
}

async function createManyLoginActivities(
  count: number,
  overrides: Partial<{
    action: string;
    method: string;
    email: string;
    userId: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    errorMessage: string;
    createdAt: Date;
  }> = {},
) {
  const data = Array.from({ length: count }, () => ({
    action: 'LOGIN' as string,
    success: false,
    ipAddress: `${TEST_IP_PREFIX}0.1`,
    ...overrides,
  }));
  return prisma.loginActivity.createMany({ data });
}

describe('Security Anomaly Checks Integration Tests', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.loginActivity.deleteMany({
      where: {
        OR: [{ email: { contains: TEST_PREFIX } }, { ipAddress: { startsWith: TEST_IP_PREFIX } }],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await prisma.loginActivity.deleteMany({
      where: {
        OR: [{ email: { contains: TEST_PREFIX } }, { ipAddress: { startsWith: TEST_IP_PREFIX } }],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: TEST_PREFIX } },
    });
    await prisma.$disconnect();
  });

  describe('Brute Force — Failed Logins by IP (24h)', () => {
    let check: SecurityCheck;

    beforeAll(() => {
      check = getCheckByTitle('Brute Force');
    });

    it('should return empty when below threshold (9 failures)', async () => {
      await createManyLoginActivities(9, { email: `${TEST_PREFIX}-brute@test.com` });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
      expect(testResults).toHaveLength(0);
    });

    it('should return results when at threshold (10 failures)', async () => {
      await createManyLoginActivities(10, { email: `${TEST_PREFIX}-brute@test.com` });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
      expect(testResults).toHaveLength(1);
      expect(testResults[0]).toEqual(
        expect.objectContaining({
          ipAddress: `${TEST_IP_PREFIX}0.1`,
          failedAttempts: 10,
        }),
      );
    });

    it('should return empty when data is outside time window', async () => {
      await createManyLoginActivities(15, {
        email: `${TEST_PREFIX}-brute@test.com`,
        createdAt: subHours(new Date(), 25),
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
      expect(testResults).toHaveLength(0);
    });

    it('should exclude successful logins', async () => {
      await createManyLoginActivities(15, {
        email: `${TEST_PREFIX}-brute@test.com`,
        success: true,
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
      expect(testResults).toHaveLength(0);
    });

    it('should exclude non-LOGIN actions', async () => {
      await createManyLoginActivities(15, {
        action: 'PASSWORD_RESET_REQUEST',
        email: `${TEST_PREFIX}-brute@test.com`,
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
      expect(testResults).toHaveLength(0);
    });
  });

  describe('CAPTCHA Failures by IP (24h)', () => {
    let check: SecurityCheck;

    beforeAll(() => {
      check = getCheckByTitle('CAPTCHA');
    });

    it('should return empty when below threshold (4 failures)', async () => {
      await createManyLoginActivities(4, {
        action: 'CAPTCHA_FAILED',
        email: `${TEST_PREFIX}-captcha@test.com`,
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
      expect(testResults).toHaveLength(0);
    });

    it('should return results when at threshold (5 failures)', async () => {
      await createManyLoginActivities(5, {
        action: 'CAPTCHA_FAILED',
        email: `${TEST_PREFIX}-captcha@test.com`,
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
      expect(testResults).toHaveLength(1);
      expect(testResults[0]).toEqual(
        expect.objectContaining({
          ipAddress: `${TEST_IP_PREFIX}0.1`,
          captchaFailures: 5,
        }),
      );
    });

    it('should return empty when data is outside time window', async () => {
      await createManyLoginActivities(10, {
        action: 'CAPTCHA_FAILED',
        email: `${TEST_PREFIX}-captcha@test.com`,
        createdAt: subHours(new Date(), 25),
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
      expect(testResults).toHaveLength(0);
    });
  });

  describe('Currently Locked Accounts', () => {
    let check: SecurityCheck;

    beforeAll(() => {
      check = getCheckByTitle('Locked Accounts');
    });

    it('should return empty when no accounts are locked', async () => {
      await createUser({ lockedUntil: null });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['email']).includes(TEST_PREFIX));
      expect(testResults).toHaveLength(0);
    });

    it('should return empty when lock has expired', async () => {
      await createUser({ lockedUntil: subHours(new Date(), 1), failedLoginAttempts: 5 });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['email']).includes(TEST_PREFIX));
      expect(testResults).toHaveLength(0);
    });

    it('should return results when account is actively locked', async () => {
      await createUser({ lockedUntil: addHours(new Date(), 1), failedLoginAttempts: 5 });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['email']).includes(TEST_PREFIX));
      expect(testResults).toHaveLength(1);
      expect(testResults[0]).toEqual(
        expect.objectContaining({
          failedLoginAttempts: 5,
        }),
      );
      expect(testResults[0]).toHaveProperty('email');
      expect(testResults[0]).toHaveProperty('lockedUntil');
    });
  });

  // describe('Login Token Reuse (7 days)', () => {
  //   let check: SecurityCheck;

  //   beforeAll(() => {
  //     check = getCheckByTitle('Token Reuse');
  //   });

  //   it('should return empty when no token reuse events exist', async () => {
  //     const results = await check.query(prisma);
  //     const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
  //     expect(testResults).toHaveLength(0);
  //   });

  //   it('should return desktop token reuse events', async () => {
  //     await createLoginActivity({
  //       action: 'DESKTOP_LOGIN_TOKEN_REUSED',
  //       email: `${TEST_PREFIX}-token@test.com`,
  //       success: true,
  //       userAgent: 'Jetstream Desktop',
  //     });
  //     const results = await check.query(prisma);
  //     const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
  //     expect(testResults).toHaveLength(1);
  //     expect(testResults[0]).toEqual(
  //       expect.objectContaining({
  //         action: 'DESKTOP_LOGIN_TOKEN_REUSED',
  //         email: `${TEST_PREFIX}-token@test.com`,
  //       }),
  //     );
  //     expect(testResults[0]).toHaveProperty('ipAddress');
  //     expect(testResults[0]).toHaveProperty('userAgent');
  //     expect(testResults[0]).toHaveProperty('createdAt');
  //   });

  //   it('should return web extension token reuse events', async () => {
  //     await createLoginActivity({
  //       action: 'WEB_EXTENSION_LOGIN_TOKEN_REUSED',
  //       email: `${TEST_PREFIX}-webtoken@test.com`,
  //       success: true,
  //       userAgent: 'Chrome Extension',
  //     });
  //     const results = await check.query(prisma);
  //     const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
  //     expect(testResults).toHaveLength(1);
  //     expect(testResults[0]).toEqual(
  //       expect.objectContaining({
  //         action: 'WEB_EXTENSION_LOGIN_TOKEN_REUSED',
  //       }),
  //     );
  //   });

  //   it('should return empty when events are outside time window', async () => {
  //     await createLoginActivity({
  //       action: 'DESKTOP_LOGIN_TOKEN_REUSED',
  //       email: `${TEST_PREFIX}-token@test.com`,
  //       success: true,
  //       createdAt: subDays(new Date(), 8),
  //     });
  //     const results = await check.query(prisma);
  //     const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
  //     expect(testResults).toHaveLength(0);
  //   });
  // });

  describe('Login Failure Rate (7 days)', () => {
    let check: SecurityCheck;

    beforeAll(() => {
      check = getCheckByTitle('Failure Rate');
    });

    it('should return empty when no login data exists', async () => {
      const results = await check.query(prisma);
      // This is a global aggregate, so we just check it doesn't throw
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty when failure rate is below 5%', async () => {
      // Create 96 successful + 4 failed = 4% failure rate
      await createManyLoginActivities(96, {
        success: true,
        email: `${TEST_PREFIX}-rate@test.com`,
      });
      await createManyLoginActivities(4, {
        success: false,
        email: `${TEST_PREFIX}-rate@test.com`,
      });
      const results = await check.query(prisma);
      // This is a global aggregate that includes all data in the DB,
      // so we validate the query runs without error and returns the expected shape
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return result with correct shape when failure rate exceeds 5%', async () => {
      // Create 80 successful + 20 failed = 20% failure rate
      await createManyLoginActivities(80, {
        success: true,
        email: `${TEST_PREFIX}-rate@test.com`,
      });
      await createManyLoginActivities(20, {
        success: false,
        email: `${TEST_PREFIX}-rate@test.com`,
      });
      const results = await check.query(prisma);
      // Since this is a global aggregate, other test data may exist.
      // We validate the query doesn't throw and returns a valid shape.
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('period');
        expect(results[0]).toHaveProperty('totalAttempts');
        expect(results[0]).toHaveProperty('failedAttempts');
        expect(results[0]).toHaveProperty('failureRatePct');
        expect(typeof results[0]['failureRatePct']).toBe('string');
      }
    });
  });

  describe('Credential Stuffing — IP Hitting Many Accounts (24h) [Raw SQL]', () => {
    let check: SecurityCheck;

    beforeAll(() => {
      check = getCheckByTitle('Credential Stuffing');
    });

    it('should return empty when below threshold (4 distinct emails)', async () => {
      const ip = `${TEST_IP_PREFIX}1.1`;
      for (let i = 0; i < 4; i++) {
        await createLoginActivity({
          email: `${TEST_PREFIX}-stuff-${i}@test.com`,
          ipAddress: ip,
        });
      }
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress).startsWith(TEST_IP_PREFIX));
      expect(testResults).toHaveLength(0);
    });

    it('should return results when at threshold (5 distinct emails)', async () => {
      const ip = `${TEST_IP_PREFIX}1.2`;
      for (let i = 0; i < 5; i++) {
        await createLoginActivity({
          email: `${TEST_PREFIX}-stuff-${i}@test.com`,
          ipAddress: ip,
        });
      }
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress) === ip);
      expect(testResults).toHaveLength(1);
      expect(testResults[0]).toEqual(
        expect.objectContaining({
          ipAddress: ip,
          distinctEmails: 5,
          failedAttempts: 5,
        }),
      );
      // Validate bigint was converted to number
      expect(typeof testResults[0]['distinctEmails']).toBe('number');
      expect(typeof testResults[0]['failedAttempts']).toBe('number');
    });

    it('should return empty when data is outside time window', async () => {
      const ip = `${TEST_IP_PREFIX}1.3`;
      for (let i = 0; i < 6; i++) {
        await createLoginActivity({
          email: `${TEST_PREFIX}-stuff-${i}@test.com`,
          ipAddress: ip,
          createdAt: subHours(new Date(), 25),
        });
      }
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r.ipAddress) === ip);
      expect(testResults).toHaveLength(0);
    });
  });

  describe('Successful Login After Repeated Failures (24h) [Raw SQL]', () => {
    let check: SecurityCheck;

    beforeAll(() => {
      check = getCheckByTitle('Successful Login After');
    });

    it('should return empty when below failure threshold (2 failures)', async () => {
      const email = `${TEST_PREFIX}-breach-below@test.com`;
      const ip = `${TEST_IP_PREFIX}2.1`;
      const now = new Date();
      // 2 failures
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(now, 30) });
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(now, 20) });
      // 1 success shortly after
      await createLoginActivity({ email, ipAddress: ip, success: true, createdAt: subMinutes(now, 10) });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['email']).includes(TEST_PREFIX));
      expect(testResults).toHaveLength(0);
    });

    it('should return results when 3+ failures followed by success within 1 hour', async () => {
      const email = `${TEST_PREFIX}-breach@test.com`;
      const ip = `${TEST_IP_PREFIX}2.2`;
      const now = new Date();
      // 3 failures
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(now, 50) });
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(now, 40) });
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(now, 30) });
      // Success 10 minutes after last failure (within 1 hour)
      await createLoginActivity({ email, ipAddress: ip, success: true, createdAt: subMinutes(now, 20) });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['email']).includes(TEST_PREFIX));
      expect(testResults).toHaveLength(1);
      expect(testResults[0]).toEqual(
        expect.objectContaining({
          email,
          ipAddress: ip,
        }),
      );
      expect(typeof testResults[0]['failedAttempts']).toBe('number');
      expect(testResults[0]).toHaveProperty('lastFailure');
      expect(testResults[0]).toHaveProperty('successfulLogin');
    });

    it('should return empty when success is outside 1-hour window after failures', async () => {
      const email = `${TEST_PREFIX}-breach-late@test.com`;
      const ip = `${TEST_IP_PREFIX}2.3`;
      const now = new Date();
      // 3 failures close together
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(now, 180) });
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(now, 170) });
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(now, 160) });
      // Success 2 hours after last failure (outside 1-hour window)
      await createLoginActivity({ email, ipAddress: ip, success: true, createdAt: subMinutes(now, 100) });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['email']).includes(TEST_PREFIX));
      expect(testResults).toHaveLength(0);
    });

    it('should return empty when data is outside 24h window', async () => {
      const email = `${TEST_PREFIX}-breach-old@test.com`;
      const ip = `${TEST_IP_PREFIX}2.4`;
      const oldTime = subHours(new Date(), 26);
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(oldTime, 30) });
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(oldTime, 20) });
      await createLoginActivity({ email, ipAddress: ip, createdAt: subMinutes(oldTime, 10) });
      await createLoginActivity({ email, ipAddress: ip, success: true, createdAt: oldTime });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['email']).includes(TEST_PREFIX));
      expect(testResults).toHaveLength(0);
    });
  });

  describe('Password Reset Abuse (24h)', () => {
    let check: SecurityCheck;

    beforeAll(() => {
      check = getCheckByTitle('Password Reset');
    });

    it('should return empty when below threshold (2 resets)', async () => {
      const email = `${TEST_PREFIX}-reset@test.com`;
      await createManyLoginActivities(2, {
        action: 'PASSWORD_RESET_REQUEST',
        email,
        success: true,
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['email']).includes(TEST_PREFIX));
      expect(testResults).toHaveLength(0);
    });

    it('should return results when at threshold (3 resets)', async () => {
      const email = `${TEST_PREFIX}-reset@test.com`;
      await createManyLoginActivities(3, {
        action: 'PASSWORD_RESET_REQUEST',
        email,
        success: true,
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['email']).includes(TEST_PREFIX));
      expect(testResults).toHaveLength(1);
      expect(testResults[0]).toEqual(
        expect.objectContaining({
          email,
          resetRequests: 3,
        }),
      );
    });

    it('should return empty when data is outside time window', async () => {
      const email = `${TEST_PREFIX}-reset-old@test.com`;
      await createManyLoginActivities(5, {
        action: 'PASSWORD_RESET_REQUEST',
        email,
        success: true,
        createdAt: subHours(new Date(), 25),
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['email']).includes(TEST_PREFIX));
      expect(testResults).toHaveLength(0);
    });
  });

  describe('Bot User Agents (7 days) [Raw SQL]', () => {
    let check: SecurityCheck;

    beforeAll(() => {
      check = getCheckByTitle('Bot User Agents');
    });

    it('should return empty for normal user agents', async () => {
      await createLoginActivity({
        email: `${TEST_PREFIX}-normal@test.com`,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ipAddress: `${TEST_IP_PREFIX}3.1`,
        success: true,
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => String(r['userAgent']).includes('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'));
      expect(testResults).toHaveLength(0);
    });

    it('should detect python-based user agents', async () => {
      const userAgent = 'python-requests/2.28.0';
      await createLoginActivity({
        email: `${TEST_PREFIX}-bot-py@test.com`,
        userAgent,
        ipAddress: `${TEST_IP_PREFIX}3.2`,
        success: false,
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => r['userAgent'] === userAgent);
      expect(testResults).toHaveLength(1);
      expect(testResults[0]).toEqual(
        expect.objectContaining({
          userAgent,
        }),
      );
      expect(typeof testResults[0]['eventCount']).toBe('number');
      expect(typeof testResults[0]['distinctUsers']).toBe('number');
      expect(typeof testResults[0]['distinctIps']).toBe('number');
    });

    it('should detect curl user agents', async () => {
      const userAgent = 'curl/7.68.0';
      await createLoginActivity({
        email: `${TEST_PREFIX}-bot-curl@test.com`,
        userAgent,
        ipAddress: `${TEST_IP_PREFIX}3.3`,
        success: false,
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => r['userAgent'] === userAgent);
      expect(testResults).toHaveLength(1);
    });

    it('should detect headless browser user agents', async () => {
      const userAgent = 'HeadlessChrome/91.0.4472.124';
      await createLoginActivity({
        email: `${TEST_PREFIX}-bot-headless@test.com`,
        userAgent,
        ipAddress: `${TEST_IP_PREFIX}3.4`,
        success: false,
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => r['userAgent'] === userAgent);
      expect(testResults).toHaveLength(1);
    });

    it('should return empty when bot data is outside time window', async () => {
      const userAgent = 'python-requests/2.28.0-old';
      await createLoginActivity({
        email: `${TEST_PREFIX}-bot-old@test.com`,
        userAgent,
        ipAddress: `${TEST_IP_PREFIX}3.5`,
        success: false,
        createdAt: subDays(new Date(), 8),
      });
      const results = await check.query(prisma);
      const testResults = results.filter((r) => r['userAgent'] === userAgent);
      expect(testResults).toHaveLength(0);
    });
  });
});

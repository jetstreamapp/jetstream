import { sendEmail } from '@jetstream/api-config';
import { createAuditLog } from '@jetstream/audit-logs';
import { sendOrgExpirationWarningEmail } from '@jetstream/email';
import { PrismaClient } from '@jetstream/prisma';
import {
  ORG_EXPIRATION_CONNECTION_ERROR,
  ORG_EXPIRATION_WARNING_WINDOW_DAYS,
  ORG_INACTIVITY_EXPIRATION_DAYS,
  ORG_SCHEDULE_AFTER_IDLE_DAYS,
} from '@jetstream/shared/utils';
import { PrismaPg } from '@prisma/adapter-pg';
import { addDays, endOfDay, subDays } from 'date-fns';
import * as dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';
import { vi } from 'vitest';
import { manageOrgExpiration } from '../utils/salesforce-org-expiration.utils';

dotenv.config();

const TEST_PREFIX = 'org-expiration-test';

vi.mock('@jetstream/email', () => {
  return {
    sendOrgExpirationWarningEmail: vi.fn(),
  };
});
vi.mock('@jetstream/api-config', () => {
  return {
    sendEmail: vi.fn(),
    DbCacheProvider: vi.fn().mockImplementation(function () {
      this.saveAsync = vi.fn().mockResolvedValue(null);
      this.getAsync = vi.fn().mockResolvedValue(null);
      this.removeAsync = vi.fn().mockResolvedValue(null);
    }),
  };
});

vi.mock('papaparse', () => {
  return {
    default: {
      unparse: vi.fn((data) => {
        // Simple CSV implementation for testing
        if (!data || data.length === 0) return '';
        const keys = Object.keys(data[0]);
        const header = keys.join(',');
        const rows = data.map((row: any) => keys.map((key) => row[key]).join(','));
        return [header, ...rows].join('\n');
      }),
    },
  };
});

vi.mock('@jetstream/audit-logs', () => {
  return {
    createAuditLog: vi.fn(),
    AuditLogAction: {
      ORG_REACTIVATED: 'ORG_REACTIVATED',
      ORG_EXPIRATION_WARNING: 'ORG_EXPIRATION_WARNING',
      ORG_EXPIRED: 'ORG_EXPIRED',
      ORG_CREDENTIALS_EXPIRED: 'ORG_CREDENTIALS_EXPIRED',
    },
    AuditLogResource: {
      SALESFORCE_ORG: 'salesforce_org',
    },
  };
});

let orgCounter = 0;
// Ensure this runs against a test database
const adapter = new PrismaPg({
  connectionString: process.env.PRISMA_TEST_DB_URI || 'postgres://postgres:postgres@postgres:5432/testdb',
});
export const prisma = new PrismaClient({ adapter });

export async function createUser(lastLoggedIn: Date | null = new Date()) {
  const userId = uuid();
  return await prisma.user.create({
    data: { id: userId, email: `${TEST_PREFIX}-${userId}@test.com`, name: userId, userId, lastLoggedIn },
  });
}

export async function createOrg({
  userId,
  lastActivityAt = null,
  expirationScheduledFor = null,
  nextExpirationNotificationDate = null,
  connectionError = null,
  accessToken = 'test_access_token',
}: {
  userId: string;
  lastActivityAt?: Date | null;
  expirationScheduledFor?: Date | null;
  nextExpirationNotificationDate?: Date | null;
  connectionError?: string | null;
  accessToken?: string;
}) {
  const counter = orgCounter++;
  const sfdcUserId = `005${counter.toString().padStart(12, '0')}AAI`;
  const orgId = `00D${counter.toString().padStart(12, '0')}EAO`;

  return await prisma.salesforceOrg.create({
    data: {
      jetstreamUserId2: userId,
      jetstreamUserId: `user-${counter}`,
      jetstreamUrl: 'https://jetstream.example.com',
      jetstreamOrganizationId: null,
      label: `org-${counter}`,
      uniqueId: `${orgId}-${sfdcUserId}`,
      accessToken,
      instanceUrl: 'https://test.my.salesforce.com',
      loginUrl: 'https://test.my.salesforce.com',
      userId: sfdcUserId,
      email: 'test@test.com',
      organizationId: orgId,
      username: `user${counter}@test.com`,
      displayName: 'test user',
      thumbnail: null,
      apiVersion: null,
      orgName: 'Test Org',
      orgCountry: 'US',
      orgOrganizationType: 'Enterprise Edition',
      orgInstanceName: 'USA1054',
      orgIsSandbox: false,
      orgLanguageLocaleKey: 'en_US',
      orgNamespacePrefix: null,
      orgTrialExpirationDate: null,
      connectionError,
      filterText: `test`,
      lastActivityAt,
      expirationScheduledFor,
      nextExpirationNotificationDate,
    },
  });
}

describe('Org Expiration Integration Tests', () => {
  let testUser: Awaited<ReturnType<typeof createUser>>;
  const mockSendEmail = sendOrgExpirationWarningEmail as vi.MockedFunction<typeof sendOrgExpirationWarningEmail>;
  const mockSendEmailConfig = sendEmail as vi.MockedFunction<typeof sendEmail>;
  const mockCreateAuditLog = createAuditLog as vi.MockedFunction<typeof createAuditLog>;

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clean up only test-specific records
    await prisma.salesforceOrg.deleteMany({
      where: { jetstreamUser: { email: { contains: TEST_PREFIX } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: TEST_PREFIX } },
    });
    testUser = await createUser();
  });

  afterAll(async () => {
    await prisma.salesforceOrg.deleteMany({
      where: { jetstreamUser: { email: { contains: TEST_PREFIX } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: TEST_PREFIX } },
    });
    await prisma.$disconnect();
  });
  describe('Scheduling orgs for expiration', () => {
    it('should schedule an org that just crossed into the warning window', async () => {
      const now = new Date();

      await createOrg({
        userId: testUser.id,
        lastActivityAt: subDays(now, ORG_SCHEDULE_AFTER_IDLE_DAYS),
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(1);
      expect(result.realigned).toBe(0);
      // The first warning goes out on the same run the date is derived
      expect(result.notifiedByThreshold[7]).toBe(1);

      const org = await prisma.salesforceOrg.findFirst();
      // Derived from last activity, not granted from today
      expect(org?.expirationScheduledFor?.toDateString()).toBe(addDays(now, ORG_EXPIRATION_WARNING_WINDOW_DAYS).toDateString());
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(addDays(now, 6).toDateString());

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it('should not schedule an org that is still outside the warning window', async () => {
      const now = new Date();

      await createOrg({
        userId: testUser.id,
        lastActivityAt: subDays(now, ORG_SCHEDULE_AFTER_IDLE_DAYS - 1),
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();

      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.expirationScheduledFor).toBeNull();
    });

    it('should shrink a stale expiration left over from the old inactivity policy', async () => {
      const now = new Date();
      // Old policy granted a 30 day grace period on top of 90 days idle, which Salesforce does not honor
      const staleExpiration = addDays(now, 25);

      await createOrg({
        userId: testUser.id,
        lastActivityAt: subDays(now, 200),
        expirationScheduledFor: staleExpiration,
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(0);
      expect(result.realigned).toBe(1);

      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.expirationScheduledFor?.toDateString()).toBe(subDays(now, 170).toDateString());
    });

    it('should leave an already-correct expiration untouched', async () => {
      const now = new Date();
      const lastActivityAt = subDays(now, 25);

      await createOrg({
        userId: testUser.id,
        lastActivityAt,
        expirationScheduledFor: endOfDay(addDays(lastActivityAt, ORG_INACTIVITY_EXPIRATION_DAYS)),
        nextExpirationNotificationDate: addDays(now, 4),
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(0);
      expect(result.realigned).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should not schedule orgs with connection errors', async () => {
      const now = new Date();

      await createOrg({
        userId: testUser.id,
        lastActivityAt: subDays(now, 91),
        connectionError: 'Invalid credentials',
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(0);

      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.expirationScheduledFor).toBeNull();
    });

    it('should fall back to updatedAt and pin lastActivityAt when lastActivityAt is null', async () => {
      const now = new Date();

      const org = await createOrg({ userId: testUser.id, lastActivityAt: null });
      await prisma.salesforceOrg.update({
        where: { id: org.id },
        data: { updatedAt: subDays(now, 25) },
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(1);

      const updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(updatedOrg?.expirationScheduledFor?.toDateString()).toBe(addDays(now, 5).toDateString());
      // Pinned so the derived date stops depending on updatedAt, which this cron mutates itself
      expect(updatedOrg?.lastActivityAt?.toDateString()).toBe(subDays(now, 25).toDateString());
    });

    it('should not let an unrelated write to updatedAt extend the deadline', async () => {
      const now = new Date();

      const org = await createOrg({ userId: testUser.id, lastActivityAt: null });
      await prisma.salesforceOrg.update({
        where: { id: org.id },
        data: { updatedAt: subDays(now, 25) },
      });

      await manageOrgExpiration(prisma, now);
      const afterFirstRun = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });

      // Simulate a label edit bumping updatedAt long after the expiration was derived
      vi.clearAllMocks();
      await prisma.salesforceOrg.update({ where: { id: org.id }, data: { label: 'renamed' } });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(0);
      expect(result.realigned).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();

      const afterSecondRun = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(afterSecondRun?.expirationScheduledFor?.getTime()).toBe(afterFirstRun?.expirationScheduledFor?.getTime());
    });
  });

  describe('Sending notifications', () => {
    it('should send the 7 day warning', async () => {
      const now = new Date();
      const expirationDate = addDays(now, 7);

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: now,
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notifiedByThreshold[7]).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(addDays(expirationDate, -1).toDateString());
    });

    it('should send the 1 day warning', async () => {
      const now = new Date();
      const expirationDate = addDays(now, 1);

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: now,
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notifiedByThreshold[1]).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(expirationDate.toDateString());
    });

    it('should send the final notice and clear the schedule on the expiration day', async () => {
      const now = new Date();

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: now,
        nextExpirationNotificationDate: now,
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notifiedByThreshold[0]).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][0].orgs[0].daysUntilExpiration).toBe(0);

      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.nextExpirationNotificationDate).toBeNull();
    });

    it('should not resend notifications for already-notified thresholds', async () => {
      const now = new Date();

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: addDays(now, 7),
        nextExpirationNotificationDate: addDays(now, 6), // Not due yet
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notifiedByThreshold[7]).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should catch up on missed notifications', async () => {
      const now = new Date();
      const expirationDate = addDays(now, 1);

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: subDays(now, 10), // Overdue
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notifiedByThreshold[1]).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(expirationDate.toDateString());
    });

    it('should group multiple orgs by user in single email with different expiration dates', async () => {
      const now = new Date();

      await createOrg({ userId: testUser.id, expirationScheduledFor: addDays(now, 7), nextExpirationNotificationDate: now });
      await createOrg({ userId: testUser.id, expirationScheduledFor: addDays(now, 1), nextExpirationNotificationDate: now });
      await createOrg({ userId: testUser.id, expirationScheduledFor: now, nextExpirationNotificationDate: now });

      await manageOrgExpiration(prisma, now);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const emailCall = mockSendEmail.mock.calls[0][0];
      expect(emailCall.orgs).toHaveLength(3);

      const orgExpirations = emailCall.orgs.map((o) => o.daysUntilExpiration).sort((a, b) => a - b);
      expect(orgExpirations).toEqual([0, 1, 7]);
    });

    it('should not email user twice on same cron run', async () => {
      const now = new Date();

      await createOrg({ userId: testUser.id, expirationScheduledFor: addDays(now, 7), nextExpirationNotificationDate: now });
      await createOrg({ userId: testUser.id, expirationScheduledFor: addDays(now, 7), nextExpirationNotificationDate: now });

      await manageOrgExpiration(prisma, now);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][0].orgs).toHaveLength(2);
    });

    it('should skip orgs with connection errors', async () => {
      const now = new Date();

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: addDays(now, 7),
        nextExpirationNotificationDate: now,
        connectionError: 'Invalid credentials',
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notifiedByThreshold[7]).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should not resend emails when cron runs multiple times per day', async () => {
      const now = new Date();
      const expirationDate = addDays(now, 7);

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: now,
      });

      await manageOrgExpiration(prisma, now);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      await manageOrgExpiration(prisma, now);
      expect(mockSendEmail).not.toHaveBeenCalled();

      await manageOrgExpiration(prisma, now);
      expect(mockSendEmail).not.toHaveBeenCalled();

      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(addDays(expirationDate, -1).toDateString());
    });

    it('should leave the schedule unadvanced when the email fails so it retries', async () => {
      const now = new Date();

      const org = await createOrg({
        userId: testUser.id,
        expirationScheduledFor: addDays(now, 7),
        nextExpirationNotificationDate: now,
      });

      mockSendEmail.mockRejectedValueOnce(new Error('mailgun is down'));

      const result = await manageOrgExpiration(prisma, now);

      expect(result.emailFailures).toBe(1);
      expect(result.usersNotified).toBe(0);
      expect(mockCreateAuditLog).not.toHaveBeenCalled();

      const afterFailure = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(afterFailure?.nextExpirationNotificationDate?.toDateString()).toBe(now.toDateString());
      expect(afterFailure?.lastExpirationNotificationAt).toBeNull();

      // Next run retries rather than silently skipping the threshold
      vi.clearAllMocks();
      const retryResult = await manageOrgExpiration(prisma, now);
      expect(retryResult.emailFailures).toBe(0);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it('should still warn a dormant user about an org they can save', async () => {
      const now = new Date();
      const dormantUser = await createUser(subDays(now, 200));

      await createOrg({
        userId: dormantUser.id,
        lastActivityAt: subDays(now, ORG_SCHEDULE_AFTER_IDLE_DAYS),
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.usersNotified).toBe(1);
      expect(result.usersSkipped).toBe(0);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it('should skip the terminal notice for a dormant user but still scrub the credentials', async () => {
      const now = new Date();
      const dormantUser = await createUser(subDays(now, 200));

      const org = await createOrg({
        userId: dormantUser.id,
        lastActivityAt: subDays(now, 200),
        accessToken: 'valid_token',
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.usersSkipped).toBe(1);
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(result.expired).toBe(1);

      const updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(updatedOrg?.accessToken).toBe('v2:EXPIRED_TOKEN_PLACEHOLDER');
      // The schedule still advances so the skipped user is not reconsidered every run
      expect(updatedOrg?.nextExpirationNotificationDate).toBeNull();
    });
  });

  describe('Expiring credentials', () => {
    it('should expire orgs on expiration day', async () => {
      const now = new Date();

      const org = await createOrg({
        userId: testUser.id,
        expirationScheduledFor: subDays(now, 1),
        nextExpirationNotificationDate: null, // All notifications sent
        accessToken: 'valid_token',
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.expired).toBe(1);

      const updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(updatedOrg?.accessToken).toBe('v2:EXPIRED_TOKEN_PLACEHOLDER');
      expect(updatedOrg?.connectionError).toBe(ORG_EXPIRATION_CONNECTION_ERROR);
    });

    it('should not re-expire already expired orgs', async () => {
      const now = new Date();

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: subDays(now, 1),
        nextExpirationNotificationDate: null,
        accessToken: 'v2:EXPIRED_TOKEN_PLACEHOLDER',
        connectionError: ORG_EXPIRATION_CONNECTION_ERROR,
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.expired).toBe(0);
    });

    it('should create audit log for expired orgs', async () => {
      const now = new Date();

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: subDays(now, 1),
        nextExpirationNotificationDate: null,
      });

      await manageOrgExpiration(prisma, now);

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUser.id,
          action: 'ORG_CREDENTIALS_EXPIRED',
          resource: 'salesforce_org',
        }),
      );
    });
  });

  describe('Complete workflow', () => {
    it('should schedule, notify, and scrub a long-overdue org in a single run', async () => {
      const now = new Date();

      const org = await createOrg({
        userId: testUser.id,
        lastActivityAt: subDays(now, 200),
        expirationScheduledFor: addDays(now, 25), // Stale date from the old policy
        accessToken: 'valid_token',
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.realigned).toBe(1);
      expect(result.notifiedByThreshold[0]).toBe(1);
      expect(result.expired).toBe(1);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][0].orgs[0].daysUntilExpiration).toBe(0);

      expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORG_EXPIRED' }));
      expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'ORG_CREDENTIALS_EXPIRED' }));

      const updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(updatedOrg?.expirationScheduledFor?.toDateString()).toBe(subDays(now, 170).toDateString());
      expect(updatedOrg?.accessToken).toBe('v2:EXPIRED_TOKEN_PLACEHOLDER');
      expect(updatedOrg?.nextExpirationNotificationDate).toBeNull();

      // Terminal: every subsequent run ignores it
      vi.clearAllMocks();
      const secondRun = await manageOrgExpiration(prisma, now);
      expect(secondRun.realigned).toBe(0);
      expect(secondRun.expired).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should handle the full 30 day lifecycle', async () => {
      const now = new Date();

      // Day 23 of inactivity - the org enters the warning window
      const org = await createOrg({
        userId: testUser.id,
        lastActivityAt: subDays(now, ORG_SCHEDULE_AFTER_IDLE_DAYS),
      });

      let result = await manageOrgExpiration(prisma, now);
      expect(result.scheduled).toBe(1);
      expect(result.notifiedByThreshold[7]).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      let updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const expirationDate = updatedOrg!.expirationScheduledFor!;
      expect(updatedOrg?.nextExpirationNotificationDate?.toDateString()).toBe(addDays(expirationDate, -1).toDateString());

      // Day 29 - one day left. Step 1 sees it again but must not rewrite anything.
      vi.clearAllMocks();
      result = await manageOrgExpiration(prisma, addDays(now, 6));
      expect(result.scheduled).toBe(0);
      expect(result.realigned).toBe(0);
      expect(result.notifiedByThreshold[1]).toBe(1);
      expect(result.expired).toBe(0);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(updatedOrg?.nextExpirationNotificationDate?.toDateString()).toBe(expirationDate.toDateString());

      // Day 30 - final notice and the credentials are scrubbed in the same run
      vi.clearAllMocks();
      result = await manageOrgExpiration(prisma, addDays(now, 7));
      expect(result.notifiedByThreshold[0]).toBe(1);
      expect(result.expired).toBe(1);

      updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(updatedOrg?.accessToken).toBe('v2:EXPIRED_TOKEN_PLACEHOLDER');
      expect(updatedOrg?.connectionError).toBe(ORG_EXPIRATION_CONNECTION_ERROR);
      expect(updatedOrg?.nextExpirationNotificationDate).toBeNull();
    });

    it('should be idempotent when the same day is processed twice', async () => {
      const now = new Date();

      const org = await createOrg({
        userId: testUser.id,
        lastActivityAt: subDays(now, ORG_SCHEDULE_AFTER_IDLE_DAYS),
      });

      await manageOrgExpiration(prisma, now);
      const afterFirstRun = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });

      vi.clearAllMocks();
      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(0);
      expect(result.realigned).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();

      const afterSecondRun = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(afterSecondRun?.expirationScheduledFor?.getTime()).toBe(afterFirstRun?.expirationScheduledFor?.getTime());
      expect(afterSecondRun?.nextExpirationNotificationDate?.getTime()).toBe(afterFirstRun?.nextExpirationNotificationDate?.getTime());
    });
  });

  describe('Test Mode', () => {
    const originalTestMode = process.env.TEST_MODE;

    beforeEach(() => {
      process.env.TEST_MODE = 'true';
    });

    afterEach(() => {
      if (originalTestMode !== undefined) {
        process.env.TEST_MODE = originalTestMode;
      } else {
        delete process.env.TEST_MODE;
      }
    });

    it('should not update database or send user emails in test mode', async () => {
      const now = new Date();

      // Would be scheduled
      const org1 = await createOrg({
        userId: testUser.id,
        lastActivityAt: subDays(now, ORG_SCHEDULE_AFTER_IDLE_DAYS),
      });

      // Would receive a notification
      const org2 = await createOrg({
        userId: testUser.id,
        expirationScheduledFor: addDays(now, 7),
        nextExpirationNotificationDate: now,
      });

      // Would be expired
      const org3 = await createOrg({
        userId: testUser.id,
        expirationScheduledFor: subDays(now, 1),
        nextExpirationNotificationDate: null,
        accessToken: 'valid_token',
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.testMode).toBe(true);
      expect(result.scheduled).toBe(1);
      expect(result.notifiedByThreshold[7]).toBe(2); // org1 (derived) and org2 (stored)
      expect(result.expired).toBe(1);

      // Verify NO database changes occurred
      const org1After = await prisma.salesforceOrg.findUnique({ where: { id: org1.id } });
      expect(org1After?.expirationScheduledFor).toBeNull();
      expect(org1After?.nextExpirationNotificationDate).toBeNull();

      const org2After = await prisma.salesforceOrg.findUnique({ where: { id: org2.id } });
      expect(org2After?.nextExpirationNotificationDate?.toDateString()).toBe(now.toDateString());

      const org3After = await prisma.salesforceOrg.findUnique({ where: { id: org3.id } });
      expect(org3After?.accessToken).toBe('valid_token');
      expect(org3After?.connectionError).toBeNull();

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).not.toHaveBeenCalled();

      // Verify summary email WAS sent
      expect(mockSendEmailConfig).toHaveBeenCalledTimes(1);
      expect(mockSendEmailConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'support@getjetstream.app',
          subject: 'Org Expiration Test Mode Summary',
          attachment: expect.arrayContaining([
            expect.objectContaining({ filename: 'scheduled-orgs.csv' }),
            expect.objectContaining({ filename: 'notifications.csv' }),
            expect.objectContaining({ filename: 'expired-orgs.csv' }),
          ]),
        }),
      );

      const summaryCall = mockSendEmailConfig.mock.calls[0][0];
      expect(summaryCall.attachment).toHaveLength(3);

      const scheduledCsv = summaryCall.attachment.find((a: { filename: string }) => a.filename === 'scheduled-orgs.csv');
      expect(scheduledCsv).toBeDefined();
      const scheduledData = scheduledCsv.data.toString('utf-8');
      expect(scheduledData).toContain('orgId');
      expect(scheduledData).toContain('realigned');

      const notificationsCsv = summaryCall.attachment.find((a: { filename: string }) => a.filename === 'notifications.csv');
      expect(notificationsCsv).toBeDefined();
      const notificationsData = notificationsCsv.data.toString('utf-8');
      expect(notificationsData).toContain('userEmail');
      expect(notificationsData).toContain('daysUntilExpiration');

      const expiredCsv = summaryCall.attachment.find((a: { filename: string }) => a.filename === 'expired-orgs.csv');
      expect(expiredCsv).toBeDefined();
      const expiredData = expiredCsv.data.toString('utf-8');
      expect(expiredData).toContain('orgId');
      expect(expiredData).toContain('username');
    });

    it('should report the date it would derive rather than the stale stored date', async () => {
      const now = new Date();

      await createOrg({
        userId: testUser.id,
        lastActivityAt: subDays(now, 200),
        expirationScheduledFor: addDays(now, 25),
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.realigned).toBe(1);
      // Reported as already past, not as 25 days out
      expect(result.notifiedByThreshold[0]).toBe(1);

      const summaryCall = mockSendEmailConfig.mock.calls[0][0];
      const notificationsCsv = summaryCall.attachment.find((a: { filename: string }) => a.filename === 'notifications.csv');
      expect(notificationsCsv.data.toString('utf-8')).toContain(',0,');
    });

    it('should handle test mode with no changes needed', async () => {
      const now = new Date();

      await createOrg({ userId: testUser.id, lastActivityAt: now });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(0);
      expect(result.realigned).toBe(0);
      expect(result.notifiedByThreshold).toEqual({ 0: 0, 1: 0, 7: 0 });
      expect(result.expired).toBe(0);

      expect(mockSendEmailConfig).toHaveBeenCalledTimes(1);
      const summaryCall = mockSendEmailConfig.mock.calls[0][0];
      expect(summaryCall.attachment).toHaveLength(0);
    });
  });
});

import { createAuditLog } from '@jetstream/audit-logs';
import { sendOrgExpirationWarningEmail } from '@jetstream/email';
import { PrismaClient } from '@jetstream/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { addDays, subDays } from 'date-fns';
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

// Import the mocked functions after mock calls
import { sendEmail } from '@jetstream/api-config';

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
    it('should schedule orgs inactive for 90 days', async () => {
      const now = new Date();
      const inactiveDate = subDays(now, 91); // 91 days ago

      await createOrg({
        userId: testUser.id,
        lastActivityAt: inactiveDate,
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(1);
      expect(result.notified30Days).toBe(1); // Also sends 30-day notification immediately

      // Verify DB state
      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.expirationScheduledFor).toBeTruthy();

      // Should be scheduled for 30 days from now
      const expectedExpiration = addDays(now, 30);
      expect(org?.expirationScheduledFor?.toDateString()).toBe(expectedExpiration.toDateString());

      // Next notification should be 7 days before expiration (since 30-day was just sent)
      const expectedNextNotification = addDays(expectedExpiration, -7);
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(expectedNextNotification.toDateString());

      // Should have sent email
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it('should not schedule orgs with existing expiration', async () => {
      const now = new Date();
      const inactiveDate = subDays(now, 91);
      const existingExpiration = addDays(now, 10);

      await createOrg({
        userId: testUser.id,
        lastActivityAt: inactiveDate,
        expirationScheduledFor: existingExpiration,
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(0);

      // Expiration date should not change
      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.expirationScheduledFor?.toDateString()).toBe(existingExpiration.toDateString());
    });

    it('should not schedule orgs with connection errors', async () => {
      const now = new Date();
      const inactiveDate = subDays(now, 91);

      await createOrg({
        userId: testUser.id,
        lastActivityAt: inactiveDate,
        connectionError: 'Invalid credentials',
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(0);

      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.expirationScheduledFor).toBeNull();
    });

    it('should schedule orgs based on updatedAt if lastActivityAt is null', async () => {
      const now = new Date();

      // Create org and manually set updatedAt to 91 days ago
      const org = await createOrg({
        userId: testUser.id,
        lastActivityAt: null,
      });

      await prisma.salesforceOrg.update({
        where: { id: org.id },
        data: { updatedAt: subDays(now, 91) },
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(1);
    });
  });

  describe('Sending notifications', () => {
    it('should send 30-day warning notification', async () => {
      const now = new Date();
      const expirationDate = addDays(now, 30);

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: now,
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notified30Days).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      // Verify next notification date is set to 7 days before expiration
      const org = await prisma.salesforceOrg.findFirst();
      const expectedNextNotification = addDays(expirationDate, -7);
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(expectedNextNotification.toDateString());
    });

    it('should send 7-day warning notification', async () => {
      const now = new Date();
      const expirationDate = addDays(now, 7);

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: now,
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notified7Days).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const org = await prisma.salesforceOrg.findFirst();
      const expectedNextNotification = addDays(expirationDate, -3);
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(expectedNextNotification.toDateString());
    });

    it('should send 3-day warning notification', async () => {
      const now = new Date();
      const expirationDate = addDays(now, 3);

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: now,
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notified3Days).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const org = await prisma.salesforceOrg.findFirst();
      const expectedNextNotification = expirationDate; // Next is 0-day (expiration day)
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(expectedNextNotification.toDateString());
    });

    it('should not resend notifications for already-notified thresholds', async () => {
      const now = new Date();
      const expirationDate = addDays(now, 7);

      // Next notification is in the future, so no notification should be sent
      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: addDays(now, 3), // Not due yet
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notified7Days).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should catch up on missed notifications', async () => {
      const now = new Date();
      const expirationDate = addDays(now, 3); // Currently at 3 days

      // Org scheduled but notification is due (missed notifications don't matter, just send one now)
      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: subDays(now, 10), // Overdue notification
      });

      const result = await manageOrgExpiration(prisma, now);

      // Only counts the actual day threshold
      expect(result.notified3Days).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1); // One email per user

      // Next notification should be set to expiration day (0-day)
      const org = await prisma.salesforceOrg.findFirst();
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(expirationDate.toDateString());
    });

    it('should group multiple orgs by user in single email with different expiration dates', async () => {
      const now = new Date();

      // Create multiple orgs for same user expiring on different days, all due for notification now
      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: addDays(now, 30),
        nextExpirationNotificationDate: now,
      });

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: addDays(now, 7),
        nextExpirationNotificationDate: now,
      });

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: addDays(now, 3),
        nextExpirationNotificationDate: now,
      });

      await manageOrgExpiration(prisma, now);

      // Should send ONE email with all three orgs showing different expiration days
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const emailCall = mockSendEmail.mock.calls[0][0];
      expect(emailCall.orgs).toHaveLength(3);

      // Verify each org shows its own expiration countdown
      const orgExpirations = emailCall.orgs.map((o) => o.daysUntilExpiration).sort((a, b) => a - b);
      expect(orgExpirations).toEqual([3, 7, 30]);
    });

    it('should not email user twice on same cron run', async () => {
      const now = new Date();

      // Create multiple orgs at same threshold
      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: addDays(now, 7),
        nextExpirationNotificationDate: now,
      });

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: addDays(now, 7),
        nextExpirationNotificationDate: now,
      });

      await manageOrgExpiration(prisma, now);

      // Should send ONE email, not two
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const emailCall = mockSendEmail.mock.calls[0][0];
      expect(emailCall.orgs).toHaveLength(2);
    });

    it('should skip orgs with connection errors', async () => {
      const now = new Date();
      const expirationDate = addDays(now, 7);

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: now,
        connectionError: 'Invalid credentials',
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.notified7Days).toBe(0);
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

      // First run - should send email
      await manageOrgExpiration(prisma, now);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      // Second run same day - should NOT send email again (nextExpirationNotificationDate was updated)
      vi.clearAllMocks();
      await manageOrgExpiration(prisma, now);
      expect(mockSendEmail).not.toHaveBeenCalled();

      // Third run same day - still should NOT send
      await manageOrgExpiration(prisma, now);
      expect(mockSendEmail).not.toHaveBeenCalled();

      // Verify next notification date is in the future
      const org = await prisma.salesforceOrg.findFirst();
      const expectedNextNotification = addDays(expirationDate, -3);
      expect(org?.nextExpirationNotificationDate?.toDateString()).toBe(expectedNextNotification.toDateString());
    });
  });

  describe('Expiring credentials', () => {
    it('should expire orgs on expiration day', async () => {
      const now = new Date();
      const expirationDate = subDays(now, 1); // Yesterday

      const org = await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: null, // All notifications sent
        accessToken: 'valid_token',
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.expired).toBe(1);

      // Verify credentials were invalidated
      const updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(updatedOrg?.accessToken).toBe('v2:EXPIRED_TOKEN_PLACEHOLDER');
      expect(updatedOrg?.connectionError).toBe('Credentials expired due to inactivity');
    });

    it('should not re-expire already expired orgs', async () => {
      const now = new Date();
      const expirationDate = subDays(now, 1);

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: null,
        accessToken: 'v2:EXPIRED_TOKEN_PLACEHOLDER',
        connectionError: 'Credentials expired due to inactivity',
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.expired).toBe(0);
    });

    it('should create audit log for expired orgs', async () => {
      const now = new Date();
      const expirationDate = subDays(now, 1);

      await createOrg({
        userId: testUser.id,
        expirationScheduledFor: expirationDate,
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
    it('should handle full expiration lifecycle', async () => {
      const now = new Date();

      // Day 0: Org becomes inactive
      const inactiveDate = subDays(now, 90);
      const org = await createOrg({
        userId: testUser.id,
        lastActivityAt: inactiveDate,
      });

      // Run 1: Schedule for expiration and send 30-day warning
      let result = await manageOrgExpiration(prisma, now);
      expect(result.scheduled).toBe(1);
      expect(result.notified30Days).toBe(1); // Sends immediately when scheduled
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      let updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(updatedOrg?.expirationScheduledFor).toBeTruthy();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const expirationDate = updatedOrg!.expirationScheduledFor!;

      // Next notification should be 7 days before expiration
      let expectedNext = addDays(expirationDate, -7);
      expect(updatedOrg?.nextExpirationNotificationDate?.toDateString()).toBe(expectedNext.toDateString());

      // Run 2: 7 days before expiration
      vi.clearAllMocks();
      const day23 = addDays(now, 23);
      result = await manageOrgExpiration(prisma, day23);
      expect(result.notified7Days).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expectedNext = addDays(expirationDate, -3);
      expect(updatedOrg?.nextExpirationNotificationDate?.toDateString()).toBe(expectedNext.toDateString());

      // Run 3: 3 days before expiration
      vi.clearAllMocks();
      const day27 = addDays(now, 27);
      result = await manageOrgExpiration(prisma, day27);
      expect(result.notified3Days).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expectedNext = expirationDate; // 0-day
      expect(updatedOrg?.nextExpirationNotificationDate?.toDateString()).toBe(expectedNext.toDateString());

      // Run 4: Expiration day
      vi.clearAllMocks();
      const day30 = addDays(now, 30);
      result = await manageOrgExpiration(prisma, day30);
      expect(result.expired).toBe(1);

      updatedOrg = await prisma.salesforceOrg.findUnique({ where: { id: org.id } });
      expect(updatedOrg?.accessToken).toBe('v2:EXPIRED_TOKEN_PLACEHOLDER');
      expect(updatedOrg?.connectionError).toBe('Credentials expired due to inactivity');
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
      const inactiveDate = subDays(now, 91);

      // Create org that would normally be scheduled for expiration
      const org1 = await createOrg({
        userId: testUser.id,
        lastActivityAt: inactiveDate,
      });

      // Create org that would normally receive notification
      const org2 = await createOrg({
        userId: testUser.id,
        expirationScheduledFor: addDays(now, 7),
        nextExpirationNotificationDate: now,
      });

      // Create org that would normally be expired
      const org3 = await createOrg({
        userId: testUser.id,
        expirationScheduledFor: subDays(now, 1),
        nextExpirationNotificationDate: null,
        accessToken: 'valid_token',
      });

      const result = await manageOrgExpiration(prisma, now);

      // Results should reflect what WOULD have happened
      expect(result.scheduled).toBe(1);
      expect(result.notified7Days).toBe(1);
      expect(result.expired).toBe(1);

      // Verify NO database changes occurred
      const org1After = await prisma.salesforceOrg.findUnique({ where: { id: org1.id } });
      expect(org1After?.expirationScheduledFor).toBeNull();
      expect(org1After?.nextExpirationNotificationDate).toBeNull();

      const org2After = await prisma.salesforceOrg.findUnique({ where: { id: org2.id } });
      expect(org2After?.nextExpirationNotificationDate?.toDateString()).toBe(now.toDateString()); // Not updated

      const org3After = await prisma.salesforceOrg.findUnique({ where: { id: org3.id } });
      expect(org3After?.accessToken).toBe('valid_token'); // Not expired
      expect(org3After?.connectionError).toBeNull();

      // Verify NO user notification emails were sent
      expect(mockSendEmail).not.toHaveBeenCalled();

      // Verify NO audit logs were created
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

      // Verify CSV attachments contain expected data
      const summaryCall = mockSendEmailConfig.mock.calls[0][0];
      expect(summaryCall.attachment).toHaveLength(3);

      // Check scheduled orgs CSV
      const scheduledCsv = summaryCall.attachment.find((a: { filename: string }) => a.filename === 'scheduled-orgs.csv');
      expect(scheduledCsv).toBeDefined();
      const scheduledData = scheduledCsv.data.toString('utf-8');
      expect(scheduledData).toContain('orgId');
      expect(scheduledData).toContain('uniqueId');

      // Check notifications CSV
      const notificationsCsv = summaryCall.attachment.find((a: { filename: string }) => a.filename === 'notifications.csv');
      expect(notificationsCsv).toBeDefined();
      const notificationsData = notificationsCsv.data.toString('utf-8');
      expect(notificationsData).toContain('userEmail');
      expect(notificationsData).toContain('daysUntilExpiration');

      // Check expired orgs CSV
      const expiredCsv = summaryCall.attachment.find((a: { filename: string }) => a.filename === 'expired-orgs.csv');
      expect(expiredCsv).toBeDefined();
      const expiredData = expiredCsv.data.toString('utf-8');
      expect(expiredData).toContain('orgId');
      expect(expiredData).toContain('username');
    });

    it('should handle test mode with no changes needed', async () => {
      const now = new Date();

      // Create org that doesn't need any action
      await createOrg({
        userId: testUser.id,
        lastActivityAt: now, // Active
      });

      const result = await manageOrgExpiration(prisma, now);

      expect(result.scheduled).toBe(0);
      expect(result.notified30Days).toBe(0);
      expect(result.notified7Days).toBe(0);
      expect(result.notified3Days).toBe(0);
      expect(result.expired).toBe(0);

      // Summary email should still be sent
      expect(mockSendEmailConfig).toHaveBeenCalledTimes(1);

      // But with no attachments (no CSVs created)
      const summaryCall = mockSendEmailConfig.mock.calls[0][0];
      expect(summaryCall.attachment).toHaveLength(0);
    });
  });
});

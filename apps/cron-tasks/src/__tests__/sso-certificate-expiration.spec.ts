import { createAuditLog } from '@jetstream/audit-logs';
import { sendSsoCertificateExpirationEmail } from '@jetstream/email';
import { PrismaClient } from '@jetstream/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { addDays, subDays } from 'date-fns';
import * as dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';
import { vi, type MockedFunction } from 'vitest';
import { manageSsoCertificateExpiration } from '../utils/sso-certificate-expiration.utils';

dotenv.config();

const TEST_PREFIX = 'sso-cert-expiration-test';

vi.mock('@jetstream/email', () => {
  return {
    sendSsoCertificateExpirationEmail: vi.fn(),
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

vi.mock('@jetstream/audit-logs', () => {
  return {
    createAuditLog: vi.fn(),
    AuditLogAction: {
      SSO_CERT_EXPIRATION_WARNING: 'SSO_CERT_EXPIRATION_WARNING',
      SSO_CERT_EXPIRED: 'SSO_CERT_EXPIRED',
    },
    AuditLogResource: {
      TEAM_SSO_CONFIG: 'sso_config',
    },
  };
});

// Ensure this runs against a test database
const adapter = new PrismaPg({
  connectionString: process.env.PRISMA_TEST_DB_URI || 'postgres://postgres:postgres@postgres:5432/testdb',
});
export const prisma = new PrismaClient({ adapter });

async function createUser() {
  const userId = uuid();
  return await prisma.user.create({
    data: { id: userId, email: `${TEST_PREFIX}-${userId}@test.com`, name: userId, userId },
  });
}

/**
 * Create a team with a SAML configuration and the given admin/member roster.
 * `idpCertificateExpiresAt` and `nextCertNotificationDate` are set explicitly so each test controls
 * exactly where in the notification schedule the configuration sits.
 */
async function createTeamWithSamlConfig({
  idpCertificateExpiresAt,
  nextCertNotificationDate,
  ssoEnabled = true,
  teamStatus = 'ACTIVE',
  admins = 1,
  nonAdmins = 0,
  inactiveAdmins = 0,
}: {
  idpCertificateExpiresAt: Date | null;
  nextCertNotificationDate: Date | null;
  ssoEnabled?: boolean;
  teamStatus?: string;
  admins?: number;
  nonAdmins?: number;
  inactiveAdmins?: number;
}) {
  const loginConfig = await prisma.loginConfiguration.create({
    data: { ssoEnabled, ssoProvider: 'SAML' },
  });

  const team = await prisma.team.create({
    data: { name: `${TEST_PREFIX}-team-${uuid()}`, loginConfigId: loginConfig.id, status: teamStatus },
  });

  const samlConfiguration = await prisma.samlConfiguration.create({
    data: {
      loginConfigId: loginConfig.id,
      entityId: `urn:jetstream:${team.id}`,
      acsUrl: `https://example.com/api/auth/sso/saml/${team.id}/acs`,
      idpEntityId: 'http://www.okta.com/exkTestEntityId',
      idpSsoUrl: 'https://example.okta.com/app/sso/saml',
      idpCertificate: 'MIIC-test-certificate',
      attributeMapping: { email: 'email' },
      idpCertificateExpiresAt,
      nextCertNotificationDate,
    },
  });

  const adminUsers: Array<{ id: string; email: string }> = [];
  for (let i = 0; i < admins; i++) {
    const user = await createUser();
    await prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, role: 'ADMIN', status: 'ACTIVE' } });
    adminUsers.push(user);
  }
  for (let i = 0; i < inactiveAdmins; i++) {
    const user = await createUser();
    await prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, role: 'ADMIN', status: 'INACTIVE' } });
  }
  for (let i = 0; i < nonAdmins; i++) {
    const user = await createUser();
    await prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, role: 'MEMBER', status: 'ACTIVE' } });
  }

  return { team, loginConfig, samlConfiguration, adminUsers };
}

async function cleanUpTestData() {
  await prisma.teamMember.deleteMany({ where: { user: { email: { contains: TEST_PREFIX } } } });
  await prisma.user.deleteMany({ where: { email: { contains: TEST_PREFIX } } });
  // SamlConfiguration cascades from LoginConfiguration, and Team must go before its login config
  await prisma.team.deleteMany({ where: { name: { contains: TEST_PREFIX } } });
  await prisma.loginConfiguration.deleteMany({
    where: { team: null, samlConfiguration: { idpEntityId: 'http://www.okta.com/exkTestEntityId' } },
  });
}

describe('SSO Certificate Expiration Integration Tests', () => {
  const mockSendEmail = sendSsoCertificateExpirationEmail as MockedFunction<typeof sendSsoCertificateExpirationEmail>;
  const mockCreateAuditLog = createAuditLog as MockedFunction<typeof createAuditLog>;

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanUpTestData();
  });

  afterAll(async () => {
    await cleanUpTestData();
    await prisma.$disconnect();
  });

  describe('Selecting configurations that are due', () => {
    it('notifies every active admin when a notification is due', async () => {
      const now = new Date();
      const { team, adminUsers } = await createTeamWithSamlConfig({
        idpCertificateExpiresAt: addDays(now, 14),
        nextCertNotificationDate: subDays(now, 1),
        admins: 2,
      });

      const result = await manageSsoCertificateExpiration(prisma, now);

      expect(result.configurationsDue).toBe(1);
      expect(result.teamsNotified).toBe(1);
      expect(result.emailsSent).toBe(2);
      expect(mockSendEmail).toHaveBeenCalledTimes(2);

      const notifiedEmails = mockSendEmail.mock.calls.map(([args]) => args.emailAddress).sort();
      expect(notifiedEmails).toEqual(adminUsers.map(({ email }) => email).sort());
      expect(mockSendEmail.mock.calls[0][0].teamName).toBe(team.name);
    });

    it('does not notify when the next notification date is still in the future', async () => {
      const now = new Date();
      await createTeamWithSamlConfig({
        idpCertificateExpiresAt: addDays(now, 60),
        nextCertNotificationDate: addDays(now, 30),
      });

      const result = await manageSsoCertificateExpiration(prisma, now);

      expect(result.configurationsDue).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('does not notify when every threshold has already been sent', async () => {
      const now = new Date();
      await createTeamWithSamlConfig({
        idpCertificateExpiresAt: subDays(now, 5),
        nextCertNotificationDate: null,
      });

      const result = await manageSsoCertificateExpiration(prisma, now);

      expect(result.configurationsDue).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('ignores configurations with no parsed expiration date', async () => {
      const now = new Date();
      await createTeamWithSamlConfig({
        idpCertificateExpiresAt: null,
        nextCertNotificationDate: subDays(now, 1),
      });

      const result = await manageSsoCertificateExpiration(prisma, now);

      expect(result.configurationsDue).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe('Recipient selection', () => {
    it('only emails admins, not members', async () => {
      const now = new Date();
      const { adminUsers } = await createTeamWithSamlConfig({
        idpCertificateExpiresAt: addDays(now, 7),
        nextCertNotificationDate: subDays(now, 1),
        admins: 1,
        nonAdmins: 3,
      });

      await manageSsoCertificateExpiration(prisma, now);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][0].emailAddress).toBe(adminUsers[0].email);
    });

    it('skips deactivated admins', async () => {
      const now = new Date();
      const { adminUsers } = await createTeamWithSamlConfig({
        idpCertificateExpiresAt: addDays(now, 7),
        nextCertNotificationDate: subDays(now, 1),
        admins: 1,
        inactiveAdmins: 2,
      });

      await manageSsoCertificateExpiration(prisma, now);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][0].emailAddress).toBe(adminUsers[0].email);
    });

    it('advances the schedule without emailing when a team has no active admins', async () => {
      const now = new Date();
      const { samlConfiguration } = await createTeamWithSamlConfig({
        idpCertificateExpiresAt: addDays(now, 14),
        nextCertNotificationDate: subDays(now, 1),
        admins: 0,
      });

      const result = await manageSsoCertificateExpiration(prisma, now);

      expect(result.teamsWithoutRecipients).toBe(1);
      expect(mockSendEmail).not.toHaveBeenCalled();

      // Schedule still advances so the config does not stay permanently "due", but no send is recorded
      const updated = await prisma.samlConfiguration.findUniqueOrThrow({ where: { id: samlConfiguration.id } });
      expect(updated.nextCertNotificationDate).not.toEqual(samlConfiguration.nextCertNotificationDate);
      expect(updated.lastCertNotificationAt).toBeNull();
    });
  });

  describe('Teams that should not be emailed', () => {
    it('skips teams with SSO disabled but still advances the schedule', async () => {
      const now = new Date();
      const { samlConfiguration } = await createTeamWithSamlConfig({
        idpCertificateExpiresAt: addDays(now, 14),
        nextCertNotificationDate: subDays(now, 1),
        ssoEnabled: false,
      });

      const result = await manageSsoCertificateExpiration(prisma, now);

      expect(result.teamsNotified).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();

      const updated = await prisma.samlConfiguration.findUniqueOrThrow({ where: { id: samlConfiguration.id } });
      expect(updated.nextCertNotificationDate).not.toEqual(samlConfiguration.nextCertNotificationDate);
      expect(updated.lastCertNotificationAt).toBeNull();
    });

    it('skips inactive teams', async () => {
      const now = new Date();
      await createTeamWithSamlConfig({
        idpCertificateExpiresAt: addDays(now, 14),
        nextCertNotificationDate: subDays(now, 1),
        teamStatus: 'INACTIVE',
      });

      const result = await manageSsoCertificateExpiration(prisma, now);

      expect(result.teamsNotified).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe('Schedule advancement', () => {
    it('advances to the next threshold after sending', async () => {
      const now = new Date();
      const expiresAt = addDays(now, 14);
      const { samlConfiguration } = await createTeamWithSamlConfig({
        idpCertificateExpiresAt: expiresAt,
        nextCertNotificationDate: subDays(now, 1),
      });

      await manageSsoCertificateExpiration(prisma, now);

      // Next threshold after 14 days out is 7 days before expiration
      const updated = await prisma.samlConfiguration.findUniqueOrThrow({ where: { id: samlConfiguration.id } });
      expect(updated.nextCertNotificationDate?.toDateString()).toBe(subDays(expiresAt, 7).toDateString());
      expect(updated.lastCertNotificationAt).toBeTruthy();
    });

    it('clears the schedule after the final (expiration day) notification', async () => {
      const now = new Date();
      const { samlConfiguration } = await createTeamWithSamlConfig({
        idpCertificateExpiresAt: now,
        nextCertNotificationDate: subDays(now, 1),
      });

      await manageSsoCertificateExpiration(prisma, now);

      const updated = await prisma.samlConfiguration.findUniqueOrThrow({ where: { id: samlConfiguration.id } });
      expect(updated.nextCertNotificationDate).toBeNull();
    });

    it('leaves the schedule untouched when an email fails so the next run retries', async () => {
      const now = new Date();
      const { samlConfiguration } = await createTeamWithSamlConfig({
        idpCertificateExpiresAt: addDays(now, 14),
        nextCertNotificationDate: subDays(now, 1),
      });
      mockSendEmail.mockRejectedValueOnce(new Error('mailgun is down'));

      const result = await manageSsoCertificateExpiration(prisma, now);

      expect(result.failures).toBe(1);
      expect(result.teamsNotified).toBe(0);

      const updated = await prisma.samlConfiguration.findUniqueOrThrow({ where: { id: samlConfiguration.id } });
      expect(updated.nextCertNotificationDate?.toDateString()).toBe(samlConfiguration.nextCertNotificationDate?.toDateString());
      expect(updated.lastCertNotificationAt).toBeNull();
    });
  });

  describe('Audit logging', () => {
    it('logs a warning for a certificate that has not yet expired', async () => {
      const now = new Date();
      const { team } = await createTeamWithSamlConfig({
        idpCertificateExpiresAt: addDays(now, 14),
        nextCertNotificationDate: subDays(now, 1),
      });

      await manageSsoCertificateExpiration(prisma, now);

      expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
      expect(mockCreateAuditLog.mock.calls[0][0]).toMatchObject({
        teamId: team.id,
        action: 'SSO_CERT_EXPIRATION_WARNING',
        resource: 'sso_config',
      });
    });

    it('still logs a warning on the expiration date itself', async () => {
      const now = new Date();
      await createTeamWithSamlConfig({
        idpCertificateExpiresAt: now,
        nextCertNotificationDate: subDays(now, 1),
      });

      await manageSsoCertificateExpiration(prisma, now);

      expect(mockSendEmail.mock.calls[0][0].daysUntilExpiration).toBe(0);
      expect(mockCreateAuditLog.mock.calls[0][0]).toMatchObject({ action: 'SSO_CERT_EXPIRATION_WARNING' });
    });

    it('logs the expired action once the certificate is past its expiration date', async () => {
      const now = new Date();
      await createTeamWithSamlConfig({
        idpCertificateExpiresAt: subDays(now, 1),
        nextCertNotificationDate: subDays(now, 1),
      });

      await manageSsoCertificateExpiration(prisma, now);

      expect(mockCreateAuditLog.mock.calls[0][0]).toMatchObject({ action: 'SSO_CERT_EXPIRED' });
    });
  });

  describe('Test mode', () => {
    it('reports what it would do without sending email or updating the schedule', async () => {
      const now = new Date();
      process.env.TEST_MODE = 'true';
      const { samlConfiguration } = await createTeamWithSamlConfig({
        idpCertificateExpiresAt: addDays(now, 14),
        nextCertNotificationDate: subDays(now, 1),
        admins: 2,
      });

      try {
        const result = await manageSsoCertificateExpiration(prisma, now);

        expect(result.testMode).toBe(true);
        expect(result.teamsNotified).toBe(1);
        expect(result.emailsSent).toBe(2);
        expect(mockSendEmail).not.toHaveBeenCalled();

        const updated = await prisma.samlConfiguration.findUniqueOrThrow({ where: { id: samlConfiguration.id } });
        expect(updated.lastCertNotificationAt).toBeNull();
      } finally {
        delete process.env.TEST_MODE;
      }
    });
  });
});

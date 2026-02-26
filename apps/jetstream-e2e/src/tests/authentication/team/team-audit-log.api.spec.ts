import { prisma } from '@jetstream/api-config';
import { randomUUID } from 'crypto';
import { expect, test } from '../../../fixtures/fixtures';

/**
 * Poll the DB until a matching audit log record appears (or timeout).
 * Audit logs are written fire-and-forget so the API response arrives before
 * the DB write has committed — a short polling loop handles this gracefully.
 */
async function waitForAuditLog(query: () => ReturnType<typeof prisma.auditLog.findFirst>, maxAttempts = 20, delayMs = 100) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await query();
    if (result !== null) return result;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

test.describe('Team Audit Log', () => {
  test.describe.configure({ mode: 'parallel' });

  // Each fixture creates its own user so we start from a clean, unauthenticated state
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  /**
   * Covers: TEAM_UPDATED, LOGIN_CONFIG_UPDATED, TEAM_MEMBER_ROLE_UPDATED,
   *         TEAM_INVITATION_CREATED, TEAM_INVITATION_CANCELLED
   */
  test('team management operations create audit log records', async ({ teamCreationUtils3Users: tc, page }) => {
    const { team } = tc;
    const [member1] = tc.members;
    const teamId = team.id;

    try {
      await test.step('TEAM_UPDATED is logged when the team is renamed', async () => {
        const newName = `Audit Test Team ${randomUUID().slice(0, 6)}`;
        const res = await page.request.put(`/api/teams/${teamId}`, { data: { name: newName } });
        expect(res.ok()).toBeTruthy();

        const log = await waitForAuditLog(() =>
          prisma.auditLog.findFirst({ where: { teamId, action: 'TEAM_UPDATED' }, orderBy: { createdAt: 'desc' } }),
        );

        expect(log).not.toBeNull();
        expect(log!.teamId).toBe(teamId);
        const meta = log!.metadata as Record<string, unknown>;
        expect(meta.newName).toBe(newName);
        expect(typeof meta.previousName).toBe('string');
      });

      await test.step('LOGIN_CONFIG_UPDATED is logged with a changes diff', async () => {
        // DB defaults: requireMfa=true, allowIdentityLinking=false
        // Send requireMfa=false to produce a diff entry
        const res = await page.request.post(`/api/teams/${teamId}/login-configuration`, {
          data: {
            requireMfa: false,
            allowIdentityLinking: false,
            allowedMfaMethods: ['email', 'otp'],
            allowedProviders: ['credentials', 'google', 'salesforce'],
          },
        });
        expect(res.ok()).toBeTruthy();

        const log = await waitForAuditLog(() =>
          prisma.auditLog.findFirst({ where: { teamId, action: 'LOGIN_CONFIG_UPDATED' }, orderBy: { createdAt: 'desc' } }),
        );

        expect(log).not.toBeNull();
        const meta = log!.metadata as Record<string, unknown>;
        expect(typeof meta.sessionsRevoked).toBe('number');
        // The requireMfa diff (true → false) should be captured
        const changes = meta.changes as Record<string, unknown>;
        expect(changes.requireMfa).toBeDefined();
      });

      await test.step('TEAM_MEMBER_ROLE_UPDATED is logged when a member role changes', async () => {
        const res = await page.request.put(`/api/teams/${teamId}/members/${member1.userId}`, {
          data: { role: 'BILLING', features: ['ALL'] },
        });
        expect(res.ok()).toBeTruthy();

        const log = await waitForAuditLog(() =>
          prisma.auditLog.findFirst({ where: { teamId, action: 'TEAM_MEMBER_ROLE_UPDATED' }, orderBy: { createdAt: 'desc' } }),
        );

        expect(log).not.toBeNull();
        expect(log!.resourceId).toBe(member1.userId);
        const meta = log!.metadata as Record<string, unknown>;
        expect(meta.targetUserId).toBe(member1.userId);
        expect(meta.previousRole).toBe('MEMBER');
        expect(meta.newRole).toBe('BILLING');
      });

      const inviteeEmail = `audit-invite-${randomUUID().slice(0, 8)}@example.test`;

      await test.step('TEAM_INVITATION_CREATED is logged when an invitation is sent', async () => {
        const res = await page.request.post(`/api/teams/${teamId}/invitations`, {
          data: { email: inviteeEmail, role: 'MEMBER', features: ['ALL'] },
        });
        expect(res.ok()).toBeTruthy();

        const log = await waitForAuditLog(() =>
          prisma.auditLog.findFirst({ where: { teamId, action: 'TEAM_INVITATION_CREATED' }, orderBy: { createdAt: 'desc' } }),
        );

        expect(log).not.toBeNull();
        const meta = log!.metadata as Record<string, unknown>;
        expect(meta.inviteeEmail).toBe(inviteeEmail);
        expect(meta.role).toBe('MEMBER');
        expect(typeof meta.expiresAt).toBe('string');
      });

      await test.step('TEAM_INVITATION_CANCELLED is logged when an invitation is revoked', async () => {
        const invite = await prisma.teamMemberInvitation.findFirstOrThrow({
          where: { teamId, email: inviteeEmail },
        });
        const res = await page.request.delete(`/api/teams/${teamId}/invitations/${invite.id}`);
        expect(res.ok()).toBeTruthy();

        const log = await waitForAuditLog(() =>
          prisma.auditLog.findFirst({ where: { teamId, action: 'TEAM_INVITATION_CANCELLED' }, orderBy: { createdAt: 'desc' } }),
        );

        expect(log).not.toBeNull();
        const meta = log!.metadata as Record<string, unknown>;
        expect(meta.inviteeEmail).toBe(inviteeEmail);
      });
    } finally {
      await prisma.auditLog.deleteMany({ where: { teamId } }).catch(() => {});
    }
  });

  /**
   * Covers: DOMAIN_VERIFICATION_ADDED, DOMAIN_DELETED,
   *         SSO_SAML_CONFIG_CREATED, SSO_SAML_CONFIG_UPDATED, SSO_SAML_CONFIG_DELETED
   */
  test('SSO and domain operations create audit log records', async ({ teamCreationUtils1User: tc, page }) => {
    const { team } = tc;
    const teamId = team.id;

    // Seed a verified domain so the SSO config endpoints don't reject the request.
    // We replicate the state that teamDb.verifyDomainVerification would produce.
    const verifiedDomain = `sso-audit-${randomUUID().slice(0, 8)}.test`;
    const seededDomainRecord = await prisma.domainVerification.create({
      data: {
        domain: verifiedDomain,
        teamId,
        status: 'VERIFIED',
        verificationCode: `jetstream-verification=${randomUUID()}`,
        verifiedAt: new Date(),
      },
    });

    try {
      const newDomain = `audit-domain-${randomUUID().slice(0, 8)}.test`;
      let newDomainRecordId!: string;

      await test.step('DOMAIN_VERIFICATION_ADDED is logged when a domain is saved', async () => {
        const res = await page.request.post(`/api/teams/${teamId}/domain-verification`, {
          data: { domain: newDomain },
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        newDomainRecordId = body.data.id;

        const log = await waitForAuditLog(() =>
          prisma.auditLog.findFirst({ where: { teamId, action: 'DOMAIN_VERIFICATION_ADDED' }, orderBy: { createdAt: 'desc' } }),
        );

        expect(log).not.toBeNull();
        const meta = log!.metadata as Record<string, unknown>;
        expect(meta.domain).toBe(newDomain);
        expect(meta.status).toBe('PENDING');
        // verificationCode must never appear in audit log metadata
        expect(meta.verificationCode).toBeUndefined();
      });

      await test.step('DOMAIN_DELETED is logged when a domain verification is removed', async () => {
        const res = await page.request.delete(`/api/teams/${teamId}/domain-verification/${newDomainRecordId}`);
        expect(res.ok()).toBeTruthy();

        const log = await waitForAuditLog(() =>
          prisma.auditLog.findFirst({ where: { teamId, action: 'DOMAIN_DELETED' }, orderBy: { createdAt: 'desc' } }),
        );

        expect(log).not.toBeNull();
        const meta = log!.metadata as Record<string, unknown>;
        expect(meta.domain).toBe(newDomain);
        expect(meta.wasVerified).toBe(false);
      });

      await test.step('SSO_SAML_CONFIG_CREATED is logged when SAML config is created', async () => {
        const res = await page.request.post(`/api/teams/${teamId}/sso/saml/config`, {
          data: {
            name: 'Test SAML Provider',
            nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            idpEntityId: 'https://idp.example.test/metadata',
            idpSsoUrl: 'https://idp.example.test/sso',
            idpCertificate: 'MIIBFAKECERT',
            idpMetadataXml: null,
            attributeMapping: { email: 'email', firstName: 'firstName', lastName: 'lastName' },
          },
        });
        expect(res.ok()).toBeTruthy();

        const log = await waitForAuditLog(() =>
          prisma.auditLog.findFirst({ where: { teamId, action: 'SSO_SAML_CONFIG_CREATED' }, orderBy: { createdAt: 'desc' } }),
        );

        expect(log).not.toBeNull();
        const meta = log!.metadata as Record<string, unknown>;
        expect(meta.provider).toBe('SAML');
        expect(meta.idpEntityId).toBe('https://idp.example.test/metadata');
      });

      await test.step('SSO_SAML_CONFIG_UPDATED is logged when SAML config is changed', async () => {
        const res = await page.request.post(`/api/teams/${teamId}/sso/saml/config`, {
          data: {
            name: 'Test SAML Provider',
            nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            idpEntityId: 'https://idp-v2.example.test/metadata', // changed
            idpSsoUrl: 'https://idp-v2.example.test/sso', // changed
            idpCertificate: 'MIIBFAKECERT',
            idpMetadataXml: null,
            attributeMapping: { email: 'email', firstName: 'firstName', lastName: 'lastName' },
          },
        });
        expect(res.ok()).toBeTruthy();

        const log = await waitForAuditLog(() =>
          prisma.auditLog.findFirst({ where: { teamId, action: 'SSO_SAML_CONFIG_UPDATED' }, orderBy: { createdAt: 'desc' } }),
        );

        expect(log).not.toBeNull();
        const meta = log!.metadata as Record<string, unknown>;
        expect(meta.provider).toBe('SAML');
        // Diff should capture the changed fields
        const changes = meta.changes as Record<string, { from: string; to: string }>;
        expect(changes.idpEntityId?.from).toBe('https://idp.example.test/metadata');
        expect(changes.idpEntityId?.to).toBe('https://idp-v2.example.test/metadata');
      });

      await test.step('SSO_SAML_CONFIG_DELETED is logged when SAML config is deleted', async () => {
        const res = await page.request.delete(`/api/teams/${teamId}/sso/saml/config`);
        expect(res.ok()).toBeTruthy();

        const log = await waitForAuditLog(() =>
          prisma.auditLog.findFirst({ where: { teamId, action: 'SSO_SAML_CONFIG_DELETED' }, orderBy: { createdAt: 'desc' } }),
        );

        expect(log).not.toBeNull();
        const meta = log!.metadata as Record<string, unknown>;
        expect(meta.provider).toBe('SAML');
        expect(meta.idpEntityId).toBe('https://idp-v2.example.test/metadata');
        expect(typeof meta.affectedIdentitiesCount).toBe('number');
      });
    } finally {
      // Clean up the seeded domain record and all audit logs for this team
      await prisma.domainVerification.deleteMany({ where: { id: seededDomainRecord.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { teamId } }).catch(() => {});
    }
  });
});

import { prisma } from '@jetstream/api-config';
import { expect, test } from '@playwright/test';
import { cleanupSsoFixture, createSsoFixture } from '../../../../utils/auth-fixtures';
import {
  buildSignedSamlResponse,
  idpCertificate,
  idpCertificateBase64,
  initiateSamlLoginAndGetRequestId,
} from '../../../../utils/saml-test-utils';

test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Tests that ssoRequireMfa is honored for all SSO login paths:
 * 1. Returning team member (already has membership)
 * 2. Existing platform user being JIT-added to team for the first time
 *
 * Security regression: these paths previously hardcoded twoFactor: [] and
 * bypassed MFA entirely even when ssoRequireMfa was enabled.
 */
test.describe('SSO MFA enforcement', () => {
  let fixture: Awaited<ReturnType<typeof createSsoFixture>>;

  test.beforeAll(async () => {
    fixture = await createSsoFixture({
      ssoProvider: 'SAML',
      seedUser: true,
      addTeamMember: true,
      ssoRequireMfa: true,
      samlIdpCertificate: idpCertificate,
    });
    await prisma.samlConfiguration.update({
      where: { loginConfigId: fixture.loginConfigId },
      data: { idpCertificate: idpCertificateBase64 },
    });
  });

  test.afterAll(async () => {
    await cleanupSsoFixture(fixture);
  });

  test('requires MFA for a returning team member when ssoRequireMfa is enabled', async ({ request }) => {
    const userEmail = fixture.email;
    const requestId = await initiateSamlLoginAndGetRequestId(request, userEmail);
    const samlResponse = buildSignedSamlResponse(fixture.teamId, userEmail, requestId);

    await request.post(`/api/auth/sso/saml/${fixture.teamId}/acs`, {
      data: { SAMLResponse: samlResponse },
      maxRedirects: 0,
    });

    // Session was created but MFA should be pending — isLoggedIn must be false
    const sessionRes = await request.get('/api/auth/session');
    const session = await sessionRes.json();

    expect(session.data.isLoggedIn).toBe(false);
    expect(Array.isArray(session.data.pendingVerifications)).toBe(true);
    expect(session.data.pendingVerifications.length).toBeGreaterThan(0);
  });

  test('does not require MFA when ssoRequireMfa is disabled', async ({ request }) => {
    // Create a separate fixture with MFA disabled (the default)
    const noMfaFixture = await createSsoFixture({
      ssoProvider: 'SAML',
      seedUser: true,
      addTeamMember: true,
      ssoRequireMfa: false,
      samlIdpCertificate: idpCertificate,
    });
    await prisma.samlConfiguration.update({
      where: { loginConfigId: noMfaFixture.loginConfigId },
      data: { idpCertificate: idpCertificateBase64 },
    });

    try {
      const requestId = await initiateSamlLoginAndGetRequestId(request, noMfaFixture.email);
      const samlResponse = buildSignedSamlResponse(noMfaFixture.teamId, noMfaFixture.email, requestId);

      await request.post(`/api/auth/sso/saml/${noMfaFixture.teamId}/acs`, {
        data: { SAMLResponse: samlResponse },
        maxRedirects: 0,
      });

      const sessionRes = await request.get('/api/auth/session');
      const session = await sessionRes.json();

      expect(session.data.isLoggedIn).toBe(true);
      expect(session.data.pendingVerifications).toBe(false);
    } finally {
      await cleanupSsoFixture(noMfaFixture);
    }
  });
});

/**
 * Tests MFA enforcement for an existing platform user being JIT-added to a
 * team for the first time (the "no teamMembership" path in handleSsoLogin).
 */
test.describe('SSO MFA enforcement — JIT team add for existing user', () => {
  let fixture: Awaited<ReturnType<typeof createSsoFixture>>;

  test.beforeAll(async () => {
    // seedUser=true creates the platform account, addTeamMember=false means the
    // user has no team membership yet — SSO will JIT-add them on first login.
    fixture = await createSsoFixture({
      ssoProvider: 'SAML',
      seedUser: true,
      addTeamMember: false,
      ssoRequireMfa: true,
      samlIdpCertificate: idpCertificate,
    });
    await prisma.samlConfiguration.update({
      where: { loginConfigId: fixture.loginConfigId },
      data: { idpCertificate: idpCertificateBase64 },
    });
  });

  test.afterAll(async () => {
    await cleanupSsoFixture(fixture);
  });

  test('requires MFA when an existing user is JIT-added to a team via SSO', async ({ request }) => {
    const userEmail = fixture.email;
    const requestId = await initiateSamlLoginAndGetRequestId(request, userEmail);
    const samlResponse = buildSignedSamlResponse(fixture.teamId, userEmail, requestId);

    await request.post(`/api/auth/sso/saml/${fixture.teamId}/acs`, {
      data: { SAMLResponse: samlResponse },
      maxRedirects: 0,
    });

    // Membership should have been provisioned
    const memberCount = await prisma.teamMember.count({ where: { teamId: fixture.teamId } });
    expect(memberCount).toBeGreaterThanOrEqual(1);

    // But the session must have MFA pending, not be fully authenticated
    const sessionRes = await request.get('/api/auth/session');
    const session = await sessionRes.json();

    expect(session.data.isLoggedIn).toBe(false);
    expect(Array.isArray(session.data.pendingVerifications)).toBe(true);
    expect(session.data.pendingVerifications.length).toBeGreaterThan(0);
  });
});

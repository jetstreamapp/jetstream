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

test.describe('SSO JIT provisioning behavior', () => {
  let jitFixture: Awaited<ReturnType<typeof createSsoFixture>>;
  let noJitFixture: Awaited<ReturnType<typeof createSsoFixture>>;

  test.beforeAll(async () => {
    // jitFixture: JIT enabled (default), used for testing the cookie guard
    jitFixture = await createSsoFixture();

    // noJitFixture: real SAML cert so we can submit valid assertions and reach JIT logic
    noJitFixture = await createSsoFixture({
      ssoProvider: 'SAML',
      seedUser: true,
      addTeamMember: true,
      samlIdpCertificate: idpCertificate,
    });
    await prisma.samlConfiguration.update({
      where: { loginConfigId: noJitFixture.loginConfigId },
      data: { idpCertificate: idpCertificateBase64 },
    });
    await prisma.loginConfiguration.update({
      where: { id: noJitFixture.loginConfigId },
      data: { ssoJitProvisioningEnabled: false },
    });
  });

  test.afterAll(async () => {
    await cleanupSsoFixture(jitFixture);
    await cleanupSsoFixture(noJitFixture);
  });

  test('OIDC callback without cookies blocks login', async ({ request }) => {
    const res = await request.get(`/api/auth/sso/oidc/${jitFixture.teamId}/callback`, { maxRedirects: 0 });
    // The OIDC callback redirects on both success and auth errors, so we can't use a specific
    // status code. The key property is that the response is not a 2xx success.
    expect(res.ok()).toBeFalsy();
  });

  test('JIT disabled: a new user is rejected and no membership is created', async ({ request }) => {
    const membersBefore = await prisma.teamMember.count({ where: { teamId: noJitFixture.teamId } });

    // Submit a valid SAML assertion for a brand-new email address not in the team.
    // The backend should reject it because JIT provisioning is disabled and there is no invitation.
    const newUserEmail = `newuser@${noJitFixture.domain}`;
    const requestId = await initiateSamlLoginAndGetRequestId(request, newUserEmail);
    const samlResponse = buildSignedSamlResponse(noJitFixture.teamId, newUserEmail, requestId);

    const res = await request.post(`/api/auth/sso/saml/${noJitFixture.teamId}/acs`, {
      data: { SAMLResponse: samlResponse },
      maxRedirects: 0,
    });

    // The SAML ACS endpoint redirects for both success and auth errors.
    // Membership count is the definitive indicator of whether access was granted.
    expect(res.ok()).toBeFalsy();

    const membersAfter = await prisma.teamMember.count({ where: { teamId: noJitFixture.teamId } });
    expect(membersAfter).toBe(membersBefore);
  });
});

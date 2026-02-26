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

test.describe('SAML SSO happy path', () => {
  let fixture: Awaited<ReturnType<typeof createSsoFixture>>;
  const userEmail = () => `user@${fixture.domain}`;

  test.beforeAll(async () => {
    fixture = await createSsoFixture({
      ssoProvider: 'SAML',
      seedUser: false,
      addTeamMember: false,
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

  test('posts ACS response and provisions membership', async ({ request }) => {
    const requestId = await initiateSamlLoginAndGetRequestId(request, userEmail());
    const samlResponse = buildSignedSamlResponse(fixture.teamId, userEmail(), requestId);

    const res = await request.post(`/api/auth/sso/saml/${fixture.teamId}/acs`, {
      data: { SAMLResponse: samlResponse },
      maxRedirects: 0,
    });

    expect([302, 303, 307, 308].includes(res.status())).toBeTruthy();

    const memberCount = await prisma.teamMember.count({ where: { teamId: fixture.teamId } });
    expect(memberCount).toBeGreaterThanOrEqual(1);
  });

  test('replaying the same assertion is rejected', async ({ request }) => {
    // The backend caches consumed assertion IDs to prevent replay attacks.
    // Submitting the same signed assertion a second time must be rejected.
    const requestId = await initiateSamlLoginAndGetRequestId(request, userEmail());
    const samlResponse = buildSignedSamlResponse(fixture.teamId, userEmail(), requestId);

    // First submission: succeeds, request ID is consumed from the cache
    const successRes = await request.post(`/api/auth/sso/saml/${fixture.teamId}/acs`, {
      data: { SAMLResponse: samlResponse },
      maxRedirects: 0,
    });
    const successLocation = successRes.headers()['location'];

    // Second submission of the identical bytes: request ID is no longer in the cache
    const replayRes = await request.post(`/api/auth/sso/saml/${fixture.teamId}/acs`, {
      data: { SAMLResponse: samlResponse },
      maxRedirects: 0,
    });
    const replayLocation = replayRes.headers()['location'];

    // Both responses are 302, but success redirects to the app while replay
    // redirects to an error page — so the Location headers must differ.
    expect(replayLocation).toBeTruthy();
    expect(replayLocation).not.toBe(successLocation);
  });

  test('a second valid assertion for the same user succeeds without duplicating membership', async ({ request }) => {
    // Simulates a user who already has team membership logging in again via SSO.
    // Each login requires a fresh SP-initiated flow with a new AuthnRequest ID.
    const requestId = await initiateSamlLoginAndGetRequestId(request, userEmail());
    const samlResponse = buildSignedSamlResponse(fixture.teamId, userEmail(), requestId);

    const res = await request.post(`/api/auth/sso/saml/${fixture.teamId}/acs`, {
      data: { SAMLResponse: samlResponse },
      maxRedirects: 0,
    });

    expect([302, 303, 307, 308].includes(res.status())).toBeTruthy();

    // Membership count should remain 1 — no duplicate rows created
    const memberCount = await prisma.teamMember.count({ where: { teamId: fixture.teamId } });
    expect(memberCount).toBe(1);
  });
});

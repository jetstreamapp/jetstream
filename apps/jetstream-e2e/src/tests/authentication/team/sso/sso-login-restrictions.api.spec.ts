import { prisma } from '@jetstream/api-config';
import { CURRENT_TOS_VERSION } from '@jetstream/auth/server';
import { APIRequestContext, expect, test } from '@playwright/test';
import { addDays } from 'date-fns';
import { cleanupSsoFixture, createSsoFixture } from '../../../../utils/auth-fixtures';

/**
 * Covers the two ways a team's login configuration can reject an otherwise valid password login,
 * and what the server tells the sign in screen so it can explain what to do instead:
 *
 * - `SsoRequired` - the team requires SSO, so the screen points at the SSO button
 * - `ProviderNotAllowed` - the provider is turned off, so the screen names the methods that are on
 *
 * These assert the API contract the banner is built from. `team.spec.ts` asserts the rendered copy.
 */

test.use({ storageState: { cookies: [], origins: [] } });

async function getCsrf(request: APIRequestContext) {
  const response = await request.get('/api/auth/csrf');
  const body = await response.json();
  return body?.data?.csrfToken || body?.csrfToken;
}

/** Mirrors what the login form posts - password sign in goes through the credentials callback, not /signin */
async function signInWithPassword(request: APIRequestContext, email: string, password: string) {
  const csrfToken = await getCsrf(request);
  const response = await request.post('/api/auth/callback/credentials', {
    headers: { Accept: 'application/json' },
    form: { action: 'login', email, password, csrfToken },
    maxRedirects: 0,
  });
  const body = await response.json().catch(() => null);
  return { response, body, errorType: body?.errorType || body?.data?.errorType };
}

test.describe('Login configuration restrictions on password sign in', () => {
  const fixtures: Awaited<ReturnType<typeof createSsoFixture>>[] = [];

  async function createFixture(options: Parameters<typeof createSsoFixture>[0]) {
    const fixture = await createSsoFixture(options);
    fixtures.push(fixture);
    return fixture;
  }

  test.afterAll(async () => {
    await Promise.all(fixtures.map((fixture) => cleanupSsoFixture(fixture)));
  });

  test('rejects password sign in with SsoRequired when SSO bypass is disabled', async ({ request }) => {
    const fixture = await createFixture({ ssoEnabled: true, ssoBypassEnabled: false });

    const { response, errorType } = await signInWithPassword(request, fixture.email, fixture.password!);

    expect(response.ok()).toBeFalsy();
    expect(errorType).toBe('SsoRequired');
  });

  test('rejects password sign in with SsoRequired when the role cannot bypass SSO', async ({ request }) => {
    // The seeded user is an ADMIN, so limiting bypass to MEMBER locks them out
    const fixture = await createFixture({ ssoEnabled: true, ssoBypassEnabled: true, ssoBypassEnabledRoles: ['MEMBER'] });

    const { response, errorType } = await signInWithPassword(request, fixture.email, fixture.password!);

    expect(response.ok()).toBeFalsy();
    expect(errorType).toBe('SsoRequired');
  });

  test('allows password sign in when the role is permitted to bypass SSO', async ({ request }) => {
    // Control for the two tests above - proves they fail because of the bypass rules and not
    // because SSO being enabled blocks password sign in outright.
    const fixture = await createFixture({ ssoEnabled: true, ssoBypassEnabled: true, ssoBypassEnabledRoles: ['ADMIN'] });

    const { errorType } = await signInWithPassword(request, fixture.email, fixture.password!);

    expect(errorType).toBeFalsy();
  });

  test('ProviderNotAllowed names the methods the team still permits, including SSO', async ({ request }) => {
    const fixture = await createFixture({
      ssoEnabled: true,
      ssoBypassEnabled: true,
      ssoBypassEnabledRoles: ['ADMIN'],
      allowedProviders: ['google', 'salesforce'],
    });

    const { response, body, errorType } = await signInWithPassword(request, fixture.email, fixture.password!);

    expect(response.ok()).toBeFalsy();
    expect(errorType).toBe('ProviderNotAllowed');
    expect(body?.data?.attemptedMethod).toBe('credentials');
    // Order is canonical, not database order, so the message reads the same for every team
    expect(body?.data?.allowedMethods).toEqual(['google', 'salesforce', 'sso']);
  });

  test('ProviderNotAllowed omits SSO when the team has not enabled it', async ({ request }) => {
    const fixture = await createFixture({ ssoEnabled: false, allowedProviders: ['google'] });

    const { body, errorType } = await signInWithPassword(request, fixture.email, fixture.password!);

    expect(errorType).toBe('ProviderNotAllowed');
    expect(body?.data?.allowedMethods).toEqual(['google']);
  });
});

/**
 * Someone invited to the team has no membership yet, so SSO bypass is judged by the role on their invite.
 * A refused registration must not leave an account behind, and the invite must still be usable through SSO.
 */
test.describe('Login configuration restrictions on password registration from a team invite', () => {
  const fixtures: Awaited<ReturnType<typeof createSsoFixture>>[] = [];

  async function createFixture(options: Parameters<typeof createSsoFixture>[0]) {
    const fixture = await createSsoFixture(options);
    fixtures.push(fixture);
    return fixture;
  }

  test.afterAll(async () => {
    await Promise.all(fixtures.map((fixture) => cleanupSsoFixture(fixture)));
  });

  /** Invites a new MEMBER and follows the emailed link, which is what stores the invite in a cookie for sign up */
  async function inviteNewMember(request: APIRequestContext, fixture: Awaited<ReturnType<typeof createSsoFixture>>) {
    const email = `invitee@${fixture.domain}`;
    const invite = await prisma.teamMemberInvitation.create({
      data: { teamId: fixture.teamId, email, role: 'MEMBER', expiresAt: addDays(new Date(), 7), lastSentAt: new Date() },
    });
    const params = new URLSearchParams({
      action: 'team-invite',
      email,
      teamId: fixture.teamId,
      token: invite.token,
      redirectUrl: `/app/teams/invite?teamId=${fixture.teamId}&token=${invite.token}`,
    });
    await request.get(`/redirect?${params.toString()}`, { maxRedirects: 0 });
    return { email, invite };
  }

  async function registerWithPassword(request: APIRequestContext, email: string) {
    const csrfToken = await getCsrf(request);
    const response = await request.post('/api/auth/callback/credentials', {
      headers: { Accept: 'application/json' },
      form: { action: 'register', email, name: 'Invitee', password: 'Invitee-Password1!', tosVersion: CURRENT_TOS_VERSION, csrfToken },
      maxRedirects: 0,
    });
    const body = await response.json().catch(() => null);
    return { response, errorType: body?.errorType || body?.data?.errorType };
  }

  test('refuses registration with SsoRequired when the invite role cannot bypass SSO', async ({ request }) => {
    const fixture = await createFixture({ ssoEnabled: true, ssoBypassEnabled: true, ssoBypassEnabledRoles: ['ADMIN'] });
    const { email, invite } = await inviteNewMember(request, fixture);

    const { response, errorType } = await registerWithPassword(request, email);

    expect(response.ok()).toBeFalsy();
    expect(errorType).toBe('SsoRequired');
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect(await prisma.teamMemberInvitation.count({ where: { id: invite.id } })).toBe(1);
  });

  test('allows registration and joins the team when the invite role may bypass SSO', async ({ request }) => {
    // Control for the test above - proves it fails because of the bypass rules and not because SSO being
    // enabled blocks password registration outright.
    const fixture = await createFixture({ ssoEnabled: true, ssoBypassEnabled: true, ssoBypassEnabledRoles: ['MEMBER'] });
    const { email } = await inviteNewMember(request, fixture);

    const { errorType } = await registerWithPassword(request, email);

    expect(errorType).toBeFalsy();
    const membership = await prisma.teamMember.findFirst({ where: { teamId: fixture.teamId, user: { email } } });
    expect(membership?.role).toBe('MEMBER');
  });
});

import { prisma } from '@jetstream/api-config';
import { HTTP } from '@jetstream/shared/constants';
import type { TeamUserFacing, UserProfileUi } from '@jetstream/types';
import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import { expect, test } from '../../../fixtures/fixtures';

/**
 * Raw `page.request` calls bypass the axios interceptor that echoes the CSRF cookie, so mirror it here
 */
type MutatingMethod = 'post' | 'put' | 'delete';
type MutatingFn = (url: string, options?: Parameters<APIRequestContext['post']>[1]) => Promise<APIResponse>;
async function csrfRequest(page: Page): Promise<Record<MutatingMethod, MutatingFn>> {
  const cookies = await page.context().cookies();
  const csrfToken = cookies.find(({ name }) => name.endsWith(HTTP.COOKIE.CSRF_SUFFIX))?.value ?? '';
  const wrap =
    (method: MutatingMethod): MutatingFn =>
    (url, options = {}) =>
      page.request[method](url, {
        ...options,
        headers: { ...options.headers, [HTTP.HEADERS.X_CSRF_TOKEN]: csrfToken },
      });
  return { post: wrap('post'), put: wrap('put'), delete: wrap('delete') };
}

async function waitForAuditLog(query: () => ReturnType<typeof prisma.auditLog.findFirst>, maxAttempts = 20, delayMs = 100) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await query();
    if (result !== null) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

/** Creating profiles is behind the `team-access-profiles` flag, which is off by default */
async function enableAccessProfiles(teamId: string) {
  await prisma.featureFlagOverride.upsert({
    where: { uniqueFeatureFlagTeam: { key: 'team-access-profiles', teamId } },
    create: { key: 'team-access-profiles', teamId, enabled: true },
    update: { enabled: true },
  });
}

test.describe('Team Access Profiles', () => {
  // Each fixture creates its own users so we start from a clean, unauthenticated state
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('admin limits a member to read only tools', async ({ teamCreationUtils3Users: tc, page, teamDashboardPage }) => {
    const { team, member1, member3: billingMember } = tc;
    const teamId = team.id;
    await enableAccessProfiles(teamId);
    const request = await csrfRequest(page);
    const accessProfileName = 'Read only E2E';

    await test.step('Admin creates an access profile from a preset', async () => {
      await page.goto('/app/home');
      await teamDashboardPage.goToTeamDashboardPage();
      await expect(teamDashboardPage.accessProfilesCard).toBeVisible();

      await teamDashboardPage.accessProfilesCard.getByRole('button', { name: 'New Access Profile' }).click();
      const modal = teamDashboardPage.accessProfileEditorModal;
      await expect(modal.getByRole('heading', { name: 'New Access Profile' })).toBeVisible();
      await modal.getByRole('button', { name: 'Read only' }).click();
      await modal.getByLabel('Name').fill(accessProfileName);
      await modal.getByRole('button', { name: 'Save' }).click();
      await expect(modal).toBeHidden();

      await expect(teamDashboardPage.accessProfilesCard.getByTestId(`team-access-profile-row-${accessProfileName}`)).toBeVisible();
    });

    const accessProfileId = await test.step('Admin assigns the profile to a member', async () => {
      await teamDashboardPage.openUpdateRoleModal(member1.user.email);
      await teamDashboardPage.selectAccessProfile(teamDashboardPage.teamMemberUpdateModal, accessProfileName);
      await teamDashboardPage.teamMemberUpdateModal.getByRole('button', { name: 'Save' }).click();
      await expect(teamDashboardPage.teamMemberUpdateModal).toBeHidden();

      const memberRow = teamDashboardPage.teamMemberTable.getByTestId(`team-member-row-${member1.user.email}`);
      await expect(memberRow.getByText(accessProfileName)).toBeVisible();

      const membership = await prisma.teamMember.findFirstOrThrow({
        where: { teamId, userId: member1.userId },
        select: { accessProfileId: true, accessProfile: { select: { name: true } } },
      });
      expect(membership.accessProfile?.name).toBe(accessProfileName);
      return membership.accessProfileId!;
    });

    await test.step('Profile changes are audited', async () => {
      const createdLog = await waitForAuditLog(() =>
        prisma.auditLog.findFirst({ where: { teamId, action: 'TEAM_ACCESS_PROFILE_CREATED', resourceId: accessProfileId } }),
      );
      expect(createdLog).not.toBeNull();

      const assignedLog = await waitForAuditLog(() =>
        prisma.auditLog.findFirst({ where: { teamId, action: 'TEAM_MEMBER_ACCESS_PROFILE_UPDATED', resourceId: member1.userId } }),
      );
      expect(assignedLog).not.toBeNull();
      expect((assignedLog!.metadata as Record<string, unknown>).newAccessProfileName).toBe(accessProfileName);
    });

    const memberPage = await member1.context.newPage();

    await test.step('Member profile includes the access profile', async () => {
      const response = await memberPage.request.get('/api/me');
      expect(response.ok()).toBeTruthy();
      const { data: userProfile } = (await response.json()) as { data: UserProfileUi };
      expect(userProfile.teamMembership?.accessProfile?.id).toBe(accessProfileId);
      expect(userProfile.teamMembership?.accessProfile?.policy.tools).toContain('query');
      expect(userProfile.teamMembership?.accessProfile?.policy.tools).not.toContain('load');
    });

    await test.step('Member only sees tools in their profile', async () => {
      await memberPage.goto('/app/home');
      const content = memberPage.getByTestId('content');
      await expect(content.getByRole('link', { name: 'Query Records' })).toBeVisible();
      await expect(content.getByRole('link', { name: 'Load Records', exact: true })).toHaveCount(0);
      await expect(content.getByRole('link', { name: 'Anonymous Apex' })).toHaveCount(0);

      await memberPage.goto('/app/load');
      await expect(memberPage.getByRole('heading', { name: 'This tool is not available to you' })).toBeVisible();
    });

    await test.step('Only admins manage access profiles', async () => {
      const memberRequest = await csrfRequest(memberPage);
      const memberResponse = await memberRequest.post(`/api/teams/${teamId}/access-profiles`, {
        data: { name: 'Not allowed', policy: { tools: [], operations: [], surfaces: [] } },
      });
      expect(memberResponse.status()).toBe(403);

      const billingPage = await billingMember.context.newPage();
      await billingPage.goto('/app/home');
      const billingRequest = await csrfRequest(billingPage);
      const billingResponse = await billingRequest.put(`/api/teams/${teamId}/members/${member1.userId}`, {
        data: { accessProfileId: null },
      });
      // Specifically the access profile gate, not one of the role checks that run before it
      expect(billingResponse.status()).toBe(403);
      expect((await billingResponse.json()).message).toBe('Only administrators can assign access profiles');
      await billingPage.close();
    });

    await test.step('Deleting a profile in use requires choosing where members move to', async () => {
      const blockedResponse = await request.delete(`/api/teams/${teamId}/access-profiles/${accessProfileId}`);
      // The in-use guard, not the database foreign key (which would surface as a 500)
      expect(blockedResponse.status()).toBe(400);
      expect((await blockedResponse.json()).message).toMatch(/still assigned/);

      const deleteResponse = await request.delete(`/api/teams/${teamId}/access-profiles/${accessProfileId}?reassignTo=FULL_ACCESS`);
      expect(deleteResponse.ok()).toBeTruthy();
      const { data: updatedTeam } = (await deleteResponse.json()) as { data: TeamUserFacing };
      expect(updatedTeam.accessProfiles).toHaveLength(0);
      expect(updatedTeam.members.find(({ userId }) => userId === member1.userId)?.accessProfileId).toBeNull();
    });

    await test.step('Member regains full access', async () => {
      await memberPage.goto('/app/load');
      // Wait for the Load route to render before asserting the guard is gone, otherwise the check passes while the app is
      // still loading. The member has no orgs, so the route shows the welcome instructions, or the tool once an org exists.
      await expect(
        memberPage.getByTestId('load-records-page').or(memberPage.getByRole('heading', { name: 'Welcome to Jetstream.' })),
      ).toBeVisible();
      await expect(memberPage.getByRole('heading', { name: 'This tool is not available to you' })).toHaveCount(0);
      await memberPage.close();
    });
  });

  test('a member limited to the desktop application has restricted web access', async ({ teamCreationUtils3Users: tc, page }) => {
    const { team, member1 } = tc;
    const teamId = team.id;
    await enableAccessProfiles(teamId);
    const request = await csrfRequest(page);

    await test.step('Admin assigns a profile without the web application', async () => {
      const createResponse = await request.post(`/api/teams/${teamId}/access-profiles`, {
        data: { name: 'Desktop only E2E', policy: { tools: ['query'], operations: ['orgs.connect'], surfaces: ['desktop'] } },
      });
      expect(createResponse.ok()).toBeTruthy();
      const { data: createdTeam } = (await createResponse.json()) as { data: TeamUserFacing };
      const accessProfileId = createdTeam.accessProfiles.find(({ name }) => name === 'Desktop only E2E')?.id;

      const assignResponse = await request.put(`/api/teams/${teamId}/members/${member1.userId}`, { data: { accessProfileId } });
      expect(assignResponse.ok()).toBeTruthy();
    });

    const memberPage = await member1.context.newPage();

    await test.step('Member sees the restricted home page without tools or orgs', async () => {
      await memberPage.goto('/app/home');
      await expect(memberPage.getByRole('heading', { name: 'Web access is restricted' })).toBeVisible();
      const content = memberPage.getByTestId('content');
      await expect(content.getByRole('link', { name: 'Query Records' })).toHaveCount(0);
      await expect(content.getByRole('link', { name: 'Download the Desktop Application' })).toBeVisible();
      await expect(content.getByRole('link', { name: 'User Settings' })).toBeVisible();

      // Tool routes are not registered, so they fall back to the home page
      await memberPage.goto('/app/query');
      await expect(memberPage.getByRole('heading', { name: 'Web access is restricted' })).toBeVisible();
    });

    await test.step('Server refuses org access from the web application', async () => {
      const orgsResponse = await memberPage.request.get('/api/orgs');
      expect(orgsResponse.status()).toBe(403);
      expect((await orgsResponse.json()).message).toBe('Your team access profile does not include the Jetstream web application.');

      const profileResponse = await memberPage.request.get('/api/me');
      expect(profileResponse.ok()).toBeTruthy();
    });

    await memberPage.close();
  });

  test('new invitations receive the team default profile', async ({ teamCreationUtils1User: tc, page }) => {
    const teamId = tc.team.id;
    await enableAccessProfiles(teamId);
    const request = await csrfRequest(page);

    const createResponse = await request.post(`/api/teams/${teamId}/access-profiles`, {
      data: { name: 'Default E2E', isDefault: true, policy: { tools: ['query'], operations: ['orgs.connect'], surfaces: [] } },
    });
    expect(createResponse.ok()).toBeTruthy();
    const { data: team } = (await createResponse.json()) as { data: TeamUserFacing };
    const defaultProfile = team.accessProfiles.find(({ name }) => name === 'Default E2E');
    expect(defaultProfile?.isDefault).toBe(true);

    const inviteeEmail = `access-profile-${Date.now()}@playwright.getjetstream.app`;
    const inviteResponse = await request.post(`/api/teams/${teamId}/invitations`, { data: { email: inviteeEmail, role: 'BILLING' } });
    expect(inviteResponse.ok()).toBeTruthy();

    const invitation = await prisma.teamMemberInvitation.findFirstOrThrow({ where: { teamId, email: inviteeEmail } });
    expect(invitation.accessProfileId).toBe(defaultProfile?.id);

    const explicitInviteeEmail = `access-profile-full-${Date.now()}@playwright.getjetstream.app`;
    const explicitResponse = await request.post(`/api/teams/${teamId}/invitations`, {
      data: { email: explicitInviteeEmail, role: 'BILLING', accessProfileId: null },
    });
    expect(explicitResponse.ok()).toBeTruthy();
    const explicitInvitation = await prisma.teamMemberInvitation.findFirstOrThrow({ where: { teamId, email: explicitInviteeEmail } });
    expect(explicitInvitation.accessProfileId).toBeNull();
  });
});

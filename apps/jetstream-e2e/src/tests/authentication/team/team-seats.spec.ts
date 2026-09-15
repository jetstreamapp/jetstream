import { prisma } from '@jetstream/api-config';
import { ApiRequestUtils, AuthenticationPage, TeamCreationUtils } from '@jetstream/test/e2e-utils';
import type { TeamMemberRole, TeamSeatChangePreview, TeamSeatSummary, TeamSeatUpdateResponse, TeamUserFacing } from '@jetstream/types';
import type { APIResponse, Browser, Route } from '@playwright/test';
import { expect, test } from '../../../fixtures/fixtures';

/**
 * Purchased team seats.
 *
 * Stripe is not available in E2E, so teams get their purchased seats written straight to the database
 * (`TeamCreationUtils.setSeats`) and the Manage Seats flow is exercised through `page.route` mocks of the
 * two seat endpoints. Everything else (invite / reactivate / role / accept enforcement) hits the real API.
 *
 * The 3-user fixture creates ADMIN + MEMBER + MEMBER + BILLING, i.e. 3 billable members.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const BILLABLE_MEMBERS_IN_3_USER_FIXTURE = 3;

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

interface SeatErrorBody {
  error: boolean;
  message: string;
  data?: { code?: string; kind?: string; seats?: TeamSeatSummary };
}

function fetchTeam(api: ApiRequestUtils, teamId: string): Promise<TeamUserFacing> {
  return api.makeRequest<TeamUserFacing>('GET', `/api/teams/${teamId}`);
}

function inviteMember(api: ApiRequestUtils, teamId: string, email: string, role: TeamMemberRole): Promise<APIResponse> {
  return api.makeRequestRaw('POST', `/api/teams/${teamId}/invitations`, { email, role, features: ['ALL'] });
}

async function expectNoSeatsError(response: APIResponse, kind: 'ADD' | 'ACCEPT_INVITATION'): Promise<SeatErrorBody> {
  expect(response.status()).toBe(400);
  const body = (await response.json()) as SeatErrorBody;
  expect(body.data?.code).toBe('NO_SEATS');
  expect(body.data?.kind).toBe(kind);
  expect(body.data?.seats).toBeDefined();
  return body;
}

/** Audit logs are written after the response is sent, so poll briefly instead of asserting immediately */
function waitForAuditLog(teamId: string, action: string) {
  return expect
    .poll(() => prisma.auditLog.findFirst({ where: { teamId, action }, orderBy: { createdAt: 'desc' } }), { timeout: 5_000 })
    .not.toBeNull();
}

/** Noon UTC keeps the calendar day identical in every timezone the client could format the date in */
function futureDateAtNoonUtc(daysFromNow: number): Date {
  const date = new Date(Date.now() + daysFromNow * DAY_MS);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0));
}

/** Matches the date whether the client renders "Oct 10, 2026", "October 10, 2026", "10/10/2026" or "2026-10-10" */
function dateTextPattern(date: Date): RegExp {
  const monthLong = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const monthShort = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const pad = (value: number) => String(value).padStart(2, '0');
  return new RegExp(
    [
      `(${monthLong}|${monthShort})\\.?\\s+0?${day},?\\s+${year}`,
      `\\b0?${month}/0?${day}/${year}\\b`,
      `${year}-${pad(month)}-${pad(day)}`,
    ].join('|'),
  );
}

/** A copy of the team payload with a different seat state, as the mocked seat endpoint would return it */
function teamWithSeats(team: TeamUserFacing, overrides: Partial<TeamSeatSummary>): TeamUserFacing {
  const seats = { ...team.seats, ...overrides };
  const effective = seats.pending === null || seats.purchased === null ? seats.purchased : Math.min(seats.purchased, seats.pending);
  const available = effective === null ? null : effective - seats.used - seats.reserved;
  return {
    ...team,
    billingAccount: team.billingAccount
      ? {
          ...team.billingAccount,
          licenseCountLimit: seats.purchased,
          pendingSeatQuantity: seats.pending,
          pendingSeatEffectiveAt: seats.pendingEffectiveAt,
        }
      : null,
    seats: { ...seats, effective, available, isUnlimited: seats.purchased === null, isOverAllocated: available !== null && available < 0 },
  };
}

async function fulfillJson(route: Route, data: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
}

/** Signs up a brand new user in an isolated context so they can be invited and accept through the API */
async function registerInvitee(browser: Browser, teamCreationUtils: TeamCreationUtils) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const authenticationPage = new AuthenticationPage(page);
  await page.goto('/');
  await authenticationPage.acceptCookieBanner();
  const user = await authenticationPage.signUpAndVerifyEmail();
  teamCreationUtils.users.push(user);
  teamCreationUtils.userEmails.push(user.email);
  return { context, page, user };
}

test.describe('Team seats', () => {
  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('At the seat cap, billable invitations are blocked and Billing invitations are allowed', async ({
    page,
    apiRequestUtils,
    authenticationPage,
    teamDashboardPage,
    teamCreationUtils3Users: teamCreationUtils,
  }) => {
    const { team } = teamCreationUtils;
    const billingEmail = authenticationPage.generateTestEmail();
    const memberEmail = authenticationPage.generateTestEmail();
    teamCreationUtils.userEmails.push(billingEmail, memberEmail);

    await teamCreationUtils.setSeats({ purchased: BILLABLE_MEMBERS_IN_3_USER_FIXTURE });
    await teamDashboardPage.goToTeamDashboardPage();

    await test.step('Dashboard shows every seat in use but keeps the Add Team Member button', async () => {
      await teamDashboardPage.expectSeatSummary({ purchased: 3, used: 3, available: 0 });
      await expect(teamDashboardPage.seatsBanner).toBeVisible();
      await expect(teamDashboardPage.addTeamMemberButton).toBeVisible();
      await expect(teamDashboardPage.manageSeatsButton).toBeVisible();
    });

    await test.step('Member invitation is blocked in the modal, switching to Billing allows it', async () => {
      await teamDashboardPage.openInviteModal();
      const sendButton = teamDashboardPage.teamMemberInviteModal.getByRole('button', { name: 'Send Invitation' });
      await teamDashboardPage.teamMemberInviteModal.getByLabel('Email Address').fill(billingEmail);

      // Default role is Member, which needs a seat
      await expect(teamDashboardPage.seatsUnavailableNotice).toBeVisible();
      await expect(sendButton).toBeDisabled();

      await teamDashboardPage.selectInviteRole('Billing');
      await expect(teamDashboardPage.seatsUnavailableNotice).toBeHidden();
      await expect(sendButton).toBeEnabled();
      await sendButton.click();

      const inviteRow = teamDashboardPage.teamInviteTable.getByTestId(`team-member-row-invite-${billingEmail}`);
      await expect(inviteRow.getByText('Pending')).toBeVisible();
      // A Billing invitation does not reserve a seat
      await teamDashboardPage.expectSeatSummary({ purchased: 3, used: 3, available: 0 });
    });

    await test.step('API rejects a Member invitation with NO_SEATS', async () => {
      const response = await inviteMember(apiRequestUtils, team.id, memberEmail, 'MEMBER');
      const body = await expectNoSeatsError(response, 'ADD');
      expect(body.data?.seats?.available).toBe(0);
      expect(await prisma.teamMemberInvitation.count({ where: { teamId: team.id, email: memberEmail } })).toBe(0);
      await waitForAuditLog(team.id, 'TEAM_MEMBER_ADD_BLOCKED_NO_SEATS');
    });

    await test.step('API accepts a Billing invitation at the cap', async () => {
      const response = await inviteMember(apiRequestUtils, team.id, memberEmail, 'BILLING');
      expect(response.ok()).toBeTruthy();
      const { seats } = await fetchTeam(apiRequestUtils, team.id);
      expect(seats).toMatchObject({ purchased: 3, used: 3, reserved: 0, available: 0, isOverAllocated: false });
    });

    await page.close();
  });

  test('Reactivation is blocked while a pending invitation holds the last seat', async ({
    page,
    apiRequestUtils,
    authenticationPage,
    teamDashboardPage,
    teamCreationUtils3Users: teamCreationUtils,
  }) => {
    const { team } = teamCreationUtils;
    const [member1] = teamCreationUtils.members;
    const inviteEmail = authenticationPage.generateTestEmail();
    teamCreationUtils.userEmails.push(inviteEmail);

    await teamCreationUtils.setSeats({ purchased: BILLABLE_MEMBERS_IN_3_USER_FIXTURE });
    await teamDashboardPage.goToTeamDashboardPage();

    await test.step('Deactivating a member frees a seat', async () => {
      await teamDashboardPage.openDeactivateModal(member1.user.email);
      await expect(teamDashboardPage.teamMemberStatusUpdateModal.getByText('Once deactivated, this user')).toBeVisible();
      await teamDashboardPage.teamMemberStatusUpdateModal.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByRole('heading', { name: 'Successfully deactivated' })).toBeVisible();
      await teamDashboardPage.expectSeatSummary({ purchased: 3, used: 2, available: 1 });
    });

    await test.step('A pending Member invitation reserves the freed seat', async () => {
      const response = await inviteMember(apiRequestUtils, team.id, inviteEmail, 'MEMBER');
      expect(response.ok()).toBeTruthy();
      await page.reload();
      await teamDashboardPage.expectSeatSummary({ purchased: 3, used: 2, available: 0 });
    });

    await test.step('Reactivating the member is blocked in the modal and by the API', async () => {
      await teamDashboardPage.openReactivateModal(member1.user.email);
      await expect(teamDashboardPage.seatsUnavailableNotice).toBeVisible();
      await expect(teamDashboardPage.teamMemberStatusUpdateModal.getByRole('button', { name: 'Save' })).toBeDisabled();
      await teamDashboardPage.teamMemberStatusUpdateModal.getByRole('button', { name: 'Cancel' }).click();
      await expect(teamDashboardPage.teamMemberStatusUpdateModal).toBeHidden();

      const response = await apiRequestUtils.makeRequestRaw('PUT', `/api/teams/${team.id}/members/${member1.userId}/status`, {
        status: 'ACTIVE',
        role: 'MEMBER',
      });
      await expectNoSeatsError(response, 'ADD');
      const membership = await prisma.teamMember.findUniqueOrThrow({
        where: { teamId_userId: { teamId: team.id, userId: member1.userId } },
      });
      expect(membership.status).toBe('INACTIVE');
    });

    await test.step('Cancelling the invitation frees the seat and reactivation succeeds', async () => {
      const invitation = await prisma.teamMemberInvitation.findFirstOrThrow({ where: { teamId: team.id, email: inviteEmail } });
      const response = await apiRequestUtils.makeRequestRaw('DELETE', `/api/teams/${team.id}/invitations/${invitation.id}`);
      expect(response.ok()).toBeTruthy();

      await page.reload();
      await teamDashboardPage.expectSeatSummary({ purchased: 3, used: 2, available: 1 });
      await teamDashboardPage.reactivateUser(member1.user.email);
      await teamDashboardPage.expectSeatSummary({ purchased: 3, used: 3, available: 0 });

      const membership = await prisma.teamMember.findUniqueOrThrow({
        where: { teamId_userId: { teamId: team.id, userId: member1.userId } },
      });
      expect(membership.status).toBe('ACTIVE');
    });

    await page.close();
  });

  test('Seat-neutral role changes are allowed at the cap, seat-consuming ones are not', async ({
    page,
    apiRequestUtils,
    teamDashboardPage,
    teamCreationUtils3Users: teamCreationUtils,
  }) => {
    const { team } = teamCreationUtils;
    const [member1, member2, billingMember] = teamCreationUtils.members;

    await teamCreationUtils.setSeats({ purchased: BILLABLE_MEMBERS_IN_3_USER_FIXTURE });
    await teamDashboardPage.goToTeamDashboardPage();
    await teamDashboardPage.expectSeatSummary({ purchased: 3, used: 3, available: 0 });

    await test.step('MEMBER to ADMIN succeeds through the dashboard', async () => {
      await teamDashboardPage.updateUserRole(member1.user.email, 'Admin');
      const row = page.getByTestId(`team-member-row-${member1.user.email}`);
      await expect(row.getByText('Admin')).toBeVisible();
      await teamDashboardPage.expectSeatSummary({ purchased: 3, used: 3, available: 0 });
    });

    await test.step('MEMBER to ADMIN and back succeed through the API', async () => {
      const promote = await apiRequestUtils.makeRequestRaw('PUT', `/api/teams/${team.id}/members/${member2.userId}`, { role: 'ADMIN' });
      expect(promote.ok()).toBeTruthy();
      const demote = await apiRequestUtils.makeRequestRaw('PUT', `/api/teams/${team.id}/members/${member2.userId}`, { role: 'MEMBER' });
      expect(demote.ok()).toBeTruthy();
      const membership = await prisma.teamMember.findUniqueOrThrow({
        where: { teamId_userId: { teamId: team.id, userId: member2.userId } },
      });
      expect(membership.role).toBe('MEMBER');
    });

    await test.step('BILLING to MEMBER needs a seat and is rejected', async () => {
      const response = await apiRequestUtils.makeRequestRaw('PUT', `/api/teams/${team.id}/members/${billingMember.userId}`, {
        role: 'MEMBER',
      });
      await expectNoSeatsError(response, 'ADD');
      const membership = await prisma.teamMember.findUniqueOrThrow({
        where: { teamId_userId: { teamId: team.id, userId: billingMember.userId } },
      });
      expect(membership.role).toBe('BILLING');
    });

    await test.step('BILLING to MEMBER is blocked in the modal too', async () => {
      await teamDashboardPage.openUpdateRoleModal(billingMember.user.email);
      await teamDashboardPage.teamMemberUpdateModal.getByPlaceholder('Select an Option').click();
      await teamDashboardPage.teamMemberUpdateModal.getByRole('option', { name: 'Member' }).click();
      await expect(teamDashboardPage.seatsUnavailableNotice).toBeVisible();
      await expect(teamDashboardPage.teamMemberUpdateModal.getByRole('button', { name: 'Save' })).toBeDisabled();
      await teamDashboardPage.teamMemberUpdateModal.getByRole('button', { name: 'Cancel' }).click();
    });

    await page.close();
  });

  test('A pending seat decrease lowers the effective cap', async ({
    page,
    apiRequestUtils,
    authenticationPage,
    teamDashboardPage,
    teamCreationUtils3Users: teamCreationUtils,
  }) => {
    const { team } = teamCreationUtils;
    const memberEmail = authenticationPage.generateTestEmail();
    const billingEmail = authenticationPage.generateTestEmail();
    teamCreationUtils.userEmails.push(memberEmail, billingEmail);
    const pendingEffectiveAt = futureDateAtNoonUtc(30);

    // 4 purchased, decreasing to 3 at the end of the period, with 3 in use: no seat is free
    await teamCreationUtils.setSeats({ purchased: 4, pending: 3, pendingEffectiveAt });

    await test.step('API reports the lowered effective cap', async () => {
      const { seats } = await fetchTeam(apiRequestUtils, team.id);
      expect(seats).toMatchObject({ purchased: 4, pending: 3, effective: 3, used: 3, reserved: 0, available: 0, isOverAllocated: false });
      expect(seats.pendingEffectiveAt).not.toBeNull();
    });

    await test.step('Dashboard shows the pending decrease', async () => {
      await teamDashboardPage.goToTeamDashboardPage();
      await expect(teamDashboardPage.teamSeatsCard).toBeVisible();
      await expect(teamDashboardPage.seatsPendingNotice).toBeVisible();
      await expect(teamDashboardPage.seatsPendingNotice).toContainText('3');
      await expect(teamDashboardPage.seatsPendingNotice).toContainText(dateTextPattern(pendingEffectiveAt));
    });

    await test.step('Member invitation is rejected against the pending count', async () => {
      const response = await inviteMember(apiRequestUtils, team.id, memberEmail, 'MEMBER');
      const body = await expectNoSeatsError(response, 'ADD');
      expect(body.data?.seats?.effective).toBe(3);
    });

    await test.step('Billing invitation is still allowed', async () => {
      const response = await inviteMember(apiRequestUtils, team.id, billingEmail, 'BILLING');
      expect(response.ok()).toBeTruthy();
    });

    await page.close();
  });

  test('Over-allocated teams are surfaced and adds are blocked, but nobody is deactivated', async ({
    page,
    apiRequestUtils,
    authenticationPage,
    teamDashboardPage,
    teamCreationUtils3Users: teamCreationUtils,
  }) => {
    const { team } = teamCreationUtils;
    const memberEmail = authenticationPage.generateTestEmail();
    teamCreationUtils.userEmails.push(memberEmail);

    // 3 billable members on 2 purchased seats, as a backfill or a landed decrease can produce
    await teamCreationUtils.setSeats({ purchased: 2 });

    await test.step('API reports negative availability', async () => {
      const { seats, members } = await fetchTeam(apiRequestUtils, team.id);
      expect(seats).toMatchObject({ purchased: 2, used: 3, reserved: 0, available: -1, isOverAllocated: true, isUnlimited: false });
      expect(members.filter(({ status }) => status === 'ACTIVE')).toHaveLength(4);
    });

    await test.step('Dashboard shows the over-allocation banner', async () => {
      await teamDashboardPage.goToTeamDashboardPage();
      await teamDashboardPage.expectSeatSummary({ purchased: 2, used: 3, available: -1 });
      await expect(teamDashboardPage.seatsBanner).toBeVisible();
      await expect(teamDashboardPage.addTeamMemberButton).toBeVisible();
    });

    await test.step('Adding a billable member is rejected', async () => {
      const response = await inviteMember(apiRequestUtils, team.id, memberEmail, 'MEMBER');
      const body = await expectNoSeatsError(response, 'ADD');
      expect(body.data?.seats?.available).toBe(-1);
    });

    await page.close();
  });

  test('Accepting an invitation is blocked when the cap was lowered after it was sent', async ({
    browser,
    page,
    apiRequestUtils,
    teamCreationUtils1User: teamCreationUtils,
  }) => {
    const { team } = teamCreationUtils;

    // Admin uses 1 seat, so 2 purchased leaves one for the invitation
    await teamCreationUtils.setSeats({ purchased: 2 });

    const invitee = await test.step('Register the invitee', () => registerInvitee(browser, teamCreationUtils));

    const invitation = await test.step('Invite while a seat is available', async () => {
      const response = await inviteMember(apiRequestUtils, team.id, invitee.user.email, 'MEMBER');
      expect(response.ok()).toBeTruthy();
      const { seats } = await fetchTeam(apiRequestUtils, team.id);
      expect(seats).toMatchObject({ purchased: 2, used: 1, reserved: 1, available: 0 });
      return prisma.teamMemberInvitation.findFirstOrThrow({ where: { teamId: team.id, email: invitee.user.email } });
    });

    await test.step('Lower the cap below the invitation', async () => {
      await teamCreationUtils.setSeats({ purchased: 1 });
    });

    await test.step('Accept is rejected with NO_SEATS and the invitation is left intact', async () => {
      const inviteeApi = new ApiRequestUtils(invitee.page, invitee.user.email);
      const response = await inviteeApi.makeRequestRaw('POST', `/api/teams/${team.id}/invitations/${invitation.token}/accept`);
      await expectNoSeatsError(response, 'ACCEPT_INVITATION');

      expect(
        await prisma.teamMember.findFirst({ where: { teamId: team.id, userId: { not: teamCreationUtils.adminUser.userId } } }),
      ).toBeNull();
      expect(await prisma.teamMemberInvitation.findUnique({ where: { id: invitation.id } })).not.toBeNull();
    });

    await test.step('The blocked attempt is audited', async () => {
      await waitForAuditLog(team.id, 'TEAM_MEMBER_ADD_BLOCKED_NO_SEATS');
      const auditLog = await prisma.auditLog.findFirstOrThrow({
        where: { teamId: team.id, action: 'TEAM_MEMBER_ADD_BLOCKED_NO_SEATS' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog.metadata).toMatchObject({ code: 'NO_SEATS' });
    });

    await invitee.context.close();
    await page.close();
  });

  test('Expired invitations do not reserve a seat', async ({
    page,
    apiRequestUtils,
    authenticationPage,
    teamDashboardPage,
    teamCreationUtils1User: teamCreationUtils,
  }) => {
    const { team } = teamCreationUtils;
    const expiredEmail = authenticationPage.generateTestEmail();
    const memberEmail = authenticationPage.generateTestEmail();
    teamCreationUtils.userEmails.push(expiredEmail, memberEmail);

    await teamCreationUtils.setSeats({ purchased: 2 });
    await teamCreationUtils.createExpiredInvitation({ email: expiredEmail, role: 'MEMBER' });

    await test.step('The expired invitation is not counted as reserved', async () => {
      const { seats } = await fetchTeam(apiRequestUtils, team.id);
      expect(seats).toMatchObject({ purchased: 2, used: 1, reserved: 0, available: 1 });
    });

    await test.step('The free seat can be used by a new invitation', async () => {
      const response = await inviteMember(apiRequestUtils, team.id, memberEmail, 'MEMBER');
      expect(response.ok()).toBeTruthy();
      const { seats } = await fetchTeam(apiRequestUtils, team.id);
      expect(seats).toMatchObject({ purchased: 2, used: 1, reserved: 1, available: 0 });
    });

    await test.step('Dashboard agrees', async () => {
      await teamDashboardPage.goToTeamDashboardPage();
      await teamDashboardPage.expectSeatSummary({ purchased: 2, used: 1, available: 0 });
    });

    await page.close();
  });

  test('Manual billing teams show an agreement-based limit and cannot manage seats', async ({
    browser,
    page,
    apiRequestUtils,
    authenticationPage,
    teamDashboardPage,
    environment,
  }) => {
    // The shared fixtures cannot take billing options, so the team is created here with the same cleanup
    const teamCreationUtils = new TeamCreationUtils();
    try {
      await teamCreationUtils.createTestTeamAndUsers({
        browser,
        page,
        billing: { manualBilling: true, licenseCountLimit: BILLABLE_MEMBERS_IN_3_USER_FIXTURE },
      });
      const { team } = teamCreationUtils;
      const memberEmail = authenticationPage.generateTestEmail();
      const billingEmail = authenticationPage.generateTestEmail();
      teamCreationUtils.userEmails.push(memberEmail, billingEmail);

      await test.step('API reports the hand-set cap', async () => {
        const { seats, billingAccount } = await fetchTeam(apiRequestUtils, team.id);
        expect(billingAccount?.manualBilling).toBe(true);
        expect(seats).toMatchObject({ purchased: 3, used: 3, available: 0, isUnlimited: false });
      });

      await test.step('Dashboard shows the agreement copy and no Manage Seats button', async () => {
        await teamDashboardPage.goToTeamDashboardPage();
        await expect(teamDashboardPage.teamSeatsCard).toBeVisible();
        await expect(teamDashboardPage.teamSeatsCard).toContainText('Your seat limit is set by your billing agreement.');
        await expect(teamDashboardPage.manageSeatsButton).toHaveCount(0);
        await expect(teamDashboardPage.teamMemberTableContainer).toContainText('All 3 seats are in use');
        await expect(teamDashboardPage.teamMemberTableContainer).toContainText('set by your agreement');
      });

      await test.step('The cap is still enforced', async () => {
        await expectNoSeatsError(await inviteMember(apiRequestUtils, team.id, memberEmail, 'MEMBER'), 'ADD');
        expect((await inviteMember(apiRequestUtils, team.id, billingEmail, 'BILLING')).ok()).toBeTruthy();
      });
    } finally {
      if (environment.PLAYWRIGHT_KEEP_DATA) {
        teamCreationUtils.debug();
      } else {
        await teamCreationUtils.cleanup();
      }
    }

    await page.close();
  });

  test('Manage Seats previews and commits changes through the seat endpoints', async ({
    page,
    apiRequestUtils,
    teamDashboardPage,
    teamCreationUtils3Users: teamCreationUtils,
  }) => {
    const { team } = teamCreationUtils;

    await teamCreationUtils.setSeats({ purchased: BILLABLE_MEMBERS_IN_3_USER_FIXTURE });
    await teamDashboardPage.goToTeamDashboardPage();
    await teamDashboardPage.expectSeatSummary({ purchased: 3, used: 3, available: 0 });

    // Stripe is not available in E2E: the two seat endpoints are mocked and the requests they receive are captured
    let previewFixture: TeamSeatChangePreview;
    let updateFixture: TeamSeatUpdateResponse;
    const previewRequests: unknown[] = [];
    const updateRequests: Array<{ seats: number; expectedCurrentSeats: number; prorationDate?: number | null }> = [];

    await page.route('**/api/teams/*/seats/preview', async (route) => {
      previewRequests.push(route.request().postDataJSON());
      await fulfillJson(route, previewFixture);
    });
    await page.route('**/api/teams/*/seats', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.fallback();
        return;
      }
      updateRequests.push(route.request().postDataJSON());
      await fulfillJson(route, updateFixture);
    });

    await test.step('Increase: preview shows the amount due today and confirm sends the previewed proration date', async () => {
      const currentTeam = await fetchTeam(apiRequestUtils, team.id);
      const prorationDate = Math.floor(Date.now() / 1000);
      previewFixture = {
        changeType: 'INCREASE',
        currentSeats: 3,
        requestedSeats: 5,
        minimumSeats: 3,
        amountDueNow: 20,
        prorationDate,
        nextInvoice: { amount: 50, date: futureDateAtNoonUtc(30).toISOString() },
        interval: 'MONTH',
        effectiveAt: new Date().toISOString(),
        replacesPendingDecrease: null,
        hasDiscount: false,
      };
      updateFixture = {
        team: teamWithSeats(currentTeam, { purchased: 5 }),
        result: {
          changeType: 'INCREASE',
          seats: 5,
          effectiveAt: previewFixture.effectiveAt,
          invoice: { id: 'in_test_increase', status: 'paid', amountDue: 20, hostedInvoiceUrl: null },
        },
      };

      await teamDashboardPage.openManageSeats();
      await teamDashboardPage.setSeatCount(5);
      await teamDashboardPage.previewSeatChange();

      expect(previewRequests).toEqual([{ seats: 5 }]);
      await expect(teamDashboardPage.seatPreview).toContainText('Due today');
      await expect(teamDashboardPage.seatPreview).toContainText('$20');
      await expect(teamDashboardPage.seatPreview).toContainText('$50');

      await teamDashboardPage.confirmSeatChange();

      expect(updateRequests).toEqual([{ seats: 5, expectedCurrentSeats: 3, prorationDate }]);
      await teamDashboardPage.expectSeatSummary({ purchased: 5, used: 3, available: 2 });
      await expect(teamDashboardPage.seatsBanner).toBeHidden();
    });

    await test.step('Decrease: preview shows no charge and the effective date, confirm schedules the decrease', async () => {
      previewRequests.length = 0;
      updateRequests.length = 0;
      // Persist the increase so a reload of the real team matches what the card shows
      await teamCreationUtils.setSeats({ purchased: 5 });
      await page.reload();
      await teamDashboardPage.expectSeatSummary({ purchased: 5, used: 3, available: 2 });

      const currentTeam = await fetchTeam(apiRequestUtils, team.id);
      const effectiveAt = futureDateAtNoonUtc(30);
      previewFixture = {
        changeType: 'DECREASE',
        currentSeats: 5,
        requestedSeats: 4,
        minimumSeats: 3,
        amountDueNow: 0,
        prorationDate: null,
        nextInvoice: { amount: 40, date: effectiveAt.toISOString() },
        interval: 'MONTH',
        effectiveAt: effectiveAt.toISOString(),
        replacesPendingDecrease: null,
        hasDiscount: false,
      };
      updateFixture = {
        team: teamWithSeats(currentTeam, { purchased: 5, pending: 4, pendingEffectiveAt: effectiveAt.toISOString() }),
        result: { changeType: 'DECREASE', seats: 4, effectiveAt: effectiveAt.toISOString(), invoice: null },
      };

      await teamDashboardPage.openManageSeats();
      await teamDashboardPage.setSeatCount(4);
      await teamDashboardPage.previewSeatChange();

      expect(previewRequests).toEqual([{ seats: 4 }]);
      await expect(teamDashboardPage.seatPreview).toContainText('No charge');
      await expect(teamDashboardPage.seatPreview).toContainText(dateTextPattern(effectiveAt));

      await teamDashboardPage.confirmSeatChange();

      expect(updateRequests).toHaveLength(1);
      expect(updateRequests[0]).toMatchObject({ seats: 4, expectedCurrentSeats: 5 });
      expect(updateRequests[0].prorationDate ?? null).toBeNull();

      await expect(teamDashboardPage.seatsPendingNotice).toBeVisible();
      await expect(teamDashboardPage.seatsPendingNotice).toContainText('4');
      await expect(teamDashboardPage.seatsPendingNotice).toContainText(dateTextPattern(effectiveAt));
    });

    await page.unroute('**/api/teams/*/seats/preview');
    await page.unroute('**/api/teams/*/seats');
    await page.close();
  });
});

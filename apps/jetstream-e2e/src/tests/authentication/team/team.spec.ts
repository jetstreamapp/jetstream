import { prisma } from '@jetstream/api-config';
import { delay, groupByFlat } from '@jetstream/shared/utils';
import { AuthenticationPage, TeamDashboardPage } from '@jetstream/test/e2e-utils';
import { Page } from '@playwright/test';
import { expect, test } from '../../../fixtures/fixtures';

const baseUrl = process.env.NX_PUBLIC_SERVER_URL || process.env.JETSTREAM_SERVER_URL || 'http://localhost:3333';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

function getEmailLink({ baseUrl, email, teamId, token }: { baseUrl: string; email: string; teamId: string; token: string }) {
  const url = new URL(`${baseUrl}/redirect`);
  url.searchParams.set('action', 'team-invite');
  url.searchParams.set('email', email);
  url.searchParams.set('teamId', teamId);
  url.searchParams.set('token', token);
  url.searchParams.set('redirectUrl', `/app/teams/invite?teamId=${teamId}&token=${token}`);
  return url.toString();
}

async function enrollInTotp(page: Page) {
  const { decodeBase32IgnorePadding } = await import('@oslojs/encoding');
  const { generateTOTP } = await import('@oslojs/otp');

  await page.getByRole('button', { name: 'Set Up' }).click();
  const secret = await page.getByTestId('totp-secret').innerText();
  await page.getByTestId('settings-page').getByRole('textbox').click();
  const code = await generateTOTP(decodeBase32IgnorePadding(secret), 30, 6);
  await page.getByTestId('settings-page').getByRole('textbox').fill(code);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Authenticator App Active' }).locator('span')).toBeVisible();

  return secret;
}

test.describe('Team Dashboard', () => {
  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('Team dashboard access', async ({ teamDashboardPage, teamCreationUtils3Users: teamCreationUtils, page }) => {
    const { adminUser, team } = teamCreationUtils;
    const [member1, member2, billingMember1] = teamCreationUtils.members;

    await test.step('Go to team dashboard', async () => {
      await teamDashboardPage.goToTeamDashboardPage();

      expect(page.getByRole('heading', { name: 'Team Dashboard' })).toBeTruthy();
    });

    await test.step('Verify team name and login configuration is visible', async () => {
      await expect(page.getByText(team.name)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Login Configuration' })).toBeVisible();
    });

    await test.step('Verify User Header Actions', async () => {
      await expect(teamDashboardPage.viewAuthActivityButton).toBeVisible();
      await expect(teamDashboardPage.viewUserSessionsButton).toBeVisible();
      await expect(teamDashboardPage.addTeamMemberButton).toBeVisible();
    });

    await test.step('Verify team members', async () => {
      const row = page.getByTestId(`team-member-row-${adminUser.teamMembership.user.email}`);
      await expect(row.getByText(adminUser.teamMembership.user.name)).toBeVisible();
      await expect(row.getByText(adminUser.teamMembership.user.email, { exact: true })).toBeVisible();
      await expect(row.getByTestId('user-row-actions')).toHaveCount(0); // Actions for current user are not available
      await expect(row.getByText('Username/Password')).toBeVisible();
      await expect(row.getByText('Admin')).toBeVisible();
      await expect(row.getByText('Active')).toBeVisible();

      const row1 = page.getByTestId(`team-member-row-${member1.teamMembership.user.email}`);
      await expect(row1.getByText(member1.teamMembership.user.name)).toBeVisible();
      await expect(row1.getByText(member1.teamMembership.user.email, { exact: true })).toBeVisible();
      await expect(row1.getByTestId('user-row-actions')).toBeVisible();
      await expect(row1.getByText('Username/Password')).toBeVisible();
      await expect(row1.getByText('Member')).toBeVisible();
      await expect(row1.getByText('Active')).toBeVisible();

      const row2 = page.getByTestId(`team-member-row-${member2.teamMembership.user.email}`);
      await expect(row2.getByText(member2.teamMembership.user.name)).toBeVisible();
      await expect(row2.getByText(member2.teamMembership.user.email, { exact: true })).toBeVisible();
      await expect(row2.getByTestId('user-row-actions')).toBeVisible();
      await expect(row2.getByText('Username/Password')).toBeVisible();
      await expect(row2.getByText('Member')).toBeVisible();
      await expect(row2.getByText('Active')).toBeVisible();

      const row3 = page.getByTestId(`team-member-row-${billingMember1.teamMembership.user.email}`);
      await expect(row3.getByText(billingMember1.teamMembership.user.name)).toBeVisible();
      await expect(row3.getByText(billingMember1.teamMembership.user.email, { exact: true })).toBeVisible();
      await expect(row3.getByTestId('user-row-actions')).toBeVisible();
      await expect(row3.getByText('Username/Password')).toBeVisible();
      await expect(row3.getByText('Billing')).toBeVisible();
      await expect(row3.getByText('Active')).toBeVisible();
    });

    await test.step('Verify login configuration', async () => {
      await expect(page.getByText(team.name)).toBeVisible();
      await expect(teamDashboardPage.loginConfigRequireMfaCheckbox).toBeChecked({ checked: true });
      await expect(teamDashboardPage.loginConfigAllowIdentityLinkingCheckbox).toBeChecked({ checked: false });
      await expect(teamDashboardPage.loginConfigAuthenticatorAppCheckbox).toBeChecked({ checked: true });
      await expect(teamDashboardPage.loginConfigEmailCheckbox).toBeChecked({ checked: true });
      await expect(teamDashboardPage.loginConfigUsernamePasswordCheckbox).toBeChecked({ checked: true });
      await expect(teamDashboardPage.loginConfigGoogleCheckbox).toBeChecked({ checked: true });
      await expect(teamDashboardPage.loginConfigSalesforceCheckbox).toBeChecked({ checked: true });
    });

    await test.step('Verify Auth Activity', async () => {
      // TODO:
    });

    const initialUserSessionCount = await test.step('Verify current user session count', async () => {
      const { userSessionModal, viewUserSessionsButton } = teamDashboardPage;
      await viewUserSessionsButton.click();
      await expect(userSessionModal.getByRole('heading', { name: 'User Sessions' })).toBeVisible();
      const tableRows = userSessionModal.locator('.slds-table > tbody > tr');
      await expect(tableRows.last()).toBeVisible();
      const count = await tableRows.count();
      await userSessionModal.getByRole('button', { name: 'Close' }).click();
      return count;
    });

    const { member1Page, member2Page, billingMember1Page } =
      await test.step('Ensure members are logged in with existing session', async () => {
        // Make sure member is logged in
        const member1Page = await member1.context.newPage();
        await member1Page.goto('/app/home');
        expect(member1Page.url()).toContain('/app/home');

        const member2Page = await member2.context.newPage();
        await member2Page.goto('/app/home');
        expect(member2Page.url()).toContain('/app/home');
        await member2Page.waitForURL('**/app/home');

        const billingMember1Page = await billingMember1.context.newPage();
        await billingMember1Page.goto('/app/home');
        expect(billingMember1Page.url()).toContain('/app/home');

        return { member1Page, member2Page, billingMember1Page };
      });

    await test.step('Verify standard user cannot access team page', async () => {
      const page = member1Page;
      await page.goto('/app/teams');
      // gets redirected back to home since user is not admin/billing user
      await page.waitForURL('**/app/home');
    });

    await test.step('Verify billing user has limited access', async () => {
      const page = billingMember1Page;
      await page.goto('/app/home');

      await expect(page.getByRole('heading', { name: 'Manage Profile' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Manage Billing' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Manage Team' })).toBeVisible();

      await page.getByRole('link', { name: 'Team Dashboard' }).click();
      await expect(page.getByRole('heading', { name: 'Team Dashboard' })).toBeVisible();

      await expect(teamDashboardPage.viewAuthActivityButton).toBeVisible();
      await expect(teamDashboardPage.viewUserSessionsButton).toBeVisible();
      await expect(teamDashboardPage.addTeamMemberButton).toBeVisible();

      const row = page.getByTestId(`team-member-row-${adminUser.teamMembership.user.email}`);
      await expect(row.getByText(adminUser.teamMembership.user.email, { exact: true })).toBeVisible();
      await expect(row.getByTestId('user-row-actions')).toHaveCount(0); // Actions for admin user are not available

      const row1 = page.getByTestId(`team-member-row-${billingMember1.teamMembership.user.email}`);
      await expect(row1.getByText(billingMember1.teamMembership.user.email, { exact: true })).toBeVisible();
      await expect(row1.getByTestId('user-row-actions')).toHaveCount(0); // Actions for current user are not available

      const row2 = page.getByTestId(`team-member-row-${member1.teamMembership.user.email}`);
      await expect(row2.getByText(member1.teamMembership.user.email, { exact: true })).toBeVisible();
      await expect(row2.getByTestId('user-row-actions')).toBeVisible();

      const row3 = page.getByTestId(`team-member-row-${member2.teamMembership.user.email}`);
      await expect(row3.getByText(member2.teamMembership.user.email, { exact: true })).toBeVisible();
      await expect(row3.getByTestId('user-row-actions')).toBeVisible();
      return page;
    });

    await test.step('Confirm manual session revocation works for billing member', async () => {
      // Make sure member is logged in
      const member = billingMember1;

      const getByPageBannerPromise = expect(page.getByText('Session revoked successfully.')).toBeVisible();
      await teamDashboardPage.revokeUserSession(member.user.email);
      await getByPageBannerPromise;

      // make sure session gets revoked
      await billingMember1Page.reload();
      // ensure user is logged out since session is expired
      await expect(billingMember1Page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
      await billingMember1Page.close();
    });

    await test.step('Update login configuration', async () => {
      await expect(page.getByText(team.name)).toBeVisible();

      await teamDashboardPage.loginConfigRequireMfaCheckbox.check();
      await teamDashboardPage.loginConfigEmailCheckbox.uncheck();
      await teamDashboardPage.loginConfigAllowIdentityLinkingCheckbox.uncheck();
      await teamDashboardPage.loginConfigSaveButton.click();

      await page.reload();
      // ensure save persists
      await expect(teamDashboardPage.loginConfigRequireMfaCheckbox).toBeChecked({ checked: true });
      await expect(teamDashboardPage.loginConfigEmailCheckbox).toBeChecked({ checked: false });
      await expect(teamDashboardPage.loginConfigAllowIdentityLinkingCheckbox).toBeChecked({ checked: false });
    });

    await test.step('Verify invalid sessions were removed', async () => {
      const { userSessionModal, viewUserSessionsButton } = teamDashboardPage;
      await viewUserSessionsButton.click();
      await expect(userSessionModal.getByRole('heading', { name: 'User Sessions' })).toBeVisible();
      const tableRows = userSessionModal.locator('.slds-table > tbody > tr');
      await expect(tableRows.last()).toBeVisible();
      // TODO: would be better to have a better check here - to ensure specific sessions are removed
      expect(await tableRows.count()).toBeLessThan(initialUserSessionCount);
      await userSessionModal.getByRole('button', { name: 'Close' }).click();
    });

    await test.step('Ensure user1 was logged out and requires OTP enrollment on next login', async () => {
      const authenticationPage = new AuthenticationPage(member1Page);
      await member1Page.reload();
      expect(member1Page.url()).toContain('/auth/login');

      await authenticationPage.loginAndVerifyEmail(member1.user.email, member1.user.password, true, '**/auth/mfa-enroll/');
      await expect(member1Page.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();

      await authenticationPage.enrollInOtp(member1.user.email);

      await member1Page.close();
    });

    await test.step('Ensure user2 did not have their session revoked', async () => {
      await member2Page.reload();
      expect(member2Page.url()).toContain('/app');
    });

    await test.step('Set user 2 to inactive', async () => {
      const row = page.getByTestId(`team-member-row-${member2.teamMembership.user.email}`);
      await row.getByTestId('user-row-actions').click();
      await row.getByRole('menuitem', { name: 'Deactivate' }).click();

      const updateModal = page.getByTestId('team-member-status-update-modal');

      await expect(updateModal.getByText('Once deactivated, this user')).toBeVisible();
      await expect(updateModal.getByText(member2.teamMembership.user.name)).toBeVisible();
      await updateModal.getByRole('button', { name: 'Save' }).click();

      await expect(page.getByRole('heading', { name: 'Successfully deactivated' })).toBeVisible();
    });

    await test.step('Ensure user2 was logged out and is prevented from logging back in', async () => {
      await member2Page.reload();
      expect(member2Page.url()).toContain('/auth/login');
      const authenticationPage = new AuthenticationPage(member2Page);
      await authenticationPage.fillOutLoginForm(member2.user.email, member2.user.password);
      expect(member2Page.url()).toContain('/auth/login');
      await expect(member2Page.getByText('Your account is inactive.')).toBeVisible();
      await member2Page.close();
    });
  });

  test('Team invitations', async ({ authenticationPage, teamDashboardPage, teamCreationUtils1User: teamCreationUtils, page, browser }) => {
    const { adminUser, team } = teamCreationUtils;

    await test.step('Go to team dashboard', async () => {
      await teamDashboardPage.goToTeamDashboardPage();

      expect(page.getByRole('heading', { name: 'Team Dashboard' })).toBeTruthy();
    });

    // Register two new users that will be invited to join the team
    const [{ user: existingUser1, context: existingUser1Context }, { user: existingUser2, context: existingUser2Context }] =
      await test.step('Register in advance of sign up without OTP', async () => {
        return await Promise.all([
          browser.newContext({ storageState: { cookies: [], origins: [] } }).then((context) => {
            return context.newPage().then(async (page) => {
              const user = await new AuthenticationPage(page).signUpAndVerifyEmail();
              teamCreationUtils.users.push(user);

              await page.getByRole('button', { name: 'Avatar' }).click();
              await page.getByRole('menuitem', { name: 'Profile' }).click();
              await page.close();

              return { user, context };
            });
          }),
          browser.newContext({ storageState: { cookies: [], origins: [] } }).then((context) => {
            return context.newPage().then(async (page) => {
              const user = await new AuthenticationPage(page).signUpAndVerifyEmail();
              teamCreationUtils.users.push(user);
              await page.getByRole('button', { name: 'Avatar' }).click();
              await page.getByRole('menuitem', { name: 'Profile' }).click();

              const secret = await enrollInTotp(page);
              await page.close();

              return { user, context, secret };
            });
          }),
        ]);
      });

    // User can accept an invitation
    // User can sign up and is redirected to invitation team
    // User must be enrolled in MFA and have valid providers (validate error messages)
    // ideally also confirm that server has same validation if using API directly

    const { user1Email, user2Email, teamInvites, users } = await test.step('Invite new team member', async () => {
      const user1Email = authenticationPage.generateTestEmail();
      const user2Email = authenticationPage.generateTestEmail();
      const users = [user1Email, user2Email, existingUser1.email, existingUser2.email];
      teamCreationUtils.userEmails.push(user1Email, user2Email);

      // Verify invites shows up in list
      await teamDashboardPage.inviteTeamMember(user1Email);
      let row = teamDashboardPage.teamInviteTable.getByTestId(`team-member-row-invite-${user1Email}`);
      await expect(row.getByText(user1Email)).toBeVisible();
      await expect(row.getByText('Pending')).toBeVisible();

      await teamDashboardPage.inviteTeamMember(user2Email);
      row = teamDashboardPage.teamInviteTable.getByTestId(`team-member-row-invite-${user2Email}`);
      await expect(row.getByText(user2Email)).toBeVisible();
      await expect(row.getByText('Pending')).toBeVisible();

      await teamDashboardPage.inviteTeamMember(existingUser1.email);
      row = teamDashboardPage.teamInviteTable.getByTestId(`team-member-row-invite-${existingUser1.email}`);
      await expect(row.getByText(existingUser1.email)).toBeVisible();
      await expect(row.getByText('Pending')).toBeVisible();

      await teamDashboardPage.inviteTeamMember(existingUser2.email);
      row = teamDashboardPage.teamInviteTable.getByTestId(`team-member-row-invite-${existingUser2.email}`);
      await expect(row.getByText(existingUser2.email)).toBeVisible();
      await expect(row.getByText('Pending')).toBeVisible();

      // verify email invitations were sent
      const emailCount = await prisma.emailActivity.count({
        where: { email: { in: users }, subject: { contains: `You're Invited to Join a Team on Jetstream` } },
      });
      expect(emailCount).toBe(users.length);

      const teamInvites = await prisma.teamMemberInvitation
        .findMany({
          select: { id: true, email: true, role: true, token: true },
          where: { email: { in: users }, teamId: team.id },
        })
        .then((results) => groupByFlat(results, 'email'));

      return { user1Email, user2Email, teamInvites, users };
    });

    const { user: user1, context: user1Context } = await test.step('Accept invite during registration without OTP required', async () => {
      // Verify user is auto-added to team when they sign up via invite link
      return await browser.newContext({ storageState: { cookies: [], origins: [] } }).then((context) => {
        return context.newPage().then(async (page) => {
          const link = getEmailLink({
            baseUrl,
            email: user1Email,
            teamId: teamCreationUtils.team.id,
            token: teamInvites[user1Email].token,
          });

          const user = await new AuthenticationPage(page).signUpAndVerifyEmail(user1Email, link);
          teamCreationUtils.users.push(user);
          await page.getByRole('button', { name: 'Avatar' }).click();
          await page.getByRole('menuitem', { name: 'Profile' }).click();
          await expect(page.getByText(team.name, { exact: true })).toBeVisible();
          await page.close();
          return { user, context, link };
        });
      });
    });

    await test.step('Require OTP MFA for Team Access', async () => {
      await expect(page.getByText(team.name)).toBeVisible();

      await teamDashboardPage.loginConfigRequireMfaCheckbox.check();
      await teamDashboardPage.loginConfigEmailCheckbox.uncheck();
      await teamDashboardPage.loginConfigAllowIdentityLinkingCheckbox.uncheck();
      await teamDashboardPage.loginConfigSaveButton.click();

      await page.reload();
    });

    await test.step('Accept invite during registration with OTP required', async () => {
      // Verify user is auto-added to team when they sign up via invite link
      return await browser.newContext({ storageState: { cookies: [], origins: [] } }).then((context) => {
        return context.newPage().then(async (page) => {
          const link = getEmailLink({
            baseUrl,
            email: user2Email,
            teamId: teamCreationUtils.team.id,
            token: teamInvites[user2Email].token,
          });

          const user = await new AuthenticationPage(page).signUpAndVerifyEmailAndEnrollInOtp(user2Email, link);
          teamCreationUtils.users.push(user);
          await page.getByRole('button', { name: 'Avatar' }).click();
          await page.getByRole('menuitem', { name: 'Profile' }).click();
          await expect(page.getByText(team.name, { exact: true })).toBeVisible();
          await page.close();
          return { user, context, link };
        });
      });
    });

    await test.step('Ensure existing members without OTP are logged out and forced to enroll in OTP', async () => {
      const page = await user1Context.newPage();
      await page.goto('/app/home');
      expect(page.url()).toContain('/auth/login');

      const authenticationPage = new AuthenticationPage(page);
      await authenticationPage.loginAndVerifyEmail(user1.email, user1.password, true, '**/auth/mfa-enroll/');
      await expect(page.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();

      await authenticationPage.enrollInOtp(user1.email);
      await page.close();
    });

    await test.step('Accept invite for existing user - not enrolled in OTP', async () => {
      // Verify user is auto-added to team when they sign up via invite link
      const page = await existingUser1Context.newPage();
      const link = getEmailLink({
        baseUrl,
        email: existingUser1.email,
        teamId: teamCreationUtils.team.id,
        token: teamInvites[existingUser1.email].token,
      });
      await page.goto(link);

      await expect(page.getByRole('button', { name: 'Accept Invitation' })).toBeDisabled();
      await expect(page.getByText('Before accepting this')).toBeVisible();

      const page2Promise = page.waitForEvent('popup');
      await page.getByRole('link', { name: 'Update your profile settings' }).click();
      const page2 = await page2Promise;
      await enrollInTotp(page2);
      await page2.close();

      await page.reload();
      await expect(page.getByRole('button', { name: 'Accept Invitation' })).toBeEnabled();
      await page.getByRole('button', { name: 'Accept Invitation' }).click();

      await page.getByRole('button', { name: 'Avatar' }).click();
      await page.getByRole('menuitem', { name: 'Profile' }).click();
      await expect(page.getByText(team.name, { exact: true })).toBeVisible();
      await page.close();
    });

    await test.step('Accept invite for existing user - already enrolled in OTP', async () => {
      // Verify user is auto-added to team when they sign up via invite link
      const page = await existingUser2Context.newPage();
      const link = getEmailLink({
        baseUrl,
        email: existingUser2.email,
        teamId: teamCreationUtils.team.id,
        token: teamInvites[existingUser2.email].token,
      });

      await page.goto(link);
      await expect(page.getByRole('button', { name: 'Accept Invitation' })).toBeEnabled();
      await page.getByRole('button', { name: 'Accept Invitation' }).click();

      await page.getByRole('button', { name: 'Avatar' }).click();
      await page.getByRole('menuitem', { name: 'Profile' }).click();
      await expect(page.getByText(team.name, { exact: true })).toBeVisible();
      await page.close();
    });

    await test.step('Verify all invited users are now team members', async () => {
      await teamDashboardPage.page.reload();

      for (const email of users) {
        const row = teamDashboardPage.teamMemberTable.getByTestId(`team-member-row-${email}`);
        await expect(row.getByText(email)).toBeVisible();
        await expect(row.getByText('Member')).toBeVisible();
        await expect(row.getByText('Active')).toBeVisible();
        await expect(row.getByText('Authenticator App')).toBeVisible();
        await expect(row.getByText('Username/Password')).toBeVisible();
      }
    });
  });

  test('OTP MFA enrollment is continued if user abandons process', async ({
    browser,
    page,
    authenticationPage,
    teamDashboardPage,
    teamCreationUtils1User: teamCreationUtils,
  }) => {
    const { team } = teamCreationUtils;

    await test.step('Go to team dashboard and require OTP-only MFA', async () => {
      await teamDashboardPage.goToTeamDashboardPage();
      await teamDashboardPage.loginConfigRequireMfaCheckbox.check();
      await teamDashboardPage.loginConfigEmailCheckbox.uncheck();
      await teamDashboardPage.loginConfigAllowIdentityLinkingCheckbox.uncheck();
      await teamDashboardPage.loginConfigSaveButton.click();
      await page.reload();
    });

    const { user, context: userContext } = await test.step('Invite user and sign up - pause at OTP enrollment', async () => {
      const userEmail = authenticationPage.generateTestEmail();
      teamCreationUtils.userEmails.push(userEmail);

      await teamDashboardPage.inviteTeamMember(userEmail);

      // Wait for invite row to appear in the table, confirming the record is saved to the DB
      const inviteRow = teamDashboardPage.teamInviteTable.getByTestId(`team-member-row-invite-${userEmail}`);
      await expect(inviteRow.getByText(userEmail)).toBeVisible();
      await expect(inviteRow.getByText('Pending')).toBeVisible();

      const teamInvite = await prisma.teamMemberInvitation.findFirstOrThrow({
        select: { token: true },
        where: { email: userEmail, teamId: team.id },
      });

      const link = getEmailLink({
        baseUrl,
        email: userEmail,
        teamId: team.id,
        token: teamInvite.token,
      });

      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const newPage = await context.newPage();
      const user = await new AuthenticationPage(newPage).signUpAndVerifyEmailPauseBeforeEnrollInOtp(userEmail, link);
      teamCreationUtils.users.push(user);

      expect(newPage.url()).toContain('/auth/mfa-enroll');
      await newPage.close();
      return { user, context };
    });

    await test.step('Navigating to app with abandoned enrollment redirects to enrollment page', async () => {
      const newPage = await userContext.newPage();
      await newPage.goto('/app');
      expect(newPage.url()).toContain('/auth/mfa-enroll/');
      await expect(newPage.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();
      await newPage.close();
    });

    await test.step('Logging in again still redirects to enrollment page', async () => {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const newPage = await context.newPage();
      const auth = new AuthenticationPage(newPage);
      await auth.fillOutLoginForm(user.email, user.password);
      await delay(1000); // ensure session is initialized
      await auth.verifyEmail(user.email, false, '**/auth/mfa-enroll/');
      await expect(newPage.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();
      await newPage.getByRole('link', { name: 'Logout' }).click();
      await context.close();
    });

    await test.step('Completing enrollment grants access to app', async () => {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const newPage = await context.newPage();
      const auth = new AuthenticationPage(newPage);
      await auth.fillOutLoginForm(user.email, user.password);
      await delay(1000); // ensure session is initialized
      await auth.verifyEmail(user.email, false, '**/auth/mfa-enroll/');
      await expect(newPage.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();
      await auth.enrollInOtp(user.email);
      expect(newPage.url()).toContain('/app');
      await context.close();
    });
  });

  test('Allowed providers are enforced', async ({ browser, page, teamDashboardPage, teamCreationUtils3Users: teamCreationUtils }) => {
    const [member1] = teamCreationUtils.members;

    await test.step('Go to team dashboard', async () => {
      await teamDashboardPage.goToTeamDashboardPage();
      expect(page.getByRole('heading', { name: 'Team Dashboard' })).toBeTruthy();
    });

    await test.step('Disable username/password as an allowed login provider', async () => {
      await teamDashboardPage.loginConfigUsernamePasswordCheckbox.uncheck();
      await teamDashboardPage.loginConfigSaveButton.click();
      await page.reload();
      await expect(teamDashboardPage.loginConfigUsernamePasswordCheckbox).toBeChecked({ checked: false });
    });

    await test.step('Team member cannot log in with credentials after provider is disabled', async () => {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const memberPage = await context.newPage();
      const memberAuth = new AuthenticationPage(memberPage);
      await memberAuth.fillOutLoginForm(member1.user.email, member1.user.password);
      await expect(memberPage.getByText('method is not allowed')).toBeVisible();
      await context.close();
    });
  });

  test('Team dashboard - Access controls', async ({ authenticationPage, teamCreationUtils3Users: teamCreationUtils }) => {
    const { adminUser, team } = teamCreationUtils;
    const [member1, , billingMember1] = teamCreationUtils.members;

    const request = billingMember1.context.request;
    const page = await billingMember1.context.newPage();
    const teamDashboardPage = new TeamDashboardPage(page);

    await page.goto('/app/home');
    expect(page.url()).toContain('/app/home');

    await test.step('Go to team dashboard', async () => {
      await page.getByRole('menuitem', { name: 'Team Dashboard' }).click();
      expect(page.getByRole('heading', { name: 'Team Dashboard' })).toBeTruthy();
    });

    await test.step('Ensure billing user cannot choose admin role', async () => {
      await teamDashboardPage.addTeamMemberButton.click();
      await expect(teamDashboardPage.teamMemberInviteModal.getByRole('heading', { name: 'Invite Team Member' })).toBeVisible();

      // ensure admin is not an option for the billing user
      await page.getByPlaceholder('Select an Option').click();
      await expect(page.getByRole('option', { name: 'Billing' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'Member' })).toBeVisible();

      const options = await teamDashboardPage.teamMemberInviteModal.getByRole('option').all();
      expect(options.length).toBe(2);

      // close menu
      await page.getByPlaceholder('Select an Option').click();

      await teamDashboardPage.teamMemberInviteModal.getByRole('button', { name: 'Cancel' }).click();
    });

    await test.step('Ensure billing user cannot choose admin role', async () => {
      const userEmail = authenticationPage.generateTestEmail();
      const response = await request.post(`/api/teams/${team.id}/invitations`, {
        data: {
          email: userEmail,
          features: ['ALL'],
          role: 'ADMIN',
        },
      });
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(403);
    });

    await test.step('Ensure billing user cannot change ADMIN role to MEMBER', async () => {
      const response = await request.put(`/api/teams/${team.id}/members/${adminUser.userId}`, {
        data: { role: 'MEMBER' },
      });
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(403);
    });

    await test.step('Ensure billing user cannot change ADMIN role to BILLING', async () => {
      const response = await request.put(`/api/teams/${team.id}/members/${adminUser.userId}`, {
        data: { role: 'BILLING' },
      });
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(403);
    });

    await test.step('Ensure billing user cannot update ADMIN user', async () => {
      const response = await request.put(`/api/teams/${team.id}/members/${adminUser.userId}/status`, {
        data: {
          status: 'INACTIVE',
          role: 'ADMIN',
        },
      });
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(403);
    });

    await test.step('Ensure billing user cannot change MEMBER role to ADMIN', async () => {
      const response = await request.put(`/api/teams/${team.id}/members/${member1.userId}`, {
        data: { role: 'ADMIN' },
      });
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(403);
    });

    await test.step('Ensure billing user cannot change MEMBER role to ADMIN with status change', async () => {
      const response = await request.put(`/api/teams/${team.id}/members/${member1.userId}/status`, {
        data: {
          status: 'ACTIVE',
          role: 'ADMIN',
        },
      });
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(403);
    });

    await test.step('Ensure billing user cannot change MEMBER role to ADMIN while making INACTIVE', async () => {
      const response = await request.put(`/api/teams/${team.id}/members/${member1.userId}/status`, {
        data: {
          status: 'INACTIVE',
          role: 'ADMIN',
        },
      });
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(403);
    });
  });
});

import { ENV, logger, prisma } from '@jetstream/api-config';
import type { Request } from '@jetstream/api-types';
import { AuthenticatedUser, AuthenticatedUserSchema, LoginConfiguration, SsoProviderType, TwoFactorType } from '@jetstream/auth/types';
import { isPrismaError, PrismaUniqueConstraintError, toTypedPrismaError } from '@jetstream/prisma';
import { BILLABLE_ROLES, TEAM_BILLING_STATUS_PAST_DUE, TEAM_MEMBER_STATUS_ACTIVE, TeamMemberRole } from '@jetstream/types';
import { createUserActivity } from './auth-logging.db.service';
import { AuthenticatedUserSelect, discoverSsoByDomain, getLoginConfiguration } from './auth.db.service';
import { ProviderNotAllowed, SsoAutoProvisioningDisabled, SsoInvalidAction, SsoLicenseLimitExceeded } from './auth.errors';
import { initSession } from './auth.service';
import { SsoUserInfo } from './sso.types';

const MAX_NAME_LENGTH = 255;

/** Check if an error is a Prisma unique constraint violation (P2002). */
function isUniqueConstraintError(error: unknown): boolean {
  if (!isPrismaError(error)) return false;
  const typed = toTypedPrismaError(error as any);
  return typed instanceof PrismaUniqueConstraintError;
}

/** Trim and truncate a string field from an IdP assertion. */
function sanitizeNameField(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.trim().slice(0, MAX_NAME_LENGTH) || undefined;
}

/** Sanitize IdP-provided user info fields (trim + truncate). */
function sanitizeUserInfo(userInfo: SsoUserInfo): SsoUserInfo {
  return {
    ...userInfo,
    email: userInfo.email,
    userName: sanitizeNameField(userInfo.userName) || userInfo.userName,
    firstName: sanitizeNameField(userInfo.firstName),
    lastName: sanitizeNameField(userInfo.lastName),
  };
}

/**
 * Compute MFA verification requirements for SSO login based on team configuration.
 * Follows the same logic pattern as the non-SSO flow in auth.db.service.ts.
 */
function getSsoMfaRequirements(
  loginConfig: LoginConfiguration,
  user: AuthenticatedUser,
): {
  mfaEnrollmentRequired: false | { factor: '2fa-otp' };
  twoFactor: Array<{ enabled: boolean; type: TwoFactorType }>;
} {
  if (!loginConfig.ssoRequireMfa) {
    return { mfaEnrollmentRequired: false, twoFactor: [] };
  }

  let mfaEnrollmentRequired: false | { factor: '2fa-otp' } = false;

  // If email MFA is not allowed, user must have OTP enrolled — otherwise force enrollment
  if (!loginConfig.allowedMfaMethods.has('2fa-email')) {
    const isEnrolledInOtp = user.authFactors.find(({ enabled, type }) => enabled && type === '2fa-otp');
    if (!isEnrolledInOtp) {
      mfaEnrollmentRequired = { factor: '2fa-otp' };
    }
  }

  const twoFactor = user.authFactors
    .filter(({ enabled }) => enabled)
    .sort((a, b) => {
      const priority: Record<string, number> = { '2fa-otp': 1, '2fa-email': 2, email: 3 };
      return (priority[a.type] || 4) - (priority[b.type] || 4);
    });

  // If MFA is required but user has no factors and doesn't need enrollment, default to email
  if (!mfaEnrollmentRequired && twoFactor.length === 0) {
    twoFactor.push({ enabled: true, type: '2fa-email' });
  }

  return { mfaEnrollmentRequired, twoFactor };
}

/**
 * Check that the team has not exceeded its license limit before JIT provisioning a new member.
 *
 * PAST_DUE always blocks provisioning.
 * License count is only checked when the user has no invitation, because an invitation
 * already occupies a slot in the count and converting it to a membership is a no-op for billing.
 */
async function checkJitLicenseAvailability(teamId: string, hasInvitation: boolean): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      billingStatus: true,
      billingAccount: { select: { licenseCountLimit: true } },
    },
  });

  if (!team) {
    return;
  }

  if (team.billingStatus === TEAM_BILLING_STATUS_PAST_DUE) {
    throw new SsoLicenseLimitExceeded(
      'Your account cannot be provisioned because the team account is past-due. Please contact your administrator.',
    );
  }

  if (!hasInvitation && team.billingAccount?.licenseCountLimit != null) {
    const existingBillableMemberCount = await prisma.teamMember.count({
      where: { teamId, status: TEAM_MEMBER_STATUS_ACTIVE, role: { in: Array.from(BILLABLE_ROLES) } },
    });
    const existingBillableInvitationCount = await prisma.teamMemberInvitation.count({
      where: { teamId, role: { in: Array.from(BILLABLE_ROLES) } },
    });

    if (existingBillableMemberCount + existingBillableInvitationCount >= team.billingAccount.licenseCountLimit) {
      throw new SsoLicenseLimitExceeded(
        'Your account cannot be provisioned because the team has reached its maximum user count. Please contact your administrator.',
      );
    }
  }
}

/**
 * Handle SSO login flow for both SAML and OIDC
 *
 * Security model:
 * 1. User must authenticate via their IdP (SAML/OIDC)
 * 2. Email from SSO assertion is used to identify/create user
 * 3. User is added to team if:
 *    - JIT provisioning is enabled, OR
 *    - User has a valid invitation
 * 4. For existing users with different emails - they must link manually (not via SSO)
 *
 * Flow:
 * 1. Validate SSO is enabled for team and provider matches
 * 2. Check if user exists by email (from SSO assertion)
 * 3. If user doesn't exist:
 *    - Check if JIT provisioning enabled OR invitation exists
 *    - Create new user
 * 4. If user exists but not in team:
 *    - Check if JIT provisioning enabled OR invitation exists
 *    - Add to team
 * 5. Verify user's team membership is active
 * 6. Link SSO identity to user
 * 7. Create session
 */
export async function handleSsoLogin(
  provider: SsoProviderType,
  teamId: string,
  userInfo: SsoUserInfo,
  req: Request,
): Promise<AuthenticatedUser> {
  userInfo = sanitizeUserInfo(userInfo);
  const email = userInfo.email.toLowerCase();

  // Validate SSO is enabled for this team
  const loginConfig = await getLoginConfiguration({ teamId });

  if (!loginConfig) {
    throw new ProviderNotAllowed('Team login configuration not found');
  }

  if (!loginConfig.ssoEnabled || loginConfig.ssoProvider === 'NONE') {
    throw new ProviderNotAllowed('SSO is not enabled for this team');
  }

  // Validate email domain if configured and matches the one in the response
  // This ensures only users from allowed domains can login via SSO
  const domains = new Set(loginConfig.domains || []);
  if (!domains.has(userInfo.email.split('@')[1].toLowerCase())) {
    throw new ProviderNotAllowed('Invalid email domain for this team');
  }

  // Validate provider matches configuration
  const expectedProvider = loginConfig.ssoProvider.toLowerCase();
  if (expectedProvider !== provider) {
    throw new ProviderNotAllowed(`Expected ${expectedProvider} but received ${provider}`);
  }

  // Check for team invitation (used for both new users and existing users not in team)
  const invitation = await prisma.teamMemberInvitation.findFirst({
    where: {
      teamId,
      email,
      expiresAt: { gte: new Date() },
    },
  });

  // Find user by email
  // Note: This uses email from SSO assertion which is trusted (verified by IdP)
  const existingUser = await prisma.user
    .findFirst({
      where: { email },
      select: AuthenticatedUserSelect,
    })
    .then((user) => (user ? AuthenticatedUserSchema.parse(user) : null));

  // User doesn't exist - create new user via JIT provisioning or invitation
  // If a concurrent request already created the user (race condition), catch the
  // unique constraint violation and fall through to the existing-user flow.
  if (!existingUser) {
    if (!loginConfig.ssoJitProvisioningEnabled && !invitation) {
      throw new SsoAutoProvisioningDisabled('User not invited. JIT provisioning is disabled for this team.');
    }

    await checkJitLicenseAvailability(teamId, !!invitation);

    // Determine role and features for new user
    const role = invitation?.role || 'MEMBER';
    const features = invitation?.features || ['ALL'];

    try {
      // Create new user with team membership in single transaction
      const newUser = await prisma.user
        .create({
          data: {
            email,
            userId: `${provider}|${email}`,
            name: [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || email,
            emailVerified: true,
            lastLoggedIn: new Date(),
            preferences: { create: { skipFrontdoorLogin: false } },
            entitlements: { create: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false } },
            identities: {
              create: {
                type: 'sso',
                provider,
                providerAccountId: email,
                email,
                emailVerified: true,
                username: userInfo.userName,
                name: [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || email,
                givenName: userInfo.firstName,
                familyName: userInfo.lastName,
                isPrimary: true,
                // Only one of these will be set based on provider
                samlConfigurationId: loginConfig.samlConfiguration?.id,
                oidcConfigurationId: loginConfig.oidcConfiguration?.id,
              },
            },
            authFactors: {
              create: {
                type: '2fa-email',
                enabled: ENV.JETSTREAM_AUTH_2FA_EMAIL_DEFAULT_VALUE,
              },
            },
            teamMembership: {
              create: {
                teamId,
                role,
                features,
                status: TEAM_MEMBER_STATUS_ACTIVE,
              },
            },
          },
          select: AuthenticatedUserSelect,
        })
        .then((user) => AuthenticatedUserSchema.parse(user));

      // Delete invitation if it exists
      if (invitation) {
        await prisma.teamMemberInvitation
          .delete({
            where: { id: invitation.id },
          })
          .catch(() => {
            // Ignore if already deleted
          });
      }

      logger.info({ userId: newUser.id, teamId, provider, email }, 'New user created via SSO JIT provisioning');
      createUserActivity({
        action: 'SSO_JIT_PROVISIONED',
        method: provider.toUpperCase(),
        userId: newUser.id,
        email,
        teamId,
        success: true,
      });

      // Initialize session for new user
      // Note: Provider is stored as-is in session for SSO (saml/oidc)
      const newUserMfa = getSsoMfaRequirements(loginConfig, newUser);
      await initSession(req, {
        user: newUser,
        isNewUser: true,
        provider,
        providerType: 'sso',
        teamInviteResponse: null,
        mfaEnrollmentRequired: newUserMfa.mfaEnrollmentRequired,
        verificationRequired: {
          email: false,
          twoFactor: newUserMfa.twoFactor,
        },
      });

      return newUser;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      // A concurrent request created the user first — re-fetch and continue to existing-user flow
      logger.info({ teamId, provider, email }, 'SSO user creation race condition detected, retrying as existing user');
    }
  }

  // Re-fetch the user (either was already found above, or was just created by a concurrent request)
  const user =
    existingUser ||
    (await prisma.user
      .findFirst({
        where: { email },
        select: AuthenticatedUserSelect,
      })
      .then((u) => (u ? AuthenticatedUserSchema.parse(u) : null)));

  if (!user) {
    // Should not happen, but guard against it
    throw new SsoInvalidAction('Unable to find or create user');
  }

  // User exists - check team membership
  if (!user.teamMembership) {
    // IdP-sourced role is intentionally not trusted — JIT users always default to MEMBER
    const role = invitation?.role || 'MEMBER';
    const features = invitation?.features || ['ALL'];
    const allowJit = loginConfig?.ssoJitProvisioningEnabled;

    if (!invitation && !allowJit) {
      throw new SsoAutoProvisioningDisabled('User is not a member of this team and no invitation was found.');
    }

    await checkJitLicenseAvailability(teamId, !!invitation);

    try {
      await prisma.teamMember.create({
        data: {
          teamId,
          userId: user.id,
          role,
          features,
          status: TEAM_MEMBER_STATUS_ACTIVE,
          createdById: user.id,
          updatedById: user.id,
        },
      });

      // Delete invitation if it exists
      if (invitation) {
        await prisma.teamMemberInvitation.delete({ where: { id: invitation.id } }).catch(() => {
          // Ignore if already deleted
        });
      }
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      // A concurrent request already added this user to the team — continue
      logger.info({ userId: user.id, teamId, provider, email }, 'SSO team member creation race condition detected, continuing');
    }

    // Reload user to get team membership
    const reloadedUser = await prisma.user
      .findFirstOrThrow({
        select: AuthenticatedUserSelect,
        where: { id: user.id },
      })
      .then((u) => AuthenticatedUserSchema.parse(u));

    // Link SSO identity if not already linked
    await linkSsoIdentity(reloadedUser.id, provider, email, userInfo);

    logger.info({ userId: reloadedUser.id, teamId, provider, email }, 'Existing user added to team via SSO');

    // Update last login and initialize session
    await prisma.user.update({
      where: { id: reloadedUser.id },
      data: { lastLoggedIn: new Date() },
    });

    const addedUserMfa = getSsoMfaRequirements(loginConfig, reloadedUser);
    await initSession(req, {
      user: reloadedUser,
      isNewUser: false,
      provider,
      providerType: 'sso',
      teamInviteResponse: null,
      mfaEnrollmentRequired: addedUserMfa.mfaEnrollmentRequired,
      verificationRequired: {
        email: false,
        twoFactor: addedUserMfa.twoFactor,
      },
    });

    return reloadedUser;
  }

  // User has team membership - validate it
  if (user.teamMembership.teamId !== teamId) {
    throw new SsoInvalidAction('User already belongs to a different team');
  }

  if (user.teamMembership.status !== TEAM_MEMBER_STATUS_ACTIVE) {
    throw new SsoInvalidAction('User team membership is inactive');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || email,
      lastLoggedIn: new Date(),
      identities: {
        upsert: {
          create: {
            type: 'sso',
            provider,
            providerAccountId: email,
            email,
            emailVerified: true,
            username: email,
            name: [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || email,
            givenName: userInfo.firstName,
            familyName: userInfo.lastName,
            isPrimary: true,
            samlConfigurationId: loginConfig.samlConfiguration?.id,
            oidcConfigurationId: loginConfig.oidcConfiguration?.id,
          },
          update: {
            email,
            name: [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || email,
            username: userInfo.userName,
          },
          where: { provider_providerAccountId: { provider, providerAccountId: email } },
        },
      },
    },
  });

  // Initialize session
  const returningUserMfa = getSsoMfaRequirements(loginConfig, user);
  await initSession(req, {
    user,
    isNewUser: false,
    provider,
    providerType: 'sso',
    teamInviteResponse: null,
    mfaEnrollmentRequired: returningUserMfa.mfaEnrollmentRequired,
    verificationRequired: {
      email: false,
      twoFactor: returningUserMfa.twoFactor,
    },
  });

  logger.info({ userId: user.id, teamId, provider, email }, 'SSO login successful');

  return user;
}

/**
 * Link SSO identity to user if not already linked
 */
async function linkSsoIdentity(userId: string, provider: SsoProviderType, email: string, _userInfo: SsoUserInfo): Promise<void> {
  const userInfo = sanitizeUserInfo(_userInfo);
  const existingIdentity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: email,
      },
    },
  });

  if (!existingIdentity) {
    await prisma.authIdentity.create({
      data: {
        userId,
        provider: provider as any, // SSO providers stored as strings in DB
        providerAccountId: email,
        email,
        emailVerified: true,
        username: email,
        name: [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || email,
        givenName: userInfo.firstName,
        familyName: userInfo.lastName,
        type: 'sso',
        isPrimary: false,
      },
    });
  }
}

/**
 * Discover SSO configuration by email
 * Used on login page to determine if user should use SSO
 */
export async function discoverSsoConfigByDomain(domain: string): Promise<{
  teamId: string;
  ssoProvider: 'SAML' | 'OIDC';
  ssoEnabled: boolean;
  ssoBypassEnabled: boolean;
  ssoBypassEnabledRoles: TeamMemberRole[];
} | null> {
  const result = await discoverSsoByDomain(domain);

  if (!result) {
    return null;
  }

  return {
    teamId: result.teamId,
    ssoProvider: result.loginConfig.ssoProvider as 'SAML' | 'OIDC',
    ssoEnabled: result.loginConfig.ssoEnabled,
    ssoBypassEnabled: result.loginConfig.ssoBypassEnabled,
    ssoBypassEnabledRoles: result.loginConfig.ssoBypassEnabledRoles,
  };
}

import { ENV, logger, prisma } from '@jetstream/api-config';
import type { Request } from '@jetstream/api-types';
import { AuthenticatedUser, AuthenticatedUserSchema, LoginConfiguration, SsoProviderType, TwoFactorType } from '@jetstream/auth/types';
import { isPrismaError, PrismaUniqueConstraintError, toTypedPrismaError } from '@jetstream/prisma';
import { BILLABLE_ROLES, TEAM_BILLING_STATUS_PAST_DUE, TEAM_MEMBER_STATUS_ACTIVE, TeamMemberRole } from '@jetstream/types';
import { createUserActivity } from './auth-logging.db.service';
import { AuthenticatedUserSelect, discoverSsoByDomain, getLoginConfiguration } from './auth.db.service';
import {
  ProviderNotAllowed,
  SsoAmbiguousAccount,
  SsoAutoProvisioningDisabled,
  SsoInvalidAction,
  SsoLicenseLimitExceeded,
} from './auth.errors';
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

  // Drop enabled factors whose MFA method is no longer allowed by the team config. Without this,
  // a stale 2fa-email factor (enabled before the admin removed email from allowedMfaMethods)
  // populates pendingVerification in initSession, and the SAML/OIDC callback redirects to
  // /auth/verify before ever checking pendingMfaEnrollment — letting the user satisfy MFA via
  // email code instead of enrolling in the required OTP.
  const twoFactor = user.authFactors
    .filter(({ enabled, type }) => {
      if (!enabled) {
        return false;
      }
      if (type === '2fa-otp' || type === '2fa-email') {
        return loginConfig.allowedMfaMethods.has(type);
      }
      return true;
    })
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
 * Look up a user via their AuthIdentity row. The lookup is scoped to the team's
 * SAML/OIDC config so we don't resolve to an identity row from a different config
 * that happens to share the same provider/providerAccountId. This scoping does not
 * itself prevent cross-tenant collisions — AuthIdentity uniqueness is still global
 * on (provider, providerAccountId), so conflicting rows surface as write failures
 * handled by the callers of this helper.
 */
async function findUserBySsoIdentity(params: {
  provider: SsoProviderType;
  providerAccountId: string;
  samlConfigurationId?: string | null;
  oidcConfigurationId?: string | null;
}): Promise<AuthenticatedUser | null> {
  const { provider, providerAccountId, samlConfigurationId, oidcConfigurationId } = params;
  // AuthIdentity rows set exactly one of these (SAML rows have samlConfigurationId, OIDC rows
  // have oidcConfigurationId). Callers must mirror that invariant — passing neither leaves the
  // lookup tenant-unscoped; passing both produces an AND filter no row can match.
  if (!!samlConfigurationId === !!oidcConfigurationId) {
    throw new SsoInvalidAction('SSO identity lookup requires exactly one of samlConfigurationId or oidcConfigurationId');
  }
  const identity = await prisma.authIdentity.findFirst({
    where: {
      provider,
      providerAccountId,
      ...(samlConfigurationId ? { samlConfigurationId } : {}),
      ...(oidcConfigurationId ? { oidcConfigurationId } : {}),
    },
    select: { user: { select: AuthenticatedUserSelect } },
  });
  return identity?.user ? AuthenticatedUserSchema.parse(identity.user) : null;
}

/**
 * Resolve the user for an incoming SSO login, preferring stable IdP subject over email.
 *
 * Lookup order:
 * 1. AuthIdentity keyed by IdP subject (NameID / sub) — the normal path once rows are migrated.
 * 2. AuthIdentity keyed by email — backward compat for rows created before subject-based keying.
 *    If hit and we have a different subject, migrate the identity (and any matching extension
 *    tokens) to the new key so subsequent logins take the fast path.
 * 3. User.findMany by email with a dupe guard — first-time SSO for a user whose account
 *    pre-existed. If multiple users share this email, we cannot safely pick one and throw.
 */
export async function resolveSsoUser(params: {
  provider: SsoProviderType;
  email: string;
  subject: string | undefined;
  teamId: string;
  samlConfigurationId?: string | null;
  oidcConfigurationId?: string | null;
}): Promise<AuthenticatedUser | null> {
  const { provider, email, subject, teamId, samlConfigurationId, oidcConfigurationId } = params;
  const configScope = { samlConfigurationId, oidcConfigurationId };

  if (subject) {
    const bySubject = await findUserBySsoIdentity({ provider, providerAccountId: subject, ...configScope });
    if (bySubject) {
      return bySubject;
    }
  }

  if (!subject || subject !== email) {
    const byLegacyEmail = await findUserBySsoIdentity({ provider, providerAccountId: email, ...configScope });
    if (byLegacyEmail) {
      if (subject && subject !== email) {
        try {
          await prisma.$transaction([
            prisma.authIdentity.update({
              where: { provider_providerAccountId: { provider, providerAccountId: email } },
              data: { providerAccountId: subject },
            }),
            prisma.webExtensionToken.updateMany({
              where: { userId: byLegacyEmail.id, provider, providerAccountId: email },
              data: { providerAccountId: subject },
            }),
          ]);
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            // Another row already owns (provider, subject). Silently returning byLegacyEmail
            // would let next login's subject-first lookup resolve to the wrong user. Surface
            // the collision so an admin can sort it out.
            logger.error(
              { err, userId: byLegacyEmail.id, provider, email, subject },
              'SSO identity migration blocked: another row already owns (provider, subject). Possible account collision.',
            );
            throw new SsoAmbiguousAccount(
              'Your SSO identity is in conflict with another account. Please contact your administrator for assistance.',
            );
          }
          // Returning byLegacyEmail after a failed migration would cause the downstream
          // upsert in handleSsoLogin to create a second subject-keyed row (the where-clause
          // would miss the still-email-keyed legacy row), leaving an orphan. Block the login
          // instead — a transient re-login is better than accumulating duplicate identity rows.
          logger.error(
            { err, userId: byLegacyEmail.id, provider, email, subject },
            'SSO identity migration failed: blocking login to avoid creating an orphan identity row',
          );
          throw new SsoInvalidAction('We could not complete your sign-in. Please try again in a moment.');
        }
      }
      return byLegacyEmail;
    }
  }

  const usersWithEmail = await prisma.user.findMany({ where: { email }, select: AuthenticatedUserSelect });
  if (usersWithEmail.length === 0) {
    return null;
  }
  if (usersWithEmail.length === 1) {
    return AuthenticatedUserSchema.parse(usersWithEmail[0]);
  }
  // Multiple users share this email globally — try to disambiguate by scoping to this team's
  // membership. Each user has at most one teamMembership, so a single match in this scope is safe.
  const teamMatches = usersWithEmail.filter((user) => user.teamMembership?.teamId === teamId);
  if (teamMatches.length === 1) {
    return AuthenticatedUserSchema.parse(teamMatches[0]);
  }
  logger.warn(
    { email, provider, teamId, matchCount: usersWithEmail.length, teamMatchCount: teamMatches.length },
    'SSO login blocked: multiple users share this email and no SSO identity exists to disambiguate',
  );
  throw new SsoAmbiguousAccount('Your account cannot be uniquely identified. Please contact your administrator for assistance.');
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
  const subject = userInfo.subject?.trim() || undefined;

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

  // Only the config matching the active provider should be stamped on AuthIdentity rows or passed
  // to lookups — findUserBySsoIdentity/linkSsoIdentity require exactly one to be set, and a team
  // may legitimately have both SAML and OIDC configurations stored even though only one is active.
  const configScope = {
    samlConfigurationId: provider === 'saml' ? loginConfig.samlConfiguration?.id : undefined,
    oidcConfigurationId: provider === 'oidc' ? loginConfig.oidcConfiguration?.id : undefined,
  };

  // Check for team invitation (used for both new users and existing users not in team)
  const invitation = await prisma.teamMemberInvitation.findFirst({
    where: {
      teamId,
      email,
      expiresAt: { gte: new Date() },
    },
  });

  // Resolve the user via AuthIdentity first (stable IdP subject), falling back to email
  // lookup with a duplicate-email guard. See resolveSsoUser for details.
  const existingUser = await resolveSsoUser({
    provider,
    email,
    subject,
    teamId,
    ...configScope,
  });

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
                providerAccountId: subject || email,
                email,
                emailVerified: true,
                username: userInfo.userName,
                name: [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || email,
                givenName: userInfo.firstName,
                familyName: userInfo.lastName,
                isPrimary: true,
                ...configScope,
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
        providerAccountId: subject || email,
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

  // Re-resolve the user (either already found above, or just created by a concurrent request)
  const user =
    existingUser ||
    (await resolveSsoUser({
      provider,
      email,
      subject,
      teamId,
      ...configScope,
    }));

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
    await linkSsoIdentity(reloadedUser.id, provider, email, userInfo, configScope);

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
      providerAccountId: subject || email,
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

  const providerAccountId = subject || email;

  // AuthIdentity's composite PK (provider, providerAccountId) is global. If another user already
  // owns this row (e.g. cross-tenant subject collision), the nested upsert below would route to
  // CREATE and blow up with a raw unique-constraint error. Surface it as SsoAmbiguousAccount
  // for a consistent UX with linkSsoIdentity.
  const existingIdentity = await prisma.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    select: { userId: true },
  });
  if (existingIdentity && existingIdentity.userId !== user.id) {
    logger.error(
      { existingUserId: existingIdentity.userId, currentUserId: user.id, provider, providerAccountId },
      'SSO login blocked: identity row already belongs to a different user',
    );
    throw new SsoAmbiguousAccount(
      'Your SSO identity is in conflict with another account. Please contact your administrator for assistance.',
    );
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
            providerAccountId,
            email,
            emailVerified: true,
            username: email,
            name: [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || email,
            givenName: userInfo.firstName,
            familyName: userInfo.lastName,
            isPrimary: true,
            ...configScope,
          },
          update: {
            email,
            name: [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || email,
            username: userInfo.userName,
            // Opportunistic backfill for rows created by paths that predated config-id tracking.
            ...configScope,
          },
          where: { provider_providerAccountId: { provider, providerAccountId } },
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
    providerAccountId,
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
 * Link SSO identity to user if not already linked. Keyed by IdP subject when available,
 * falling back to email for backward compat / IdPs that don't send a subject.
 */
export async function linkSsoIdentity(
  userId: string,
  provider: SsoProviderType,
  email: string,
  userInfoInput: SsoUserInfo,
  config: { samlConfigurationId?: string | null; oidcConfigurationId?: string | null },
): Promise<void> {
  // Mirror findUserBySsoIdentity's invariant: AuthIdentity rows set exactly one of these.
  // Refusing to write a row that doesn't conform prevents a future caller bug from silently
  // producing unscoped legacy-shaped rows.
  if (!!config.samlConfigurationId === !!config.oidcConfigurationId) {
    throw new SsoInvalidAction('SSO identity link requires exactly one of samlConfigurationId or oidcConfigurationId');
  }
  const userInfo = sanitizeUserInfo(userInfoInput);
  const providerAccountId = userInfo.subject?.trim() || email;

  const existingIdentity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId,
      },
    },
    select: { userId: true },
  });

  // AuthIdentity PK is (provider, providerAccountId) globally — a row may already exist
  // for a different user (e.g. cross-tenant NameID collision). Silently returning would leave
  // this user with no linked identity, and on next login the subject-first lookup could resolve
  // to the other account. Refuse to proceed.
  if (existingIdentity && existingIdentity.userId !== userId) {
    logger.error(
      { existingUserId: existingIdentity.userId, newUserId: userId, provider, providerAccountId },
      'SSO identity link blocked: row exists for a different user',
    );
    throw new SsoAmbiguousAccount(
      'Your SSO identity is in conflict with another account. Please contact your administrator for assistance.',
    );
  }

  if (!existingIdentity) {
    await prisma.authIdentity.create({
      data: {
        userId,
        provider: provider as any, // SSO providers stored as strings in DB
        providerAccountId,
        email,
        emailVerified: true,
        username: email,
        name: [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || email,
        givenName: userInfo.firstName,
        familyName: userInfo.lastName,
        type: 'sso',
        isPrimary: false,
        samlConfigurationId: config.samlConfigurationId,
        oidcConfigurationId: config.oidcConfigurationId,
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

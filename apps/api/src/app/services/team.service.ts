import { logger } from '@jetstream/api-config';
import * as authDbService from '@jetstream/auth/server';
import { OauthProviderType, UserProfileSession } from '@jetstream/auth/types';
import { sendTeamInviteEmail } from '@jetstream/email';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  LoginConfigurationIdentityDisplayNames,
  LoginConfigurationMdaDisplayNames,
  Maybe,
  TEAM_MEMBER_ROLE_ACCESS,
  TEAM_MEMBER_ROLE_MEMBER,
  TEAM_MEMBER_STATUS_ACTIVE,
  TEAM_MEMBER_STATUS_INACTIVE,
  TeamInvitationRequest,
  TeamInvitationUpdateRequest,
  TeamInviteUserFacing,
  TeamInviteVerificationResponse,
  TeamLoginConfigRequest,
  TeamLoginConfigSchema,
  TeamMemberRole,
  TeamMemberRoleSchema,
  TeamMemberStatusSchema,
  TeamMemberUpdateRequest,
  TeamStatus,
  TeamUserFacing,
} from '@jetstream/types';
import capitalize from 'lodash/capitalize';
import * as teamDbService from '../db/team.db';
import { NotAllowedError, UserFacingError } from '../utils/error-handler';
import * as stripeService from './stripe.service';

/**
 * Verifies that the running user has permission to update the target user based on role hierarchy.
 * @throws {NotAllowedError} If the running user doesn't have permission to modify the target user
 */
export async function canRunningUserUpdateTargetUserOrThrow({
  runningUserRole,
  userId,
}: {
  runningUserRole: TeamMemberRole;
  userId: string;
}): Promise<void> {
  const allowedRoles = (TEAM_MEMBER_ROLE_ACCESS[runningUserRole || TEAM_MEMBER_ROLE_MEMBER] || []) as TeamMemberRole[];
  if (allowedRoles.length === 0) {
    throw new NotAllowedError('Forbidden');
  }

  const canUpdate = await teamDbService.doesUserHaveSpecifiedRoles({ userId, roles: allowedRoles });
  if (!canUpdate) {
    throw new NotAllowedError('Forbidden');
  }
}

export async function getTeamByUserId({ userId }: { userId: string }): Promise<TeamUserFacing> {
  const team = await teamDbService.findByUserId({ userId });
  return team;
}

export async function createTeam({
  userId,
  userEmail,
  teamName,
  status,
}: {
  userId: string;
  userEmail: string;
  teamName?: string;
  status?: TeamStatus;
}): Promise<TeamUserFacing> {
  teamName = teamName || capitalize(userEmail.split('@')[1].split('.')[0]);

  return await teamDbService.createTeam({
    userId,
    loginConfiguration: TeamLoginConfigSchema.parse({}),
    name: teamName,
    status,
  });
}

export async function updateTeam({
  teamId,
  runningUserId,
  payload,
}: {
  teamId: string;
  runningUserId: string;
  payload: { name: string };
}): Promise<TeamUserFacing> {
  const team = await teamDbService.updateTeam({ runningUserId, teamId, payload });
  return team;
}

export async function updateLoginConfiguration({
  teamId,
  runningUserId,
  loginConfiguration,
}: {
  teamId: string;
  runningUserId: string;
  loginConfiguration: TeamLoginConfigRequest;
}): Promise<TeamUserFacing> {
  const team = await teamDbService.updateLoginConfiguration({ runningUserId, teamId, loginConfiguration });

  await teamDbService.revokeSessionThatViolateLoginConfiguration({ teamId, skipUserIds: [runningUserId] }).catch((ex) => {
    logger.error({ teamId, error: getErrorMessage(ex) }, 'Error revoking sessions that violate updated login configuration');
  });

  return team;
}

export async function updateTeamMember({
  runningUserId,
  teamId,
  userId,
  data,
}: {
  teamId: string;
  runningUserId: string;
  userId: string;
  data: TeamMemberUpdateRequest;
}): Promise<TeamUserFacing> {
  const { teamMember, isBillableAction } = await teamDbService.updateTeamMemberRole({ teamId, userId, data, runningUserId });

  const team = await teamDbService.findByUserId({ userId: runningUserId });

  // side-effect is not awaited, it will never throw
  if (isBillableAction) {
    syncUserCountWithStripe(teamId);
  }

  return team;
}

export async function updateTeamMemberStatusAndRole({
  runningUserId,
  teamId,
  userId,
  status,
  role,
}: {
  teamId: string;
  runningUserId: string;
  userId: string;
  status: typeof TEAM_MEMBER_STATUS_ACTIVE | typeof TEAM_MEMBER_STATUS_INACTIVE;
  role?: Maybe<TeamMemberRole>;
}): Promise<TeamUserFacing> {
  const { teamMember, isBillableAction } = await teamDbService.updateTeamMemberStatusAndRole({
    teamId,
    userId,
    status,
    role,
    runningUserId,
  });

  if (teamMember.status === TEAM_MEMBER_STATUS_INACTIVE) {
    await authDbService.revokeAllUserSessions(userId).catch((ex) => {
      logger.error({ userId, error: getErrorMessage(ex) }, 'Error revoking user sessions after deactivating team member');
    });
  }

  const team = await teamDbService.findByUserId({ userId: runningUserId });

  // side-effect is not awaited, it will never throw
  if (isBillableAction) {
    syncUserCountWithStripe(teamId);
  }

  return team;
}

export async function getTeamInvitations({ teamId }: { teamId: string }) {
  const invitations = await teamDbService.getTeamInvitations({ teamId });
  return invitations;
}

export async function createInvitation({
  runningUserId,
  teamId,
  request,
}: {
  runningUserId: string;
  teamId: string;
  request: TeamInvitationRequest;
}): Promise<TeamInviteUserFacing[]> {
  const { email, token, team } = await teamDbService.createTeamInvitation({
    runningUserId,
    teamId,
    request,
  });

  await sendTeamInviteEmail({
    emailAddress: email,
    teamId,
    teamName: team.name,
    token,
    expiresInDays: teamDbService.TEAM_INVITE_EXPIRES_DAYS,
  });

  const invitations = await teamDbService.getTeamInvitations({ teamId });
  return invitations;
}

export async function resendInvitation({
  runningUserId,
  teamId,
  invitationId,
  request,
}: {
  runningUserId: string;
  teamId: string;
  invitationId: string;
  request: TeamInvitationUpdateRequest;
}): Promise<TeamInviteUserFacing[]> {
  const { email, token, team } = await teamDbService.updateTeamInvitation({
    id: invitationId,
    teamId,
    request,
    runningUserId,
  });

  await sendTeamInviteEmail({
    emailAddress: email,
    teamId,
    teamName: team.name,
    token,
    expiresInDays: teamDbService.TEAM_INVITE_EXPIRES_DAYS,
  });

  const invitations = await teamDbService.getTeamInvitations({ teamId });
  return invitations;
}

export async function verifyTeamInvitation({
  user: userProfileSession,
  currentSessionProvider,
  teamId,
  token,
}: {
  user: UserProfileSession;
  currentSessionProvider: OauthProviderType | 'credentials';
  teamId: string;
  token: string;
}) {
  const invitation = await teamDbService.verifyTeamInvitation({ teamId, token, user: userProfileSession });
  const { user, team } = invitation;
  const { loginConfig } = team;

  const authFactors = new Set(user.authFactors.map((factor) => factor.type.replace('2fa-', '') as 'otp' | 'email'));
  const providers = new Set(user.identities.map((identity) => identity.provider as OauthProviderType | 'credentials'));

  if (user.hasPasswordSet) {
    providers.add('credentials');
  }

  const allowedProviders = new Set(loginConfig.allowedProviders);

  const teamInviteVerification: TeamInviteVerificationResponse = {
    teamName: team.name,
    canEnroll: true,
    session: {
      expireOnAcceptance: false,
      action: 'CURRENT_PROVIDER_INVALID',
      message: null as string | null,
    },
    mfa: {
      isValid: true,
      action: 'NONE',
      message: null as string | null,
      allowedMethods: loginConfig.allowedMfaMethods || [],
    },
    identityProvider: {
      isValid: true,
      action: 'NONE',
      message: null as string | null,
      allowedProviders: loginConfig.allowedProviders || [],
    },
    linkedIdentities: {
      isValid: true,
      action: 'NONE',
      message: null as string | null,
    },
  };

  if (loginConfig.requireMfa && authFactors.size === 0) {
    teamInviteVerification.canEnroll = false;
    teamInviteVerification.mfa.isValid = false;
    teamInviteVerification.mfa.action = 'ENROLL';
    teamInviteVerification.mfa.message = `Before accepting this invitation, you must setup a valid MFA method. This team allows the following MFA methods: ${loginConfig.allowedMfaMethods.map((method) => LoginConfigurationMdaDisplayNames[method]).join(', ')}.`;
  } else if (loginConfig.requireMfa && loginConfig.allowedMfaMethods.every((method) => !authFactors.has(method))) {
    teamInviteVerification.canEnroll = false;
    teamInviteVerification.mfa.isValid = true;
    teamInviteVerification.mfa.action = 'ENROLL';
    teamInviteVerification.mfa.message = `Before accepting this invitation, you must setup a valid MFA method. This team allows the following MFA methods: ${loginConfig.allowedMfaMethods.map((method) => LoginConfigurationMdaDisplayNames[method]).join(', ')}.`;
  }

  if (loginConfig.allowedProviders.every((provider) => !providers.has(provider))) {
    teamInviteVerification.canEnroll = false;
    teamInviteVerification.identityProvider.isValid = false;
    teamInviteVerification.identityProvider.action = 'LINK';
    teamInviteVerification.mfa.message = `You don't have a valid login method configured, one of the following is required to join this team: ${loginConfig.allowedProviders.map((provider) => LoginConfigurationIdentityDisplayNames[provider]).join(', ')}.`;
  } else if (!loginConfig.allowedProviders.includes(currentSessionProvider)) {
    teamInviteVerification.canEnroll = false;
    teamInviteVerification.session.expireOnAcceptance = true;
    teamInviteVerification.session.action = 'CURRENT_PROVIDER_INVALID';
    teamInviteVerification.session.message = `You must be signed in with a different login method to join this team. This team requires one of the following login methods: ${loginConfig.allowedProviders
      .map((provider) => LoginConfigurationIdentityDisplayNames[provider])
      .join(', ')}.`;
  }

  if (Array.from(providers).some((provider) => !allowedProviders.has(provider))) {
    teamInviteVerification.linkedIdentities.isValid = false;
    teamInviteVerification.session.message = `You have linked identities that are not allowed on this team. You do not need to take any action, but after joining, you will no longer be able to login using: ${loginConfig.allowedProviders
      .map((provider) => LoginConfigurationIdentityDisplayNames[provider])
      .join(', ')}.`;
  }

  return teamInviteVerification;
}

export async function revokeTeamInvitation({ id, teamId }: { id: string; teamId: string }) {
  await teamDbService.revokeTeamInvitation({ id, teamId });
  const invitations = await teamDbService.getTeamInvitations({ teamId });
  return invitations;
}

export async function acceptTeamInvitation({
  user,
  currentSessionProvider,
  teamId,
  token,
}: {
  user: UserProfileSession;
  currentSessionProvider: OauthProviderType | 'credentials';
  teamId: string;
  token: string;
}) {
  const { canEnroll } = await verifyTeamInvitation({ user, currentSessionProvider, teamId, token });
  if (!canEnroll) {
    throw new UserFacingError('Please review the enrollment requirements and try again.');
  }
  const { isBillableAction } = await teamDbService.acceptTeamInvitation({ teamId, token, user });

  // side-effect is not awaited, it will never throw
  if (isBillableAction) {
    syncUserCountWithStripe(teamId);
  }
}

export async function syncUserCountWithStripe(teamId: string): ReturnType<typeof stripeService.updateSubscriptionItemQuantity> {
  try {
    const team = await teamDbService.findByIdWithBillingInfo_UNSAFE({ teamId });

    if (!team) {
      logger.warn({ teamId }, 'Team not found when syncing user count with Stripe');
      return {
        success: false,
        didUpdate: false,
        error: 'Team not Found',
      };
    }

    if (!team.billingAccount) {
      logger.warn({ teamId }, 'Team does not have a billing account when syncing user count with Stripe');
      return {
        success: false,
        didUpdate: false,
        error: 'Team does not have a billing account',
      };
    }

    if (team.billingAccount.manualBilling) {
      logger.warn({ teamId }, 'Team is on manual billing and is not eligible for automatic quantity adjustment');
      return {
        success: false,
        didUpdate: false,
        error: 'Team is on manual billing and is not eligible for automatic quantity adjustment',
      };
    }

    const activeBillableMembers = team.members.filter(
      ({ role, status }) => status === TeamMemberStatusSchema.enum.ACTIVE && role !== TeamMemberRoleSchema.enum.BILLING,
    );

    const results = await stripeService.updateSubscriptionItemQuantity(team.billingAccount.customerId, activeBillableMembers.length);

    logger.info({ teamId, results }, 'Successfully synced user count with Stripe');

    return results;
  } catch (ex) {
    logger.error({ teamId, error: getErrorMessage(ex) }, 'Error syncing user count with Stripe');
    return {
      success: false,
      didUpdate: false,
      error: getErrorMessage(ex),
    };
  }
}

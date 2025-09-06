import { logger } from '@jetstream/api-config';
import * as authDbService from '@jetstream/auth/server';
import { UserProfileSession } from '@jetstream/auth/types';
import { sendTeamInviteEmail } from '@jetstream/email';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  TEAM_MEMBER_STATUS_ACTIVE,
  TEAM_MEMBER_STATUS_INACTIVE,
  TeamInvitationRequest,
  TeamInvitationUpdateRequest,
  TeamInviteUserFacing,
  TeamLoginConfigSchema,
  TeamMemberRoleSchema,
  TeamMemberStatusSchema,
  TeamMemberUpdateRequest,
  TeamStatus,
  TeamUserFacing,
} from '@jetstream/types';
import capitalize from 'lodash/capitalize';
import * as teamDbService from '../db/team.db';
import * as stripeService from './stripe.service';

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
  const { teamMember, isBillableAction } = await teamDbService.updateTeamMemberRole({ teamId, userId, data });

  const team = await teamDbService.findByUserId({ userId: runningUserId });

  // side-effect is not awaited, it will never throw
  if (isBillableAction) {
    syncUserCountWithStripe(teamId);
  }

  return team;
}

export async function updateTeamMemberStatus({
  runningUserId,
  teamId,
  userId,
  status,
}: {
  teamId: string;
  runningUserId: string;
  userId: string;
  status: typeof TEAM_MEMBER_STATUS_ACTIVE | typeof TEAM_MEMBER_STATUS_INACTIVE;
}): Promise<TeamUserFacing> {
  const { teamMember, isBillableAction } = await teamDbService.updateTeamMemberStatus({ teamId, userId, status });

  if (teamMember.status === TEAM_MEMBER_STATUS_INACTIVE) {
    authDbService.revokeAllUserSessions(userId);
  }

  const team = await teamDbService.findByUserId({ userId: runningUserId });

  // side-effect is not awaited, it will never throw
  if (isBillableAction) {
    syncUserCountWithStripe(teamId);
  }

  return team;
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
    createdByUserId: runningUserId,
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
  teamId,
  invitationId,
  request,
}: {
  teamId: string;
  invitationId: string;
  request: TeamInvitationUpdateRequest;
}): Promise<TeamInviteUserFacing[]> {
  const { email, token, team } = await teamDbService.updateTeamInvitation({
    id: invitationId,
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

export async function acceptTeamInvitation({ user, teamId, token }: { user: UserProfileSession; teamId: string; token: string }) {
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
      ({ role, status }) => status === TeamMemberStatusSchema.Values.ACTIVE && role !== TeamMemberRoleSchema.Enum.BILLING
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

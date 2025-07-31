import * as authDbService from '@jetstream/auth/server';
import { sendTeamInviteEmail } from '@jetstream/email';
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
  TeamInvitationRequest,
  TeamInvitationUpdateRequest,
  TeamInviteUserFacing,
  TeamUserFacing,
} from '@jetstream/types';
import * as teamDbService from '../db/team.db';

export async function updateTeamMemberStatus({
  runningUserId,
  teamId,
  userId,
  status,
}: {
  teamId: string;
  runningUserId: string;
  userId: string;
  status: typeof TEAM_STATUS_ACTIVE | typeof TEAM_STATUS_INACTIVE;
}): Promise<TeamUserFacing> {
  const teamMember = await teamDbService.updateTeamMemberStatus({ teamId, userId, status });

  if (teamMember.status === TEAM_STATUS_INACTIVE) {
    authDbService.revokeAllUserSessions(userId);
  }

  // if(teamMember.role !== TEAM_ROLE_BILLING) {
  //   // TODO: Update billing logic here if needed
  // }

  const team = await teamDbService.findByUserId({ userId: runningUserId });

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

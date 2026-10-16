import { AdminSessionUser, TeamMemberToAdd } from '@jetstream/admin/types';
import { getLogger, prisma } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createAuditLog } from '@jetstream/audit-logs';
import { revokeAllUserSessions } from '@jetstream/auth/server';
import { Prisma } from '@jetstream/prisma';
import { assertSeatAvailable, isBillableRole, withTeamSeatLock } from '@jetstream/team-seats';
import { TEAM_MEMBER_STATUS_ACTIVE, TeamMemberRole } from '@jetstream/types';
import { ConflictError, NotFoundError, RequestMetadata } from '../utils/route.utils';

export interface AddedTeamMember {
  userId: string;
  email: string;
  role: TeamMemberRole;
}

/**
 * Adds an existing user straight to a team, with no invitation or email. Applies the same rules as
 * accepting an invitation: one team per user and a free seat for billable roles. An invitation the
 * team has open for the user's email is removed first, so it stops reserving a seat.
 *
 * The caller's transaction must hold the team's seat lock, or have created the team itself.
 */
export async function addMemberInTransaction(
  tx: Prisma.TransactionClient,
  teamId: string,
  { userId, role }: TeamMemberToAdd,
): Promise<AddedTeamMember> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, teamMembership: { select: { teamId: true } } } });
  if (!user) {
    throw new NotFoundError(`User ${userId} not found`);
  }
  if (user.teamMembership) {
    throw new ConflictError(`${user.email} already belongs to a team. A user can belong to only one team.`);
  }

  await tx.teamMemberInvitation.deleteMany({ where: { teamId, email: { equals: user.email, mode: 'insensitive' } } });
  if (isBillableRole(role)) {
    await assertSeatAvailable(tx, { teamId, kind: 'ADD', role });
  }
  // TeamMember.userId is unique, so a user who joins another team concurrently fails here with a 409
  await tx.teamMember.create({ data: { teamId, userId, role, status: TEAM_MEMBER_STATUS_ACTIVE } });

  return { userId, email: user.email, role };
}

/**
 * Run after the membership commits. The user's sessions are revoked rather than patched with the new
 * membership: they were signed in under no team's login rules, and signing in again is what applies the
 * team's MFA and SSO requirements (a new team requires MFA by default).
 */
export async function recordMembersAdded(
  teamId: string,
  members: AddedTeamMember[],
  admin: AdminSessionUser,
  requestMetadata: RequestMetadata,
) {
  for (const { userId, email, role } of members) {
    await revokeAllUserSessions(userId).catch((ex) => {
      getLogger().error({ err: ex, userId, teamId }, '[ADMIN] Failed to revoke sessions after adding a team member');
    });

    await createAuditLog({
      action: AuditLogAction.ADMIN_TEAM_MEMBER_ADDED,
      resource: AuditLogResource.TEAM,
      resourceId: teamId,
      metadata: { adminEmail: admin.email, userId, email, role },
      ...requestMetadata,
    });
  }
}

export async function addTeamMember(
  teamId: string,
  member: TeamMemberToAdd,
  admin: AdminSessionUser,
  requestMetadata: RequestMetadata,
): Promise<AddedTeamMember> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) {
    throw new NotFoundError(`Team ${teamId} not found`);
  }

  const addedMember = await withTeamSeatLock(teamId, (tx) => addMemberInTransaction(tx, teamId, member));
  await recordMembersAdded(teamId, [addedMember], admin, requestMetadata);
  return addedMember;
}

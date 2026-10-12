import { AdminSessionUser, SendTeamInvitationRequest, TeamInvitationItem } from '@jetstream/admin/types';
import { prisma } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createAuditLog } from '@jetstream/audit-logs';
import { sendTeamInviteEmail } from '@jetstream/email';
import { assertSeatAvailable, withTeamSeatLock } from '@jetstream/team-seats';
import { BILLABLE_ROLES } from '@jetstream/types';
import { addDays } from 'date-fns';
import { ConflictError, NotFoundError, RequestMetadata } from '../utils/route.utils';

/** Must match TEAM_INVITE_EXPIRES_DAYS in the main API so emails and expiry agree */
const TEAM_INVITE_EXPIRES_DAYS = 14;

const INVITATION_SELECT = { id: true, email: true, role: true, token: true, expiresAt: true, lastSentAt: true, createdAt: true } as const;

function isBillableRole(role: string) {
  return (BILLABLE_ROLES as ReadonlySet<string>).has(role);
}

function toInvitationItem({
  id,
  email,
  role,
  expiresAt,
  lastSentAt,
  createdAt,
}: {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  lastSentAt: Date;
  createdAt: Date;
}): TeamInvitationItem {
  return {
    id,
    email,
    role,
    expiresAt: expiresAt.toISOString(),
    lastSentAt: lastSentAt.toISOString(),
    createdAt: createdAt.toISOString(),
  };
}

async function findTeamOrThrow(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } });
  if (!team) {
    throw new NotFoundError(`Team ${teamId} not found`);
  }
  return team;
}

async function sendInvitationEmail(team: { id: string; name: string }, invitation: { email: string; token: string }) {
  // sendTeamInviteEmail logs and swallows delivery failures, so a failed send is only visible in the logs
  await sendTeamInviteEmail({
    emailAddress: invitation.email,
    teamId: team.id,
    teamName: team.name,
    token: invitation.token,
    expiresInDays: TEAM_INVITE_EXPIRES_DAYS,
  });
}

/**
 * Creates an invitation and emails it. Only ever called from an explicit admin action, never as a
 * side effect of provisioning. Applies the same rules as the main API's createTeamInvitation:
 * one team per user, one open invitation per email, and a free seat for billable roles.
 */
export async function sendTeamInvitation(
  teamId: string,
  { email, role }: SendTeamInvitationRequest,
  admin: AdminSessionUser,
  requestMetadata: RequestMetadata,
): Promise<TeamInvitationItem> {
  const team = await findTeamOrThrow(teamId);

  const invitation = await withTeamSeatLock(teamId, async (tx) => {
    const existingMembershipCount = await tx.teamMember.count({ where: { user: { email: { equals: email, mode: 'insensitive' } } } });
    if (existingMembershipCount > 0) {
      throw new ConflictError(`${email} is already a member of a team. A user can belong to only one team.`);
    }

    const openInvitationCount = await tx.teamMemberInvitation.count({ where: { teamId, email, expiresAt: { gte: new Date() } } });
    if (openInvitationCount > 0) {
      throw new ConflictError(`An invitation for ${email} is already open. Resend or revoke it instead.`);
    }

    // An expired invitation for the same email would block the unique (teamId, email) constraint
    await tx.teamMemberInvitation.deleteMany({ where: { teamId, email } });

    if (isBillableRole(role)) {
      await assertSeatAvailable(tx, { teamId, kind: 'ADD', role });
    }

    const now = new Date();
    return tx.teamMemberInvitation.create({
      select: INVITATION_SELECT,
      data: { teamId, email, role, features: ['ALL'], expiresAt: addDays(now, TEAM_INVITE_EXPIRES_DAYS), lastSentAt: now },
    });
  });

  await sendInvitationEmail(team, invitation);

  await createAuditLog({
    action: AuditLogAction.ADMIN_TEAM_INVITATION_SENT,
    resource: AuditLogResource.TEAM,
    resourceId: teamId,
    metadata: { adminEmail: admin.email, invitationId: invitation.id, email, role },
    ...requestMetadata,
  });

  return toInvitationItem(invitation);
}

export async function resendTeamInvitation(
  teamId: string,
  invitationId: string,
  admin: AdminSessionUser,
  requestMetadata: RequestMetadata,
): Promise<TeamInvitationItem> {
  const team = await findTeamOrThrow(teamId);

  const invitation = await withTeamSeatLock(teamId, async (tx) => {
    const existingInvitation = await tx.teamMemberInvitation.findFirst({ where: { id: invitationId, teamId }, select: INVITATION_SELECT });
    if (!existingInvitation) {
      throw new NotFoundError(`Invitation ${invitationId} not found`);
    }

    const existingMembershipCount = await tx.teamMember.count({
      where: { user: { email: { equals: existingInvitation.email, mode: 'insensitive' } } },
    });
    if (existingMembershipCount > 0) {
      throw new ConflictError(`${existingInvitation.email} has joined a team since this was sent. Revoke the invitation instead.`);
    }

    // An open billable invitation already holds its seat; an expired one has to take a seat again
    const now = new Date();
    if (isBillableRole(existingInvitation.role) && existingInvitation.expiresAt < now) {
      await assertSeatAvailable(tx, { teamId, kind: 'ADD', role: existingInvitation.role });
    }

    return tx.teamMemberInvitation.update({
      where: { id: invitationId },
      select: INVITATION_SELECT,
      data: { expiresAt: addDays(now, TEAM_INVITE_EXPIRES_DAYS), lastSentAt: now },
    });
  });

  await sendInvitationEmail(team, invitation);

  await createAuditLog({
    action: AuditLogAction.ADMIN_TEAM_INVITATION_RESENT,
    resource: AuditLogResource.TEAM,
    resourceId: teamId,
    metadata: { adminEmail: admin.email, invitationId, email: invitation.email, role: invitation.role },
    ...requestMetadata,
  });

  return toInvitationItem(invitation);
}

export async function revokeTeamInvitation(
  teamId: string,
  invitationId: string,
  admin: AdminSessionUser,
  requestMetadata: RequestMetadata,
): Promise<{ id: string }> {
  const invitation = await prisma.teamMemberInvitation.findFirst({
    where: { id: invitationId, teamId },
    select: { email: true, role: true },
  });
  if (!invitation) {
    throw new NotFoundError(`Invitation ${invitationId} not found`);
  }

  await prisma.teamMemberInvitation.delete({ where: { id: invitationId } });

  await createAuditLog({
    action: AuditLogAction.ADMIN_TEAM_INVITATION_REVOKED,
    resource: AuditLogResource.TEAM,
    resourceId: teamId,
    metadata: { adminEmail: admin.email, invitationId, email: invitation.email, role: invitation.role },
    ...requestMetadata,
  });

  return { id: invitationId };
}

import { Prisma } from '@jetstream/prisma';
import { TEAM_MEMBER_STATUS_ACTIVE } from '@jetstream/types';
import { assertSeatAvailable, lockTeamForSeatChange } from './seat-enforcement';
import { isBillableRole } from './seat-math';

export interface AcceptedInvitation {
  id: string;
  role: string;
}

/**
 * Converts an invitation into an active membership. This is the single implementation for accepting
 * from the dashboard, accepting during signup or login, and SSO just-in-time provisioning, so the seat
 * check cannot be skipped by one of the paths.
 *
 * Callers pass the transaction client; the team row lock is re-taken here so the function is safe
 * whether or not the caller already holds it.
 */
export async function addMemberFromInvitation(
  tx: Prisma.TransactionClient,
  { teamId, userId, invitation }: { teamId: string; userId: string; invitation: AcceptedInvitation },
): Promise<{ role: string; status: string; accessProfileId: string | null }> {
  await lockTeamForSeatChange(tx, teamId);
  // The caller read the invitation before taking the lock. Re-read it here, expiry included, so one
  // revoked, re-roled or expired in the meantime cannot still grant its privileges or its seat: an
  // expired invitation stops reserving a seat, so accepting it would push the team past its cap.
  const { role, accessProfileId } = await tx.teamMemberInvitation.findFirstOrThrow({
    where: { id: invitation.id, teamId, expiresAt: { gte: new Date() } },
    select: { role: true, accessProfileId: true },
  });
  if (isBillableRole(role)) {
    await assertSeatAvailable(tx, { teamId, kind: 'ACCEPT_INVITATION', role });
  }
  await tx.teamMemberInvitation.delete({ where: { id: invitation.id } });
  // Role and access profile come from the locked re-read, so callers that report what was accepted
  // (the audit log) describe the membership that was actually created rather than their stale snapshot.
  return tx.teamMember.create({
    select: { role: true, status: true, accessProfileId: true },
    data: {
      teamId,
      userId,
      role,
      status: TEAM_MEMBER_STATUS_ACTIVE,
      accessProfileId,
      createdById: userId,
      updatedById: userId,
    },
  });
}

/**
 * The access profile applied to members who join without an invitation (domain auto-join and SSO JIT
 * provisioning) and to invitations created without an explicit profile. NULL means full access.
 */
export async function findDefaultAccessProfileId(tx: Prisma.TransactionClient, teamId: string): Promise<string | null> {
  const defaultProfile = await tx.teamAccessProfile.findFirst({
    select: { id: true },
    where: { teamId, isDefault: true },
    orderBy: { createdAt: 'asc' },
  });
  return defaultProfile?.id ?? null;
}

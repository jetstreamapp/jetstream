import { Prisma } from '@jetstream/prisma';
import { TEAM_MEMBER_STATUS_ACTIVE } from '@jetstream/types';
import { assertSeatAvailable, lockTeamForSeatChange } from './seat-enforcement';
import { isBillableRole } from './seat-math';

export interface AcceptedInvitation {
  id: string;
  role: string;
  features: Prisma.TeamMemberUncheckedCreateInput['features'];
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
): Promise<{ role: string; status: string }> {
  await lockTeamForSeatChange(tx, teamId);
  // The caller read the invitation before taking the lock. Re-read it here, expiry included, so one
  // revoked, re-roled or expired in the meantime cannot still grant its privileges or its seat: an
  // expired invitation stops reserving a seat, so accepting it would push the team past its cap.
  const { role, features } = await tx.teamMemberInvitation.findFirstOrThrow({
    where: { id: invitation.id, expiresAt: { gte: new Date() } },
    select: { role: true, features: true },
  });
  if (isBillableRole(role)) {
    await assertSeatAvailable(tx, { teamId, kind: 'ACCEPT_INVITATION' });
  }
  await tx.teamMemberInvitation.delete({ where: { id: invitation.id } });
  return tx.teamMember.create({
    select: { role: true, status: true },
    data: {
      teamId,
      userId,
      role,
      status: TEAM_MEMBER_STATUS_ACTIVE,
      features,
      createdById: userId,
      updatedById: userId,
    },
  });
}

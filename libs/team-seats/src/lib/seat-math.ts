import {
  BILLABLE_ROLES,
  MAX_TEAM_SEATS,
  TEAM_BILLING_STATUS_PAST_DUE,
  TEAM_MEMBER_STATUS_ACTIVE,
  TeamSeatCheckKind,
  TeamSeatSummary,
} from '@jetstream/types';

/**
 * Pure seat arithmetic shared by enforcement, the seat-change service and the team payload.
 * Nothing in here touches the database or Stripe.
 */

export interface SeatInputs {
  purchasedSeats: number | null;
  pendingSeats: number | null;
  pendingEffectiveAt: Date | string | null;
  usedSeats: number;
  reservedSeats: number;
}

export interface SeatTeamShape {
  billingAccount: {
    licenseCountLimit: number | null;
    pendingSeatQuantity?: number | null;
    pendingSeatEffectiveAt?: Date | string | null;
  } | null;
  members: { role: string; status: string }[];
  invitations: { role: string; expiresAt: Date | string }[];
}

export function isBillableRole(role: string): boolean {
  return BILLABLE_ROLES.has(role);
}

export function isSeatConsumingMember(member: { role: string; status: string }): boolean {
  return member.status === TEAM_MEMBER_STATUS_ACTIVE && isBillableRole(member.role);
}

/** Expired invitations never hold a seat; resending one re-reserves it. */
export function isSeatReservingInvitation(invitation: { role: string; expiresAt: Date | string }, now = new Date()): boolean {
  return isBillableRole(invitation.role) && new Date(invitation.expiresAt).getTime() >= now.getTime();
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function summarizeSeats({
  purchasedSeats,
  pendingSeats,
  pendingEffectiveAt,
  usedSeats,
  reservedSeats,
}: SeatInputs): TeamSeatSummary {
  const isUnlimited = purchasedSeats === null;
  let effective: number | null = purchasedSeats;
  if (purchasedSeats !== null && pendingSeats !== null) {
    effective = Math.min(purchasedSeats, pendingSeats);
  }
  const available = effective === null ? null : effective - usedSeats - reservedSeats;
  return {
    purchased: purchasedSeats,
    pending: pendingSeats,
    pendingEffectiveAt: pendingEffectiveAt ? toIsoString(pendingEffectiveAt) : null,
    effective,
    used: usedSeats,
    reserved: reservedSeats,
    available,
    isUnlimited,
    isOverAllocated: available !== null && available < 0,
  };
}

/** Builds the summary from an already-loaded team (members and invitations included). */
export function summarizeSeatsFromTeam(team: SeatTeamShape, now = new Date()): TeamSeatSummary {
  return summarizeSeats({
    purchasedSeats: team.billingAccount?.licenseCountLimit ?? null,
    pendingSeats: team.billingAccount?.pendingSeatQuantity ?? null,
    pendingEffectiveAt: team.billingAccount?.pendingSeatEffectiveAt ?? null,
    usedSeats: team.members.filter(isSeatConsumingMember).length,
    reservedSeats: team.invitations.filter((invitation) => isSeatReservingInvitation(invitation, now)).length,
  });
}

export type SeatCheckResult = { ok: true } | { ok: false; code: 'NO_SEATS' };

/**
 * ADD takes a brand-new seat, so pending invitations count against it. ACCEPT_INVITATION converts a
 * reservation into a member, so only active members matter: a late decrease should not strand an
 * invitee behind other people's outstanding invitations.
 */
export function evaluateSeatCheck(seats: TeamSeatSummary, kind: TeamSeatCheckKind): SeatCheckResult {
  if (seats.isUnlimited || seats.effective === null) {
    return { ok: true };
  }
  const remaining = kind === 'ACCEPT_INVITATION' ? seats.effective - seats.used : (seats.available ?? 0);
  return remaining >= 1 ? { ok: true } : { ok: false, code: 'NO_SEATS' };
}

export type SeatChangeRejection =
  | 'MANUAL_BILLING'
  | 'PAST_DUE'
  | 'MIN_SEATS'
  | 'MAX_SEATS'
  | 'BELOW_USAGE'
  | 'BELOW_INCLUDED'
  | 'NO_CHANGE';

export type SeatChangeValidation = { ok: true } | { ok: false; code: SeatChangeRejection; detail?: Record<string, number> };

export function validateRequestedSeatCount({
  requested,
  seats,
  billingStatus,
  manualBilling,
  includedSeats,
}: {
  requested: number;
  seats: TeamSeatSummary;
  billingStatus: string;
  manualBilling: boolean;
  includedSeats: number | null;
}): SeatChangeValidation {
  if (manualBilling) {
    return { ok: false, code: 'MANUAL_BILLING' };
  }
  if (billingStatus === TEAM_BILLING_STATUS_PAST_DUE) {
    return { ok: false, code: 'PAST_DUE' };
  }
  if (!Number.isInteger(requested) || requested < 1) {
    return { ok: false, code: 'MIN_SEATS', detail: { minimum: 1 } };
  }
  if (requested > MAX_TEAM_SEATS) {
    return { ok: false, code: 'MAX_SEATS', detail: { maximum: MAX_TEAM_SEATS } };
  }
  const usage = seats.used + seats.reserved;
  if (requested < usage) {
    return { ok: false, code: 'BELOW_USAGE', detail: { used: seats.used, reserved: seats.reserved } };
  }
  if (includedSeats !== null && requested < includedSeats) {
    return { ok: false, code: 'BELOW_INCLUDED', detail: { includedSeats } };
  }
  const currentTarget = seats.pending ?? seats.purchased;
  if (requested === currentTarget) {
    return { ok: false, code: 'NO_CHANGE' };
  }
  return { ok: true };
}

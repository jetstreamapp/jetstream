import { formatSeatDate, getOverAllocationMessage, hasPendingSeatDecrease } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { BILLABLE_ROLES, TeamMemberRole, TeamSeatSummary } from '@jetstream/types';

/** Seats that can still be handed out; Infinity when the team has no cap. */
export function getAvailableSeats(seats: TeamSeatSummary | null | undefined): number {
  if (!seats || seats.isUnlimited || seats.available === null) {
    return Infinity;
  }
  return seats.available;
}

/** Billing-only users never consume a seat. */
export function needsSeat(role: TeamMemberRole): boolean {
  return BILLABLE_ROLES.has(role);
}

export interface SeatBannerState {
  theme: 'warning' | 'light';
  message: string;
}

/** The dashboard-level notice: a warning when over-allocated, a light notice when every seat is taken, else nothing. */
export function getSeatBannerState(seats: TeamSeatSummary | null | undefined, hasManualBilling: boolean): SeatBannerState | null {
  if (!seats || seats.isUnlimited || seats.available === null || seats.effective === null) {
    return null;
  }

  const overAllocationMessage = getOverAllocationMessage(seats, hasManualBilling);
  if (overAllocationMessage) {
    return { theme: 'warning', message: overAllocationMessage };
  }

  if (seats.available === 0) {
    const remedy = hasManualBilling
      ? 'Your seat limit is set by your agreement. Contact support to increase it, or deactivate a member to add someone else.'
      : 'Buy more seats or deactivate a member to add more team members.';
    return {
      theme: 'light',
      message: `All ${seats.effective} ${pluralizeFromNumber('seat', seats.effective)} are in use or reserved for pending invitations. ${remedy}`,
    };
  }

  return null;
}

/** Footer line under the members table summarizing seat usage. */
export function getSeatFooterMessage(seats: TeamSeatSummary | null | undefined, hasManualBilling: boolean): string | null {
  if (!seats) {
    return null;
  }
  const agreementSuffix = hasManualBilling ? ' (set by your agreement)' : '';

  if (seats.isUnlimited || seats.effective === null || seats.available === null) {
    return hasManualBilling ? 'Unlimited seats (set by your agreement).' : null;
  }

  const total = seats.effective;
  const seatWord = pluralizeFromNumber('seat', total);
  if (seats.available > 0) {
    return `${seats.available} of ${total} ${seatWord} available${agreementSuffix}.`;
  }
  if (seats.available === 0) {
    return total === 1 ? `Your 1 seat is in use${agreementSuffix}.` : `All ${total} seats are in use${agreementSuffix}.`;
  }

  const overBy = -seats.available;
  const inUse = seats.used + seats.reserved;
  const reservedClause = seats.reserved > 0 ? `, including ${seats.reserved} reserved for pending invitations` : '';
  return `Using ${inUse} of ${total} ${seatWord}${agreementSuffix}${reservedClause} (${overBy} over).`;
}

/** Explains why a member cannot be added and what the admin can do about it. */
export function getSeatsUnavailableMessage(seats: TeamSeatSummary, hasManualBilling: boolean): string {
  const cap = seats.effective ?? seats.purchased ?? 0;
  const takenClause = cap === 1 ? 'is in use or reserved for a pending invitation' : 'are in use or reserved for pending invitations';
  const lead = hasPendingSeatDecrease(seats)
    ? `No seats available. Your seat count decreases to ${seats.pending} on ${formatSeatDate(seats.pendingEffectiveAt)}, and ${cap === 1 ? 'that seat' : `all ${cap} of those seats`} ${takenClause}.`
    : `No seats available. ${cap === 1 ? 'Your 1 purchased seat' : `All ${cap} purchased seats`} ${takenClause}.`;
  const remedy = hasManualBilling
    ? `Your seat limit of ${cap} is set by your agreement. Contact support to increase it, deactivate a member, or cancel a pending invitation.`
    : 'Buy more seats, deactivate a member, or cancel a pending invitation.';
  return `${lead} ${remedy} Billing-only users do not need a seat.`;
}

import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { BILLABLE_ROLES, TeamMemberRole, TeamSeatChangeType, TeamSeatSummary } from '@jetstream/types';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';

/** Seats that can still be handed out; Infinity when the team has no cap. */
export function getAvailableSeats(seats: TeamSeatSummary | null | undefined): number {
  if (!seats || seats.isUnlimited || seats.available === null) {
    return Infinity;
  }
  return seats.available;
}

export function formatSeatDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return '';
  }
  const date = parseISO(isoDate);
  return isValid(date) ? format(date, 'MMMM d, yyyy') : isoDate;
}

/** Billing-only users never consume a seat. */
export function needsSeat(role: TeamMemberRole): boolean {
  return BILLABLE_ROLES.has(role);
}

export function hasPendingSeatDecrease(seats: TeamSeatSummary | null | undefined): boolean {
  return !!seats && seats.pending !== null && seats.purchased !== null && seats.pending < seats.purchased;
}

/**
 * Mirrors the server's classification so the edit step can explain a change before previewing it.
 * A pending decrease is the count already in force, so requesting it again is not a change, while
 * requesting the purchased count cancels the decrease.
 */
export function getSeatChangeType(requestedSeats: number, seats: TeamSeatSummary): TeamSeatChangeType {
  const purchased = seats.purchased ?? 0;
  if (requestedSeats === (seats.pending ?? purchased)) {
    return 'NONE';
  }
  if (requestedSeats === purchased && hasPendingSeatDecrease(seats)) {
    return 'CANCEL_PENDING_DECREASE';
  }
  return requestedSeats > purchased ? 'INCREASE' : 'DECREASE';
}

function describeUsage(seats: TeamSeatSummary): string {
  const usage = `${seats.used} ${pluralizeFromNumber('seat', seats.used)}`;
  if (seats.reserved > 0) {
    return `${usage} and has ${seats.reserved} reserved for pending invitations`;
  }
  return usage;
}

/** Warning text when the team uses more seats than its cap allows, or null when it fits. */
export function getOverAllocationMessage(seats: TeamSeatSummary | null | undefined, hasManualBilling: boolean): string | null {
  if (!seats || seats.available === null || seats.available >= 0) {
    return null;
  }
  const overBy = -seats.available;
  const remedy = hasManualBilling
    ? 'Deactivate members or contact support to raise your seat limit to avoid interruption.'
    : `Buy ${overBy} more ${pluralizeFromNumber('seat', overBy)} or deactivate members to avoid interruption.`;

  if (hasPendingSeatDecrease(seats)) {
    return `Your seat count decreases to ${seats.pending} on ${formatSeatDate(seats.pendingEffectiveAt)}, but your team is using ${describeUsage(seats)}. ${remedy}`;
  }
  return `Your team is using ${describeUsage(seats)} but has purchased ${seats.purchased}. ${remedy}`;
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
  const lead = hasPendingSeatDecrease(seats)
    ? `No seats available. Your seat count decreases to ${seats.pending} on ${formatSeatDate(seats.pendingEffectiveAt)}, and all ${cap} of those seats are in use or reserved for pending invitations.`
    : `No seats available. All ${cap} purchased ${pluralizeFromNumber('seat', cap)} are in use or reserved for pending invitations.`;
  const remedy = hasManualBilling
    ? `Your seat limit of ${cap} is set by your agreement. Contact support to increase it, deactivate a member, or cancel a pending invitation.`
    : 'Buy more seats, deactivate a member, or cancel a pending invitation.';
  return `${lead} ${remedy} Billing-only users do not need a seat.`;
}

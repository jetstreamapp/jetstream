import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { Maybe, TeamSeatSummary } from '@jetstream/types';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Amounts arrive from the API already in dollars (stripe.service.ts converts from cents). */
export function formatUsd(amountInDollars: number): string {
  return usdFormatter.format(amountInDollars);
}

/**
 * Human label for a billing interval. Accepts the subscription-item form (`MONTH`/`YEAR`, as Stripe
 * names recurring intervals) and the price-list form (`MONTHLY`/`ANNUAL`) so both surfaces share one helper.
 */
export function getIntervalLabel(interval: Maybe<string>): string {
  switch (interval) {
    case 'MONTH':
    case 'MONTHLY':
      return 'month';
    case 'YEAR':
    case 'ANNUAL':
      return 'year';
    case 'WEEK':
      return 'week';
    case 'DAY':
      return 'day';
    default:
      return 'period';
  }
}

/**
 * Seat effective dates arrive as ISO strings from the API. `format` throws on an unparseable value, so
 * an unexpected payload falls back to the raw string rather than taking the surrounding page down.
 */
export function formatSeatDate(isoDate: Maybe<string>): string {
  if (!isoDate) {
    return '';
  }
  const date = parseISO(isoDate);
  return isValid(date) ? format(date, 'MMMM d, yyyy') : isoDate;
}

export function hasPendingSeatDecrease(seats: TeamSeatSummary | null | undefined): boolean {
  return !!seats && seats.pending !== null && seats.purchased !== null && seats.pending < seats.purchased;
}

export function getPendingSeatDecreaseMessage(seats: TeamSeatSummary): string {
  return `Your seat count will decrease from ${seats.purchased} to ${seats.pending} on ${formatSeatDate(seats.pendingEffectiveAt)}. Seats are not refunded for the current period.`;
}

function describeSeatUsage(seats: TeamSeatSummary): string {
  const usage = `${seats.used} ${pluralizeFromNumber('seat', seats.used)}`;
  if (seats.reserved > 0) {
    return `${usage} and has ${seats.reserved} reserved for pending invitations`;
  }
  return usage;
}

/**
 * Warning text when the team uses more seats than its cap allows, or null when it fits. Shared by the
 * billing page and the team dashboard so both describe the same state the same way.
 */
export function getOverAllocationMessage(seats: TeamSeatSummary | null | undefined, hasManualBilling: boolean): string | null {
  if (!seats || seats.available === null || seats.available >= 0) {
    return null;
  }
  const overBy = -seats.available;
  const remedy = hasManualBilling
    ? 'Deactivate members or contact support to raise your seat limit to avoid interruption.'
    : `Buy ${overBy} more ${pluralizeFromNumber('seat', overBy)} or deactivate members to avoid interruption.`;

  if (hasPendingSeatDecrease(seats)) {
    return `Your seat count decreases to ${seats.pending} on ${formatSeatDate(seats.pendingEffectiveAt)}, but your team is using ${describeSeatUsage(seats)}. ${remedy}`;
  }
  return `Your team is using ${describeSeatUsage(seats)} but has purchased ${seats.purchased}. ${remedy}`;
}

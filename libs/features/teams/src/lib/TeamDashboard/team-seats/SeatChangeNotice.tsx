import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { ScopedNotification } from '@jetstream/ui';
import { SeatGate, SeatGateEvaluation } from './seat-gate';
import { SeatsUnavailableNotice } from './SeatsUnavailableNotice';

export const SEATS_PAST_DUE_MESSAGE =
  'Your account is past due. New users cannot be added to a seat until billing is resolved. Resolve the past-due invoice on the billing page, then try again. Billing-only users do not need a seat.';

export interface SeatChangeNoticeProps {
  seatGate: SeatGate;
  evaluation: SeatGateEvaluation;
  /** Whether the target role takes a seat at all */
  requiresSeat: boolean;
  /** An invitation reserves a seat until it is accepted; a reactivation or promotion uses one right away */
  consumption: 'reserves' | 'uses';
  /** Set false when the non-billable case has its own explanation (the role modal's "frees a seat" note) */
  billingOnlyNote?: boolean;
}

/**
 * The seat explanation shown above the invite, status and role forms: why the change is blocked,
 * or what it will cost in seats when it is not.
 */
export function SeatChangeNotice({
  seatGate: { seats, hasManualBilling, canManageSeats, onBuySeats },
  evaluation: { availableSeats, blockedReason },
  requiresSeat,
  consumption,
  billingOnlyNote = true,
}: SeatChangeNoticeProps) {
  // Buying seats is refused while past due too, so this notice offers no "Buy more seats" way out
  if (blockedReason === 'PAST_DUE') {
    return (
      <div data-testid="seats-past-due-notice">
        <ScopedNotification theme="warning">
          <p>{SEATS_PAST_DUE_MESSAGE}</p>
        </ScopedNotification>
      </div>
    );
  }
  if (blockedReason === 'NO_SEATS' && seats) {
    return (
      <SeatsUnavailableNotice seats={seats} hasManualBilling={hasManualBilling} canManageSeats={canManageSeats} onBuySeats={onBuySeats} />
    );
  }
  if (requiresSeat && Number.isFinite(availableSeats)) {
    const availableClause = `1 of your ${availableSeats} available ${pluralizeFromNumber('seat', availableSeats)}`;
    return (
      <ScopedNotification theme="info">
        {consumption === 'reserves'
          ? `This invitation reserves ${availableClause} until it is accepted or cancelled. Your billing does not change.`
          : `This change uses ${availableClause}. Your billing does not change.`}
      </ScopedNotification>
    );
  }
  if (!requiresSeat && billingOnlyNote) {
    return <ScopedNotification theme="info">Billing-only users do not use a seat.</ScopedNotification>;
  }
  return null;
}

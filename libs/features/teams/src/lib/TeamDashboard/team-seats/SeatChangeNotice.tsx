import { ScopedNotification } from '@jetstream/ui';
import { SeatGate, SeatGateEvaluation } from './seat-gate';
import { SeatsUnavailableNotice } from './SeatsUnavailableNotice';

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
  seatGate: { seats, hasManualBilling, canManageSeats, isPastDue, onBuySeats },
  evaluation: { availableSeats, seatBlocked },
  requiresSeat,
  consumption,
  billingOnlyNote = true,
}: SeatChangeNoticeProps) {
  if (seatBlocked && seats) {
    return (
      <SeatsUnavailableNotice
        seats={seats}
        hasManualBilling={hasManualBilling}
        canManageSeats={canManageSeats}
        isPastDue={isPastDue}
        onBuySeats={onBuySeats}
      />
    );
  }
  if (requiresSeat && Number.isFinite(availableSeats)) {
    return (
      <ScopedNotification theme="info">
        {consumption === 'reserves'
          ? `This invitation reserves 1 of your ${availableSeats} available seats until it is accepted or cancelled. Your billing does not change.`
          : `This change uses 1 of your ${availableSeats} available seats. Your billing does not change.`}
      </ScopedNotification>
    );
  }
  if (!requiresSeat && billingOnlyNote) {
    return <ScopedNotification theme="info">Billing-only users do not use a seat.</ScopedNotification>;
  }
  return null;
}

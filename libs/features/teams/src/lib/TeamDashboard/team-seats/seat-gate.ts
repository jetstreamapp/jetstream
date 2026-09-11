import { TeamSeatLimitErrorCode, TeamSeatSummary } from '@jetstream/types';
import { getAvailableSeats } from './team-seats.utils';

/**
 * Everything a member modal needs to explain the team's seat situation and offer a way out of it.
 * Built once by the dashboard and handed to the invite, role and status modals as a single prop.
 */
export interface SeatGate {
  seats: TeamSeatSummary | null;
  hasManualBilling: boolean;
  canManageSeats: boolean;
  /** The server refuses every seat-consuming change while past due, and buying seats as well */
  isPastDue: boolean;
  /** Closes the current modal and opens Manage Seats */
  onBuySeats: () => void;
}

export interface SeatGateEvaluation {
  availableSeats: number;
  /** The change needs a seat the team cannot hand out, so the modal must not submit */
  seatBlocked: boolean;
  /** Why the change is blocked, using the server's seat-limit codes */
  blockedReason: TeamSeatLimitErrorCode | null;
}

/**
 * Whether a membership change can go ahead. `requiresSeat` is whether the target role is billable;
 * `takesSeatNow` is whether this particular change consumes one right away (reactivating an inactive
 * member does, re-roling an inactive member does not — that seat is checked on reactivation).
 * Past due is checked first, as the server does, since buying seats would not unblock it.
 */
export function evaluateSeatGate(
  { seats, isPastDue }: Pick<SeatGate, 'seats' | 'isPastDue'>,
  { requiresSeat, takesSeatNow = true }: { requiresSeat: boolean; takesSeatNow?: boolean },
): SeatGateEvaluation {
  const availableSeats = getAvailableSeats(seats);
  const consumesSeat = takesSeatNow && requiresSeat;

  let blockedReason: TeamSeatLimitErrorCode | null = null;
  if (consumesSeat && isPastDue) {
    blockedReason = 'PAST_DUE';
  } else if (consumesSeat && !!seats && availableSeats <= 0) {
    blockedReason = 'NO_SEATS';
  }

  return { availableSeats, seatBlocked: blockedReason !== null, blockedReason };
}

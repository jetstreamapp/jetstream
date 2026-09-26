import { TeamSeatSummary } from '@jetstream/types';
import { getAvailableSeats } from './team-seats.utils';

/**
 * Everything a member modal needs to explain the team's seat situation and offer a way out of it.
 * Built once by the dashboard and handed to the invite, role and status modals as a single prop.
 */
export interface SeatGate {
  seats: TeamSeatSummary | null;
  hasManualBilling: boolean;
  canManageSeats: boolean;
  /** Buying seats is refused while the team is past due, so the button disables in place */
  isPastDue: boolean;
  /** Closes the current modal and opens Manage Seats */
  onBuySeats: () => void;
}

export interface SeatGateEvaluation {
  availableSeats: number;
  /** The change needs a seat the team does not have, so the modal must not submit */
  seatBlocked: boolean;
}

/**
 * Whether a membership change can go ahead. `requiresSeat` is whether the target role is billable;
 * `takesSeatNow` is whether this particular change consumes one right away (reactivating an inactive
 * member does, re-roling an inactive member does not — that seat is checked on reactivation).
 */
export function evaluateSeatGate(
  seats: TeamSeatSummary | null,
  { requiresSeat, takesSeatNow = true }: { requiresSeat: boolean; takesSeatNow?: boolean },
): SeatGateEvaluation {
  const availableSeats = getAvailableSeats(seats);
  const seatBlocked = takesSeatNow && requiresSeat && !!seats && availableSeats <= 0;
  return { availableSeats, seatBlocked };
}

import { TeamSeatSummary } from '@jetstream/types';
import { ScopedNotification } from '@jetstream/ui';
import { PAST_DUE_SEATS_HINT } from './TeamSeats';
import { getSeatsUnavailableMessage } from './team-seats.utils';

export interface SeatsUnavailableNoticeProps {
  seats: TeamSeatSummary;
  hasManualBilling: boolean;
  canManageSeats: boolean;
  /** Buying seats is refused while the team is past due, so the button disables in place */
  isPastDue?: boolean;
  /** Closes the current modal and opens Manage Seats */
  onBuySeats?: () => void;
}

/** Shown in the invite, status and role modals when the requested change needs a seat the team does not have. */
export function SeatsUnavailableNotice({ seats, hasManualBilling, canManageSeats, isPastDue, onBuySeats }: SeatsUnavailableNoticeProps) {
  return (
    <div data-testid="seats-unavailable-notice">
      <ScopedNotification theme="warning">
        <p>{getSeatsUnavailableMessage(seats, hasManualBilling)}</p>
        {canManageSeats && !hasManualBilling && onBuySeats && (
          <button
            type="button"
            className="slds-button slds-button_brand slds-m-top_x-small"
            disabled={isPastDue}
            title={isPastDue ? PAST_DUE_SEATS_HINT : undefined}
            onClick={onBuySeats}
          >
            Buy more seats
          </button>
        )}
        {canManageSeats && !hasManualBilling && isPastDue && <p className="slds-m-top_x-small">{PAST_DUE_SEATS_HINT}</p>}
      </ScopedNotification>
    </div>
  );
}

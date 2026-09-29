import { TeamSeatSummary } from '@jetstream/types';
import { ScopedNotification } from '@jetstream/ui';
import { getSeatsUnavailableMessage } from './team-seats.utils';

export interface SeatsUnavailableNoticeProps {
  seats: TeamSeatSummary;
  hasManualBilling: boolean;
  canManageSeats: boolean;
  /** Closes the current modal and opens Manage Seats */
  onBuySeats?: () => void;
}

/**
 * Shown in the invite, status and role modals when the requested change needs a seat the team does not have.
 * A past-due team gets its own notice instead (see `SeatChangeNotice`), since it cannot buy seats either.
 */
export function SeatsUnavailableNotice({ seats, hasManualBilling, canManageSeats, onBuySeats }: SeatsUnavailableNoticeProps) {
  return (
    <div data-testid="seats-unavailable-notice">
      <ScopedNotification theme="warning">
        <p>{getSeatsUnavailableMessage(seats, hasManualBilling)}</p>
      </ScopedNotification>
      {/* Outside the notification: SLDS styles every button inside a warning theme as an underlined link */}
      {canManageSeats && !hasManualBilling && onBuySeats && (
        <button type="button" className="slds-button slds-button_brand slds-m-top_x-small" onClick={onBuySeats}>
          Buy more seats
        </button>
      )}
    </div>
  );
}

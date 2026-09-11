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

/** Shown in the invite, status and role modals when the requested change needs a seat the team does not have. */
export function SeatsUnavailableNotice({ seats, hasManualBilling, canManageSeats, onBuySeats }: SeatsUnavailableNoticeProps) {
  return (
    <div data-testid="seats-unavailable-notice">
      <ScopedNotification theme="warning">
        <p>{getSeatsUnavailableMessage(seats, hasManualBilling)}</p>
        {canManageSeats && !hasManualBilling && onBuySeats && (
          <button type="button" className="slds-button slds-button_brand slds-m-top_x-small" onClick={onBuySeats}>
            Buy more seats
          </button>
        )}
      </ScopedNotification>
    </div>
  );
}

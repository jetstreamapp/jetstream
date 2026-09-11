import { getOverAllocationMessage, getPendingSeatDecreaseMessage, hasPendingSeatDecrease } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { TEAM_BILLING_STATUS_PAST_DUE, TeamSeatSummary, TeamUserFacing } from '@jetstream/types';
import { Card, FeedbackLink, ScopedNotification } from '@jetstream/ui';
import classNames from 'classnames';

export const PAST_DUE_SEATS_HINT = 'Resolve your past-due invoice on the billing page before changing seats.';
export const SEATS_SYNCING_HINT = 'Your purchased seat count is still syncing from billing. Try again in a few minutes.';

export interface TeamSeatsProps {
  seats: TeamSeatSummary;
  billingStatus: TeamUserFacing['billingStatus'];
  hasManualBilling: boolean;
  /** The user's role allows changing seats and the team is self-serve; past-due and unsynced counts disable the button here */
  canManageSeats: boolean;
  onManageSeats: () => void;
}

export function TeamSeats({ seats, billingStatus, hasManualBilling, canManageSeats, onManageSeats }: TeamSeatsProps) {
  const isPastDue = billingStatus === TEAM_BILLING_STATUS_PAST_DUE;
  // Without a purchased count there is nothing to change from: the modal would open against an unknown
  // current count and describe the change in the wrong direction until the preview came back
  const isSeatCountUnknown = seats.purchased === null;
  const disabledHint = isPastDue ? PAST_DUE_SEATS_HINT : isSeatCountUnknown ? SEATS_SYNCING_HINT : null;
  const overAllocationMessage = getOverAllocationMessage(seats, hasManualBilling);

  return (
    <Card
      testId="team-seats-card"
      title="Seats"
      className="slds-m-bottom_medium slds-card_boundary"
      icon={{ type: 'standard', icon: 'people' }}
      actions={
        canManageSeats && (
          <button
            type="button"
            data-testid="team-seats-manage-button"
            className="slds-button slds-button_brand"
            disabled={!!disabledHint}
            title={disabledHint ?? undefined}
            onClick={onManageSeats}
          >
            Manage Seats
          </button>
        )
      }
    >
      {seats.isUnlimited ? (
        <>
          <p data-testid="team-seats-unlimited">
            {hasManualBilling ? 'Unlimited seats (set by your agreement).' : 'No seat limit is configured for your team.'}
          </p>
          <p className="slds-text-body_small slds-text-color_weak slds-m-top_xx-small">
            {seats.used} in use
            {seats.reserved > 0 && ` · ${seats.reserved} reserved for pending invitations`}
          </p>
        </>
      ) : (
        <div className="slds-grid slds-wrap slds-gutters_small">
          <div className="slds-col slds-size_1-of-3">
            <p className="slds-text-title_caps slds-text-color_weak">Purchased</p>
            <p data-testid="team-seats-purchased" className="slds-text-heading_medium">
              {seats.purchased}
            </p>
          </div>
          <div className="slds-col slds-size_1-of-3">
            <p className="slds-text-title_caps slds-text-color_weak">In use</p>
            <p data-testid="team-seats-used" className="slds-text-heading_medium">
              {seats.used}
            </p>
            {seats.reserved > 0 && (
              <p className="slds-text-body_small slds-text-color_weak">
                {seats.reserved} reserved for pending {pluralizeFromNumber('invitation', seats.reserved)}
              </p>
            )}
          </div>
          <div className="slds-col slds-size_1-of-3">
            <p className="slds-text-title_caps slds-text-color_weak">Available</p>
            <p
              data-testid="team-seats-available"
              className={classNames('slds-text-heading_medium', {
                'slds-text-color_error': seats.available !== null && seats.available < 0,
              })}
            >
              {seats.available}
            </p>
          </div>
        </div>
      )}

      {hasPendingSeatDecrease(seats) && (
        <div data-testid="team-seats-pending" className="slds-m-top_small">
          <ScopedNotification theme="info">
            {getPendingSeatDecreaseMessage(seats)} To cancel the decrease, increase your seat count again.
          </ScopedNotification>
        </div>
      )}

      {overAllocationMessage && (
        <div data-testid="team-seats-over-allocated" className="slds-m-top_small">
          <ScopedNotification theme="warning">{overAllocationMessage}</ScopedNotification>
        </div>
      )}

      {hasManualBilling && (
        <p className="slds-text-body_small slds-text-color_weak slds-m-top_small">
          Your seat limit is set by your billing agreement. Contact support to change it.{' '}
          <FeedbackLink type="EMAIL" label="Email support" emailLinkParams={{ subject: 'Team seat limit change' }} />
        </p>
      )}

      {canManageSeats && disabledHint && <p className="slds-text-body_small slds-text-color_weak slds-m-top_small">{disabledHint}</p>}
    </Card>
  );
}

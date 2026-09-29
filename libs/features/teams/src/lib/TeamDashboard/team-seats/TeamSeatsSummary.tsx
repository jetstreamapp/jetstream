import { getPendingSeatDecreaseMessage, hasPendingSeatDecrease } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { TeamSeatSummary } from '@jetstream/types';
import { FeedbackLink, ScopedNotification } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, ReactNode } from 'react';
import { getSeatBannerState } from './team-seats.utils';

export const PAST_DUE_SEATS_HINT = 'Resolve your past-due invoice on the billing page before changing seats.';
export const SEATS_SYNCING_HINT =
  'Your seat count is not available from billing yet. Refresh in a few minutes, or contact support if this continues.';

function getUsageParts(seats: TeamSeatSummary, hasManualBilling: boolean): { key: string; content: ReactNode }[] {
  const inUse = {
    key: 'used',
    content: (
      <>
        <strong data-testid="team-seats-used">{seats.used}</strong> in use
      </>
    ),
  };
  if (seats.isUnlimited) {
    const limit = hasManualBilling ? 'Unlimited (set by your agreement)' : 'No seat limit is configured';
    return [{ key: 'unlimited', content: <span data-testid="team-seats-unlimited">{limit}</span> }, inUse];
  }
  const isOverAllocated = seats.available !== null && seats.available < 0;
  return [
    {
      key: 'purchased',
      content: (
        <>
          <strong data-testid="team-seats-purchased">{seats.purchased}</strong> purchased
        </>
      ),
    },
    inUse,
    ...(seats.reserved > 0
      ? [
          {
            key: 'reserved',
            content: (
              <>
                <strong>{seats.reserved}</strong> reserved for pending {pluralizeFromNumber('invitation', seats.reserved)}
              </>
            ),
          },
        ]
      : []),
    {
      key: 'available',
      content: (
        <>
          <strong data-testid="team-seats-available" className={classNames({ 'slds-text-color_error': isOverAllocated })}>
            {seats.available}
          </strong>{' '}
          available
        </>
      ),
    },
  ];
}

export interface TeamSeatsSummaryProps {
  seats: TeamSeatSummary;
  hasManualBilling: boolean;
  /** Why Manage Seats is disabled for someone who could otherwise use it (past due, count still syncing) */
  manageSeatsDisabledReason: string | null;
}

/**
 * One line of seat usage above the members table, followed only by the notes that apply: a scheduled
 * decrease, an agreement-based limit, why Manage Seats is disabled, and a notice when the team is full or
 * over its seats.
 */
export function TeamSeatsSummary({ seats, hasManualBilling, manageSeatsDisabledReason }: TeamSeatsSummaryProps) {
  const banner = getSeatBannerState(seats, hasManualBilling);
  const hasPendingDecrease = hasPendingSeatDecrease(seats);

  return (
    <div data-testid="team-seats-card" className="slds-p-horizontal_small slds-m-bottom_small">
      <p>
        <span className="slds-text-title_caps">Seats</span>{' '}
        {getUsageParts(seats, hasManualBilling).map(({ key, content }, i) => (
          <Fragment key={key}>
            {i > 0 && ' · '}
            {content}
          </Fragment>
        ))}
        {/* Available is measured against the lower count, which would not add up against Purchased without saying so */}
        {hasPendingDecrease && (
          <span data-testid="team-seats-available-caption" className="slds-text-color_weak">
            {` (of ${seats.effective} after the scheduled decrease)`}
          </span>
        )}
      </p>

      {hasPendingDecrease && (
        <p data-testid="team-seats-pending" className="slds-text-body_small slds-text-color_weak slds-m-top_xx-small">
          {getPendingSeatDecreaseMessage(seats)} Set your seats back to {seats.purchased} or more to cancel it.
        </p>
      )}

      {hasManualBilling && (
        <p className="slds-text-body_small slds-text-color_weak slds-m-top_xx-small">
          Your seat limit is set by your billing agreement. Contact support to change it.{' '}
          <FeedbackLink type="EMAIL" label="Email support" emailLinkParams={{ subject: 'Team seat limit change' }} />
        </p>
      )}

      {manageSeatsDisabledReason && (
        <p className="slds-text-body_small slds-text-color_weak slds-m-top_xx-small">{manageSeatsDisabledReason}</p>
      )}

      {banner && (
        <div data-testid="team-seats-banner" className="slds-m-top_x-small">
          <ScopedNotification theme={banner.theme}>{banner.message}</ScopedNotification>
        </div>
      )}
    </div>
  );
}

import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { previewTeamSeats, updateTeamSeats } from '@jetstream/shared/data';
import { formatUsd, getIntervalLabel } from '@jetstream/shared/ui-utils';
import { getErrorMessage, pluralizeFromNumber } from '@jetstream/shared/utils';
import { MAX_TEAM_SEATS, TeamSeatChangePreview, TeamSeatChangeResult, TeamSeatSummary, TeamUserFacing } from '@jetstream/types';
import { fireToast, Modal, NumberStepperInput, ScopedNotification, Spinner } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { useState } from 'react';
import { formatSeatDate, getSeatChangeType, hasPendingSeatDecrease } from './team-seats.utils';

export interface TeamSeatsManageModalProps {
  teamId: string;
  seats: TeamSeatSummary;
  /** Receives the refreshed team after a successful change */
  onClose: (team?: TeamUserFacing) => void;
}

function getConfirmLabel(preview: TeamSeatChangePreview): string {
  if (preview.changeType === 'INCREASE' && preview.amountDueNow > 0) {
    return `Confirm and pay ${formatUsd(preview.amountDueNow)}`;
  }
  if (preview.changeType === 'DECREASE') {
    return 'Schedule decrease';
  }
  return 'Confirm';
}

function getSuccessMessage({ changeType, seats, effectiveAt }: TeamSeatChangeResult): string {
  switch (changeType) {
    case 'INCREASE':
      return `Your team now has ${seats} ${pluralizeFromNumber('seat', seats)}.`;
    case 'DECREASE':
      return `Your seat count will decrease to ${seats} on ${formatSeatDate(effectiveAt)}.`;
    case 'CANCEL_PENDING_DECREASE':
      return `Your scheduled seat decrease was cancelled. Your team keeps ${seats} ${pluralizeFromNumber('seat', seats)}.`;
    default:
      return 'Your seat count is unchanged.';
  }
}

/**
 * Two-step flow: choose a seat count, preview what Stripe will charge (or when a decrease lands),
 * then confirm. The preview's `currentSeats` and `prorationDate` are echoed back so the server can
 * reject a commit made against stale numbers.
 */
export function TeamSeatsManageModal({ teamId, seats, onClose }: TeamSeatsManageModalProps) {
  const { trackEvent } = useAmplitude();
  const purchasedSeats = seats.purchased ?? 0;
  const minSeats = Math.max(1, seats.used + seats.reserved);

  // Start from the count that will be in force, but never below what the team already uses
  const [requestedSeats, setRequestedSeats] = useState(Math.max(seats.pending ?? purchasedSeats, minSeats));
  const [preview, setPreview] = useState<TeamSeatChangePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isInRange = Number.isInteger(requestedSeats) && requestedSeats >= minSeats && requestedSeats <= MAX_TEAM_SEATS;
  const changeType = getSeatChangeType(requestedSeats, seats);
  const canPreview = isInRange && changeType !== 'NONE' && !loading;

  let directionNote: string | null = null;
  if (changeType === 'INCREASE') {
    directionNote = 'Added seats are billed today, prorated for the rest of your current billing period.';
  } else if (changeType === 'DECREASE') {
    directionNote = 'Seat decreases take effect at the end of your current billing period and are not refunded.';
    if (hasPendingSeatDecrease(seats)) {
      directionNote += ` This replaces your scheduled decrease to ${seats.pending} seats.`;
    }
  } else if (changeType === 'CANCEL_PENDING_DECREASE') {
    directionNote = `This cancels your scheduled decrease to ${seats.pending} seats.`;
  }

  async function handlePreview() {
    setErrorMessage(null);
    setLoading(true);
    try {
      setPreview(await previewTeamSeats(teamId, { seats: requestedSeats }));
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) {
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    try {
      const { team, result } = await updateTeamSeats(teamId, {
        seats: preview.requestedSeats,
        expectedCurrentSeats: preview.currentSeats,
        prorationDate: preview.prorationDate,
      });
      trackEvent(ANALYTICS_KEYS.team_seats_updated, { changeType: result.changeType, seats: result.seats });
      fireToast({ type: 'success', message: getSuccessMessage(result) });
      onClose(team);
    } catch (ex) {
      setErrorMessage(`${getErrorMessage(ex)} — the preview may be out of date. Go back and preview again.`);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setPreview(null);
    setErrorMessage(null);
  }

  const renderEditStep = () => (
    <div data-testid="team-seats-edit">
      <p className="slds-m-bottom_small">
        <strong>{purchasedSeats}</strong> purchased · <strong>{seats.used}</strong> in use · <strong>{seats.reserved}</strong> reserved
      </p>
      <NumberStepperInput
        id="team-seats-count"
        testId="team-seats-count"
        label="Seats"
        value={requestedSeats}
        min={minSeats}
        max={MAX_TEAM_SEATS}
        disabled={loading}
        isRequired
        helpText="You cannot go below the seats your team is using or has reserved for pending invitations."
        hasError={!isInRange}
        errorMessage={`Enter between ${minSeats} and ${MAX_TEAM_SEATS} seats.`}
        decrementLabel="Remove a seat"
        incrementLabel="Add a seat"
        onChange={setRequestedSeats}
      />
      {directionNote && (
        <ScopedNotification theme="info" className="slds-m-top_small">
          {directionNote}
        </ScopedNotification>
      )}
    </div>
  );

  const renderPreviewStep = (seatPreview: TeamSeatChangePreview) => {
    const intervalLabel = getIntervalLabel(seatPreview.interval);
    // Preview amounts come from Stripe's invoice preview, so coupons are already reflected in them
    const discountQualifier = seatPreview.hasDiscount ? <span className="slds-text-color_weak"> (discounts applied)</span> : null;
    const isImmediate = seatPreview.changeType === 'INCREASE' || seatPreview.changeType === 'CANCEL_PENDING_DECREASE';

    return (
      <div data-testid="team-seats-preview">
        <dl className="slds-list_horizontal slds-wrap">
          <dt className="slds-item_label slds-text-color_weak">New seat count</dt>
          <dd className="slds-item_detail">
            <strong>{seatPreview.requestedSeats}</strong> (currently {seatPreview.currentSeats})
          </dd>
          <dt className="slds-item_label slds-text-color_weak">Due today</dt>
          <dd className="slds-item_detail">
            {seatPreview.amountDueNow > 0 ? (
              <>
                <strong>{formatUsd(seatPreview.amountDueNow)}</strong>
                {discountQualifier}
              </>
            ) : (
              'No charge'
            )}
          </dd>
          <dt className="slds-item_label slds-text-color_weak">New recurring total</dt>
          <dd className="slds-item_detail">
            {formatUsd(seatPreview.nextInvoice.amount)}/{intervalLabel}
            {discountQualifier}
          </dd>
          <dt className="slds-item_label slds-text-color_weak">{isImmediate ? 'Effective' : 'Takes effect'}</dt>
          <dd className="slds-item_detail">{isImmediate ? 'Immediately' : formatSeatDate(seatPreview.effectiveAt)}</dd>
        </dl>

        {seatPreview.replacesPendingDecrease && (
          <ScopedNotification theme="info" className="slds-m-top_small">
            This replaces your scheduled decrease to {seatPreview.replacesPendingDecrease.seats} seats on{' '}
            {formatSeatDate(seatPreview.replacesPendingDecrease.effectiveAt)}.
          </ScopedNotification>
        )}

        {seatPreview.changeType === 'DECREASE' && (
          <ScopedNotification theme="info" className="slds-m-top_small">
            Seat decreases take effect at the end of the current billing period and are not refunded. If you renewed recently and want a
            refund for unused seats, contact support and we will handle it manually.
          </ScopedNotification>
        )}

        {seatPreview.changeType === 'NONE' && (
          <ScopedNotification theme="info" className="slds-m-top_small">
            Your team's seat count already matches this number, so there is nothing to confirm. Go back to choose a different count.
          </ScopedNotification>
        )}
      </div>
    );
  };

  return (
    <Modal
      testId="team-seats-manage-modal"
      header="Manage Seats"
      closeDisabled={loading}
      onClose={() => onClose()}
      footer={
        preview ? (
          <>
            <button type="button" className="slds-button slds-button_neutral" onClick={handleBack} disabled={loading}>
              Back
            </button>
            <button
              type="button"
              data-testid="team-seats-confirm-button"
              className="slds-button slds-button_brand slds-is-relative"
              onClick={handleConfirm}
              disabled={loading || preview.changeType === 'NONE'}
            >
              {getConfirmLabel(preview)}
              {loading && <Spinner className="slds-spinner slds-spinner_small" />}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={loading}>
              Cancel
            </button>
            <button
              type="button"
              data-testid="team-seats-preview-button"
              className="slds-button slds-button_brand slds-is-relative"
              onClick={handlePreview}
              disabled={!canPreview}
            >
              Preview
              {loading && <Spinner className="slds-spinner slds-spinner_small" />}
            </button>
          </>
        )
      }
    >
      {errorMessage && (
        <ScopedNotification theme="error" className="slds-m-bottom_small">
          {errorMessage}
        </ScopedNotification>
      )}
      {preview ? renderPreviewStep(preview) : renderEditStep()}
    </Modal>
  );
}

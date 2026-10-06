import { formatUsd, getIntervalLabel } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { JetstreamPrice, MAX_TEAM_SEATS, TeamUserFacing } from '@jetstream/types';
import { Input, NumberStepperInput, ReadOnlyFormItem } from '@jetstream/ui';
import { describePriceForQuantity, getNextVolumeTier } from './billing.utils';

export interface TeamCheckoutOptionsProps {
  /** The Team price for the selected billing period; null until prices load or when the fetch failed */
  price: JetstreamPrice | null;
  /** Set when the user already belongs to a team, which fixes the name and raises the seat minimum */
  existingTeam: TeamUserFacing | null;
  seats: number;
  minSeats: number;
  seatsError: string | null;
  teamName: string;
  teamNameError: string | null;
  disabled: boolean;
  onSeatsChange: (seats: number) => void;
  onTeamNameChange: (teamName: string) => void;
}

/**
 * Seat count and team name for a Team checkout. Stripe Checkout is opened with the quantity locked,
 * so this is the only place the customer chooses how many seats to buy.
 */
export function TeamCheckoutOptions({
  price,
  existingTeam,
  seats,
  minSeats,
  seatsError,
  teamName,
  teamNameError,
  disabled,
  onSeatsChange,
  onTeamNameChange,
}: TeamCheckoutOptionsProps) {
  const interval = getIntervalLabel(price?.interval);
  const { total, perSeatRate } = describePriceForQuantity(price, seats);
  const nextTier = price ? getNextVolumeTier(price.tiers, price.tiersMode, seats) : null;
  const seatsInUse = existingTeam ? existingTeam.seats.used + existingTeam.seats.reserved : 0;

  let seatsHelpText: string | undefined;
  if (existingTeam && seatsInUse > 0) {
    seatsHelpText = `Your team already uses ${seatsInUse} ${pluralizeFromNumber('seat', seatsInUse)}, including pending invitations.`;
  }

  return (
    <div data-testid="team-checkout-options" className="slds-box slds-box_small slds-m-top_medium">
      <h3 className="slds-text-heading_small slds-m-bottom_small">Team details</h3>
      <div className="slds-grid slds-wrap slds-gutters_small">
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2">
          <NumberStepperInput
            id="team-seat-count"
            testId="team-seat-count"
            label="Seats"
            value={seats}
            min={minSeats}
            max={MAX_TEAM_SEATS}
            disabled={disabled}
            isRequired
            helpText={seatsHelpText}
            hasError={!!seatsError}
            errorMessage={seatsError}
            decrementLabel="Remove a seat"
            incrementLabel="Add a seat"
            onChange={onSeatsChange}
          />
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2">
          {existingTeam ? (
            <ReadOnlyFormItem label="Team Name" omitEdit>
              {existingTeam.name}
            </ReadOnlyFormItem>
          ) : (
            <Input
              id="team-name"
              label="Team Name"
              isRequired
              hasError={!!teamNameError}
              errorMessage={teamNameError}
              errorMessageId="team-name-error"
              helpText="You can change this later from the team dashboard."
              helpTextId="team-name-help"
            >
              <input
                id="team-name"
                className="slds-input"
                value={teamName}
                disabled={disabled}
                required
                minLength={1}
                maxLength={255}
                autoComplete="organization"
                aria-invalid={!!teamNameError}
                aria-describedby={teamNameError ? 'team-name-help team-name-error' : 'team-name-help'}
                onChange={(event) => onTeamNameChange(event.target.value)}
              />
            </Input>
          )}
        </div>
      </div>

      <div data-testid="team-checkout-total" className="slds-m-top_small" aria-live="polite" aria-atomic="true">
        {/* A partially typed seat count can be zero or negative, which makes every derived amount meaningless */}
        {total !== null && seats > 0 && (
          <>
            {perSeatRate !== null && (
              <p>
                {seats} {pluralizeFromNumber('seat', seats)} × {formatUsd(perSeatRate)}/seat/{interval}
              </p>
            )}
            <p className="slds-text-heading_small">
              <strong>
                {formatUsd(total)}/{interval}
              </strong>
            </p>
            {nextTier && (
              <p className="slds-text-body_small slds-m-top_xx-small">
                Add {nextTier.startsAt - seats} more {pluralizeFromNumber('seat', nextTier.startsAt - seats)} to pay{' '}
                {formatUsd(nextTier.unitAmount)}/seat/{interval} for every seat.
              </p>
            )}
          </>
        )}
      </div>
      {/* Outside the live region so the disclaimer is not re-read on every seat change */}
      <p className="slds-text-body_small slds-text-color_weak slds-m-top_xx-small">
        The final amount is shown at checkout. You can add or remove seats later from the Team Dashboard.
      </p>
    </div>
  );
}

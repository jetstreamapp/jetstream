import { css } from '@emotion/react';
import { createInvitation } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { Feature, TeamInviteUserFacing, TeamMemberRole, TeamSeatSummary } from '@jetstream/types';
import { Input, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { useState } from 'react';
import { SeatsUnavailableNotice } from './team-seats/SeatsUnavailableNotice';
import { getAvailableSeats, needsSeat } from './team-seats/team-seats.utils';
import { TeamMemberRoleDropdown } from './TeamMemberRoleDropdown';

interface TeamMemberInviteModalProps {
  teamId: string;
  hasManualBilling: boolean;
  userRole: TeamMemberRole;
  seats: TeamSeatSummary | null;
  canManageSeats: boolean;
  isPastDue: boolean;
  onBuySeats: () => void;
  onClose: (invitations?: TeamInviteUserFacing[]) => void;
}

export function TeamMemberInviteModal({
  teamId,
  hasManualBilling,
  userRole,
  seats,
  canManageSeats,
  isPastDue,
  onBuySeats,
  onClose,
}: TeamMemberInviteModalProps) {
  const [email, setEmail] = useState('');
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [role, setRole] = useState<TeamMemberRole>('MEMBER');
  const [features] = useState<Feature[]>(['ALL']);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requiresSeat = needsSeat(role);
  const availableSeats = getAvailableSeats(seats);
  const seatBlocked = requiresSeat && !!seats && availableSeats <= 0;

  const handleInvite = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const invitations = await createInvitation(teamId, { email, features, role });
      onClose(invitations);
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      testId="team-member-invite-modal"
      header="Invite Team Member"
      onClose={onClose}
      footer={
        <>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            form="team-member-invite-form"
            className="slds-button slds-button_brand slds-is-relative"
            onClick={handleInvite}
            disabled={!email || loading || seatBlocked}
          >
            Send Invitation
            {loading && <Spinner className="slds-spinner slds-spinner_small" />}
          </button>
        </>
      }
    >
      {seatBlocked && seats && (
        <SeatsUnavailableNotice
          seats={seats}
          hasManualBilling={hasManualBilling}
          canManageSeats={canManageSeats}
          isPastDue={isPastDue}
          onBuySeats={onBuySeats}
        />
      )}
      {!seatBlocked && requiresSeat && Number.isFinite(availableSeats) && (
        <ScopedNotification theme="info">
          This invitation reserves 1 of your {availableSeats} available seats until it is accepted or cancelled. Your billing does not
          change.
        </ScopedNotification>
      )}
      {!requiresSeat && <ScopedNotification theme="info">Billing-only users do not use a seat.</ScopedNotification>}
      <form
        id="team-member-invite-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (invalidEmail || !email || seatBlocked) {
            setInvalidEmail(!email || invalidEmail);
            return;
          }
          handleInvite();
        }}
        css={css`
          min-height: 200px;
        `}
      >
        {errorMessage && <ScopedNotification theme="error">{errorMessage}</ScopedNotification>}

        <TeamMemberRoleDropdown role={role} disabled={loading} limitBasedOnCurrentRole={userRole} onChange={(value) => setRole(value)} />

        <Input
          id="invite-email"
          label="Email Address"
          isRequired
          hasError={invalidEmail}
          errorMessageId="email-error"
          errorMessage="Please enter a valid email address"
        >
          <input
            id="invite-email"
            className="slds-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
            maxLength={255}
            type="email"
            placeholder="Enter email address"
            onBlur={() => setInvalidEmail(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))}
            onFocus={() => setInvalidEmail(false)}
            aria-invalid={invalidEmail}
            aria-describedby={invalidEmail ? 'email-error' : undefined}
            name="email"
            autoComplete="none"
            required
          />
        </Input>

        {/* TODO: allow choosing specific features */}
      </form>
    </Modal>
  );
}

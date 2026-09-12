import { css } from '@emotion/react';
import { updateTeamMember } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { TEAM_MEMBER_STATUS_ACTIVE, TeamMemberRole, TeamSeatSummary, TeamUserFacing } from '@jetstream/types';
import { Input, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { useState } from 'react';
import { SeatsUnavailableNotice } from './team-seats/SeatsUnavailableNotice';
import { getAvailableSeats, needsSeat } from './team-seats/team-seats.utils';
import { TeamMemberRoleDropdown } from './TeamMemberRoleDropdown';

interface TeamMemberUpdateModalProps {
  teamId: string;
  teamMember: TeamUserFacing['members'][number];
  hasManualBilling: boolean;
  currentUserRole?: TeamMemberRole;
  seats: TeamSeatSummary | null;
  canManageSeats: boolean;
  isPastDue: boolean;
  onBuySeats: () => void;
  onClose: (team?: TeamUserFacing) => void;
}

export function TeamMemberUpdateModal({
  teamId,
  teamMember,
  hasManualBilling,
  currentUserRole,
  seats,
  canManageSeats,
  isPastDue,
  onBuySeats,
  onClose,
}: TeamMemberUpdateModalProps) {
  const [role, setRole] = useState<TeamMemberRole>(teamMember.role);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isDirty = teamMember.role !== role;
  const isMovingToNonBillable = isDirty && needsSeat(teamMember.role) && !needsSeat(role);
  const isMovingToBillable = isDirty && !needsSeat(teamMember.role) && needsSeat(role);
  const availableSeats = getAvailableSeats(seats);
  // Only an active member takes a seat when promoted; inactive members are checked when reactivated
  const seatBlocked = isMovingToBillable && teamMember.status === TEAM_MEMBER_STATUS_ACTIVE && !!seats && availableSeats <= 0;

  const handleUpdateRole = async () => {
    if (seatBlocked) {
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    try {
      const updatedTeam = await updateTeamMember(teamId, teamMember.userId, { role });
      onClose(updatedTeam);
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex) || 'There was an error updating this user, try again or contact support for assistance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      testId="team-member-update-modal"
      header="Update Role"
      onClose={() => onClose()}
      footer={
        <>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            form="team-member-update-form"
            className="slds-button slds-button_brand slds-is-relative"
            onClick={handleUpdateRole}
            disabled={!isDirty || loading || seatBlocked}
          >
            Save
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
      {!seatBlocked && isMovingToBillable && Number.isFinite(availableSeats) && (
        <ScopedNotification theme="info">
          This change uses 1 of your {availableSeats} available seats. Your billing does not change.
        </ScopedNotification>
      )}
      {isMovingToNonBillable && (
        <ScopedNotification theme="info">
          This change frees a seat for another team member.
          {!hasManualBilling && ' Your purchased seat count and billing do not change — use Manage Seats to reduce seats.'}
        </ScopedNotification>
      )}
      <form
        id="team-member-update-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleUpdateRole();
        }}
        css={css`
          min-height: 200px;
        `}
      >
        {errorMessage && <ScopedNotification theme="error">{errorMessage}</ScopedNotification>}

        <TeamMemberRoleDropdown
          role={role}
          disabled={loading}
          limitBasedOnCurrentRole={currentUserRole}
          onChange={(value) => setRole(value)}
        />

        <Input id="email-input" label="Email Address" isRequired>
          <input
            id="email-input"
            className="slds-input"
            value={teamMember.user.email}
            disabled
            type="email"
            name="email"
            autoComplete="none"
          />
        </Input>

        {/* TODO: allow choosing specific features */}
      </form>
    </Modal>
  );
}

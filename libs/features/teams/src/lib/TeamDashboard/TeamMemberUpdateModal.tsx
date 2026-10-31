import { css } from '@emotion/react';
import { updateTeamMember } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { TEAM_MEMBER_ROLE_BILLING, TEAM_MEMBER_STATUS_ACTIVE, TeamAccessProfile, TeamMemberRole, TeamUserFacing } from '@jetstream/types';
import { ariaDisabledButtonProps, Input, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { useState } from 'react';
import { TeamAccessProfileDropdown } from './access-profiles/TeamAccessProfileDropdown';
import { evaluateSeatGate, SeatGate } from './team-seats/seat-gate';
import { SEAT_CHANGE_NOTICE_ID, SeatChangeNotice } from './team-seats/SeatChangeNotice';
import { needsSeat } from './team-seats/team-seats.utils';
import { TeamMemberRoleDropdown } from './TeamMemberRoleDropdown';

interface TeamMemberUpdateModalProps {
  teamId: string;
  teamMember: TeamUserFacing['members'][number];
  accessProfiles: TeamAccessProfile[];
  canAssignAccessProfile: boolean;
  currentUserRole?: TeamMemberRole;
  seatGate: SeatGate;
  onClose: (team?: TeamUserFacing) => void;
}

export function TeamMemberUpdateModal({
  teamId,
  teamMember,
  accessProfiles,
  canAssignAccessProfile,
  currentUserRole,
  seatGate,
  onClose,
}: TeamMemberUpdateModalProps) {
  const [role, setRole] = useState<TeamMemberRole>(teamMember.role);
  const [accessProfileId, setAccessProfileId] = useState<string | null>(teamMember.accessProfileId ?? null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRoleDirty = teamMember.role !== role;
  // The profile picker is hidden for billing members, so a change made before switching to Billing is not saved
  const canChangeAccessProfile = canAssignAccessProfile && role !== TEAM_MEMBER_ROLE_BILLING;
  const isAccessProfileDirty = canChangeAccessProfile && (teamMember.accessProfileId ?? null) !== accessProfileId;
  const isDirty = isRoleDirty || isAccessProfileDirty;
  const isMovingToNonBillable = isRoleDirty && needsSeat(teamMember.role) && !needsSeat(role);
  const isMovingToBillable = isRoleDirty && !needsSeat(teamMember.role) && needsSeat(role);
  // Only an active member takes a seat when promoted; inactive members are checked when reactivated
  const seatEvaluation = evaluateSeatGate(seatGate, {
    requiresSeat: isMovingToBillable,
    takesSeatNow: teamMember.status === TEAM_MEMBER_STATUS_ACTIVE,
  });
  const { seatBlocked } = seatEvaluation;

  const handleUpdateRole = async () => {
    // Enter in a field submits the form without going through the aria-disabled button's guarded click
    if (!isDirty || loading || seatBlocked) {
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    try {
      const updatedTeam = await updateTeamMember(teamId, teamMember.userId, {
        // Unchanged fields are omitted so a profile change cannot trip a seat check and vice versa
        role: isRoleDirty ? role : undefined,
        accessProfileId: isAccessProfileDirty ? accessProfileId : undefined,
      });
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
      header="Update Member"
      onClose={() => onClose()}
      footer={
        <>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={loading}>
            Cancel
          </button>
          {/* The form's onSubmit owns the save (a click here submits the form) — the old onClick made a
              mouse click fire it twice; aria-disabled keeps focus while the submit disables the button */}
          <button
            type="submit"
            form="team-member-update-form"
            className="slds-button slds-button_brand slds-is-relative"
            aria-describedby={seatBlocked ? SEAT_CHANGE_NOTICE_ID : undefined}
            {...ariaDisabledButtonProps(!isDirty || loading || seatBlocked, () => {})}
          >
            Save
            {loading && <Spinner className="slds-spinner slds-spinner_small" />}
          </button>
        </>
      }
    >
      {/* The non-billable direction has its own note below, so the generic billing-only note is suppressed */}
      <SeatChangeNotice
        seatGate={seatGate}
        evaluation={seatEvaluation}
        requiresSeat={isMovingToBillable}
        consumption="uses"
        billingOnlyNote={false}
      />
      {isMovingToNonBillable && (
        <ScopedNotification theme="info">
          This change frees a seat for another team member.
          {!seatGate.hasManualBilling && ' Your purchased seat count and billing do not change. Use Manage Seats to reduce seats.'}
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
            autoComplete="off"
          />
        </Input>

        {canChangeAccessProfile && (
          <TeamAccessProfileDropdown
            accessProfiles={accessProfiles}
            accessProfileId={accessProfileId}
            disabled={loading}
            helpText={isAccessProfileDirty ? 'The member sees the change the next time Jetstream checks their access.' : undefined}
            onChange={setAccessProfileId}
          />
        )}
      </form>
    </Modal>
  );
}

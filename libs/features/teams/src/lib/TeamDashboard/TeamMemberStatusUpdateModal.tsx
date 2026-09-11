import { css } from '@emotion/react';
import { updateTeamMemberStatus } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { TeamMemberRole, TeamUserAction, TeamUserFacing } from '@jetstream/types';
import { fireToast, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { useState } from 'react';
import { evaluateSeatGate, SeatGate } from './team-seats/seat-gate';
import { SeatChangeNotice } from './team-seats/SeatChangeNotice';
import { needsSeat } from './team-seats/team-seats.utils';
import { TeamMemberRoleDropdown } from './TeamMemberRoleDropdown';

interface TeamMemberStatusUpdateModalProps {
  teamId: string;
  teamMember: TeamUserFacing['members'][number];
  action: TeamUserAction;
  seatGate: SeatGate;
  onClose: (team?: TeamUserFacing) => void;
}

export function TeamMemberStatusUpdateModal({ teamId, teamMember, action, seatGate, onClose }: TeamMemberStatusUpdateModalProps) {
  const [role, setRole] = useState<TeamMemberRole>(teamMember.role);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isReactivating = action === 'reactivate';
  const requiresSeat = needsSeat(role);
  // Only reactivation takes a seat; deactivation frees one
  const seatEvaluation = evaluateSeatGate(seatGate.seats, { requiresSeat, takesSeatNow: isReactivating });
  const { seatBlocked } = seatEvaluation;

  const handleUpdateStatusAndRole = async () => {
    if (seatBlocked) {
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    try {
      const status = action === 'deactivate' ? 'INACTIVE' : 'ACTIVE';
      const updatedTeam = await updateTeamMemberStatus(teamId, teamMember.userId, { status, role });
      onClose(updatedTeam);
      fireToast({
        message: action === 'deactivate' ? `Successfully deactivated member` : `Successfully reactivated member`,
        type: 'success',
      });
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex) || 'There was an error updating this user, try again or contact support for assistance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      testId="team-member-status-update-modal"
      header="Update Status"
      onClose={() => onClose()}
      footer={
        <>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            form="team-member-status-update-form"
            className="slds-button slds-button_brand slds-is-relative"
            disabled={loading || seatBlocked}
          >
            Save
            {loading && <Spinner className="slds-spinner slds-spinner_small" />}
          </button>
        </>
      }
    >
      <form
        id="team-member-status-update-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleUpdateStatusAndRole();
        }}
        css={css`
          min-height: 200px;
        `}
      >
        {errorMessage && <ScopedNotification theme="error">{errorMessage}</ScopedNotification>}

        {action === 'deactivate' && (
          <>
            {needsSeat(teamMember.role) && (
              <ScopedNotification theme="info">
                Once deactivated, this user no longer uses a seat and the seat becomes available for another team member.
                {!seatGate.hasManualBilling && ' Your purchased seat count and billing do not change — use Manage Seats to reduce seats.'}
              </ScopedNotification>
            )}
            <p className="slds-m-top_x-small">
              Are you sure you want to deactivate <strong>{teamMember.user.name}</strong>?
            </p>
            <p className="slds-m-top_x-small">
              After deactivating, all sessions will be revoked and this user will no longer be able to access Jetstream.
            </p>
          </>
        )}

        {isReactivating && (
          <>
            <SeatChangeNotice seatGate={seatGate} evaluation={seatEvaluation} requiresSeat={requiresSeat} consumption="uses" />

            <p className="slds-m-top_x-small">
              Are you sure you want to reactivate <strong>{teamMember.user.name}</strong>?
            </p>

            <TeamMemberRoleDropdown label="New Role" role={role} disabled={loading} onChange={(value) => setRole(value)} />
          </>
        )}
      </form>
    </Modal>
  );
}

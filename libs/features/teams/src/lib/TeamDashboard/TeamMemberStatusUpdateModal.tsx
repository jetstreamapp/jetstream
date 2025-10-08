import { css } from '@emotion/react';
import { updateTeamMemberStatus } from '@jetstream/shared/data';
import { TeamMemberRole, TeamUserAction, TeamUserFacing } from '@jetstream/types';
import { fireToast, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { useState } from 'react';
import { TeamMemberRoleDropdown } from './TeamMemberRoleDropdown';

interface TeamMemberStatusUpdateModalProps {
  teamId: string;
  teamMember: TeamUserFacing['members'][number];
  action: TeamUserAction;
  hasManualBilling: boolean;
  onClose: (team?: TeamUserFacing) => void;
}

export function TeamMemberStatusUpdateModal({ teamId, teamMember, action, hasManualBilling, onClose }: TeamMemberStatusUpdateModalProps) {
  const [role, setRole] = useState<TeamMemberRole>(teamMember.role);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isDirty = teamMember.role !== role;

  const handleUpdateStatusAndRole = async () => {
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
    } catch {
      setErrorMessage('There was an error updating this user, try again or contact support for assistance.');
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
            disabled={loading}
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
            {!hasManualBilling && teamMember.role !== 'BILLING' && (
              <ScopedNotification theme="info">
                Once deactivated, this user will not count towards your overall user limit. Depending on your plan, a credit may be
                generated which will apply to future invoices.
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

        {action === 'reactivate' && (
          <>
            {!hasManualBilling && role !== 'BILLING' && (
              <ScopedNotification theme="info">
                Once activated, billing will be restarted for this user and depending on your plan and user count, additional charges may
                apply.
              </ScopedNotification>
            )}

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

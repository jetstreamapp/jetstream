import { css } from '@emotion/react';
import { updateTeamMember } from '@jetstream/shared/data';
import { TeamMemberRole, TeamUserFacing } from '@jetstream/types';
import { Input, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { useState } from 'react';
import { TeamMemberRoleDropdown } from './TeamMemberRoleDropdown';

interface TeamMemberUpdateModalProps {
  teamId: string;
  teamMember: TeamUserFacing['members'][number];
  hasManualBilling: boolean;
  currentUserRole?: TeamMemberRole;
  onClose: (team?: TeamUserFacing) => void;
}

export function TeamMemberUpdateModal({ teamId, teamMember, hasManualBilling, currentUserRole, onClose }: TeamMemberUpdateModalProps) {
  const [role, setRole] = useState<TeamMemberRole>(teamMember.role);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isMovingToNonBillable = teamMember.role !== role && role === 'BILLING';
  const isMovingToBillable = teamMember.role !== role && teamMember.role === 'BILLING';
  const isDirty = teamMember.role !== role;

  const handleUpdateRole = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const updatedTeam = await updateTeamMember(teamId, teamMember.userId, { role });
      onClose(updatedTeam);
    } catch {
      setErrorMessage('There was an error updating this user, try again or contact support for assistance.');
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
            disabled={!isDirty || loading}
          >
            Save
            {loading && <Spinner className="slds-spinner slds-spinner_small" />}
          </button>
        </>
      }
    >
      {!hasManualBilling && isMovingToNonBillable && (
        <ScopedNotification theme="info">
          Moving from a billable role to a non-billable role may result in a prorated credit, depending on your plan, which will be applied
          to future invoices.
        </ScopedNotification>
      )}
      {!hasManualBilling && isMovingToBillable && (
        <ScopedNotification theme="info">
          Moving from a non-billable role to a billable role may result in a prorated invoice, depending on your plan, which will be
          generated upon this change.
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

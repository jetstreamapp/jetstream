import { deleteTeamAccessProfile } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { TeamAccessProfile, TeamUserFacing } from '@jetstream/types';
import { Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { useState } from 'react';
import { FULL_ACCESS_ID, getDefaultAccessProfileId } from './access-profile.utils';
import { TeamAccessProfileDropdown } from './TeamAccessProfileDropdown';

interface TeamAccessProfileDeleteModalProps {
  teamId: string;
  accessProfile: TeamAccessProfile;
  accessProfiles: TeamAccessProfile[];
  onClose: (team?: TeamUserFacing) => void;
}

export function TeamAccessProfileDeleteModal({ teamId, accessProfile, accessProfiles, onClose }: TeamAccessProfileDeleteModalProps) {
  // Suggest the team default, the explicit Move to picker still shows where members end up
  const [reassignToAccessProfileId, setReassignToAccessProfileId] = useState<string | null>(() =>
    accessProfile.isDefault ? null : getDefaultAccessProfileId(accessProfiles),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The counts are from when the dashboard loaded. If someone was assigned the profile since and the server
  // refuses the delete, show the picker so the admin can choose a destination instead of closing and reopening.
  const [reassignRequired, setReassignRequired] = useState(false);

  const { memberCount, invitationCount } = accessProfile;
  const isInUse = memberCount > 0 || invitationCount > 0;
  const showReassign = isInUse || reassignRequired;
  const assignmentSummary = [
    memberCount ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}` : null,
    invitationCount ? `${invitationCount} ${invitationCount === 1 ? 'invitation' : 'invitations'}` : null,
  ]
    .filter(Boolean)
    .join(' and ');

  async function handleDelete() {
    setErrorMessage(null);
    setLoading(true);
    try {
      const reassignTo = showReassign ? (reassignToAccessProfileId ?? FULL_ACCESS_ID) : undefined;
      const team = await deleteTeamAccessProfile(teamId, accessProfile.id, reassignTo);
      onClose(team);
    } catch (ex) {
      if (!isInUse) {
        setReassignRequired(true);
      }
      setErrorMessage(
        getErrorMessage(ex) || 'There was an error deleting this access profile, try again or contact support for assistance.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      testId="team-access-profile-delete-modal"
      header="Delete Access Profile"
      onClose={() => onClose()}
      footer={
        <>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={loading}>
            Cancel
          </button>
          <button className="slds-button slds-button_destructive slds-is-relative" onClick={handleDelete} disabled={loading}>
            Delete
            {loading && <Spinner className="slds-spinner slds-spinner_small" />}
          </button>
        </>
      }
    >
      {errorMessage && <ScopedNotification theme="error">{errorMessage}</ScopedNotification>}
      <p className="slds-m-bottom_small">
        Delete the <strong>{accessProfile.name}</strong> access profile?
        {accessProfile.isDefault && ' New members will receive full access unless you choose another default profile.'}
      </p>
      {showReassign && (
        <>
          <p className="slds-m-bottom_small">
            {isInUse
              ? `It is assigned to ${assignmentSummary}. Choose the profile they should move to.`
              : 'Choose the profile its members and invitations should move to.'}
          </p>
          <TeamAccessProfileDropdown
            label="Move to"
            accessProfiles={accessProfiles}
            accessProfileId={reassignToAccessProfileId}
            excludeAccessProfileId={accessProfile.id}
            disabled={loading}
            onChange={setReassignToAccessProfileId}
          />
        </>
      )}
    </Modal>
  );
}

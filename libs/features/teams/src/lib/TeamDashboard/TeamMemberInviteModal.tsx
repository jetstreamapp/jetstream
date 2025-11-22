import { css } from '@emotion/react';
import { createInvitation } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { Feature, TeamInviteUserFacing, TeamMemberRole } from '@jetstream/types';
import { Input, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { useState } from 'react';
import { TeamMemberRoleDropdown } from './TeamMemberRoleDropdown';

interface TeamMemberInviteModalProps {
  teamId: string;
  hasManualBilling: boolean;
  userRole: TeamMemberRole;
  onClose: (invitations?: TeamInviteUserFacing[]) => void;
}

export function TeamMemberInviteModal({ teamId, hasManualBilling, userRole, onClose }: TeamMemberInviteModalProps) {
  const [email, setEmail] = useState('');
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [role, setRole] = useState<TeamMemberRole>('MEMBER');
  const [features, setFeatures] = useState<Feature[]>(['ALL']);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
            disabled={!email || loading}
          >
            Send Invitation
            {loading && <Spinner className="slds-spinner slds-spinner_small" />}
          </button>
        </>
      }
    >
      {!hasManualBilling && role !== 'BILLING' && (
        <ScopedNotification theme="info">
          Billing for this user will start after the invitation is accepted. If required, an invoice will be generated and collected upon
          acceptance.
        </ScopedNotification>
      )}
      {!hasManualBilling && role === 'BILLING' && (
        <ScopedNotification theme="info">
          Billing-only users do not apply to your overall user count and will not impact billing.
        </ScopedNotification>
      )}
      <form
        id="team-member-invite-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (invalidEmail || !email) {
            setInvalidEmail(true);
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

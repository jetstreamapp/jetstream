import { css } from '@emotion/react';
import { createInvitation } from '@jetstream/shared/data';
import { getErrorMessage, SsoRequirementConfig } from '@jetstream/shared/utils';
import { Feature, Maybe, TeamInviteUserFacing, TeamMemberRole } from '@jetstream/types';
import { ariaDisabledButtonProps, Input, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { useState } from 'react';
import { getSsoInviteWarning } from './team-member-invite.utils';
import { TeamMemberRoleDropdown } from './TeamMemberRoleDropdown';

interface TeamMemberInviteModalProps {
  teamId: string;
  hasManualBilling: boolean;
  userRole: TeamMemberRole;
  ssoConfig: Maybe<SsoRequirementConfig>;
  verifiedDomains: string[];
  onClose: (invitations?: TeamInviteUserFacing[]) => void;
}

export function TeamMemberInviteModal({
  teamId,
  hasManualBilling,
  userRole,
  ssoConfig,
  verifiedDomains,
  onClose,
}: TeamMemberInviteModalProps) {
  const [email, setEmail] = useState('');
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [role, setRole] = useState<TeamMemberRole>('MEMBER');
  const [features] = useState<Feature[]>(['ALL']);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Checked on blur like the address itself: while typing, every partial domain ("a", "ac", ...) is unverified, so a
  // live check flashes the warning on and off and makes screen readers re-read it for every keystroke
  const [checkedEmail, setCheckedEmail] = useState('');
  const ssoWarning = getSsoInviteWarning({ email: checkedEmail, role, ssoConfig, verifiedDomains });

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
          {/* The form's onSubmit owns the invite (a click here submits the form) — the old onClick made a
              mouse click fire it twice; aria-disabled keeps focus while the submit disables the button */}
          <button
            type="submit"
            form="team-member-invite-form"
            className="slds-button slds-button_brand slds-is-relative"
            {...ariaDisabledButtonProps(!email || loading, () => {})}
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
        {ssoWarning && <ScopedNotification theme="warning">{ssoWarning}</ScopedNotification>}

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
            onBlur={() => {
              setInvalidEmail(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
              setCheckedEmail(email);
            }}
            onFocus={() => setInvalidEmail(false)}
            aria-invalid={invalidEmail}
            aria-describedby={invalidEmail ? 'email-error' : undefined}
            name="email"
            autoComplete="off"
            required
          />
        </Input>

        {/* TODO: allow choosing specific features */}
      </form>
    </Modal>
  );
}

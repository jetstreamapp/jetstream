import { css } from '@emotion/react';
import { LoginConfigAbility } from '@jetstream/acl';
import type { EmailChangeBlockedReason, LoginConfigurationUI, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { ConfirmationModalPromise, FormRowItem, Icon, ReadOnlyFormItem, ScopedNotification, Spinner } from '@jetstream/ui';
import { formatDistanceToNow } from 'date-fns';
import { Fragment, FunctionComponent, useState } from 'react';
import { ProfileUserEmailChangeModal } from './ProfileUserEmailChangeModal';

const BLOCKED_REASON_HELP_TEXT: Record<EmailChangeBlockedReason, string> = {
  SSO_MANAGED: "Your email address is managed by your organization's single sign-on provider. Contact your administrator to change it.",
};

const DEFAULT_BLOCKED_HELP_TEXT = 'File a support ticket to change your email.';

/**
 * The ability can only say yes or no, so the specific explanation comes from blockedReason. Falls
 * back to the support-ticket wording whenever the reason is unknown or absent.
 */
function getBlockedHelpText(blockedReason: EmailChangeBlockedReason | null | undefined) {
  return (blockedReason && BLOCKED_REASON_HELP_TEXT[blockedReason]) || DEFAULT_BLOCKED_HELP_TEXT;
}

export interface ProfileUserEmailProps {
  fullUserProfile: UserProfileUiWithIdentities;
  loginConfigAbility: LoginConfigAbility;
  loginConfiguration: LoginConfigurationUI | null;
  onRequestEmailChange: (newEmail: string) => Promise<boolean>;
  onCancelEmailChange: () => Promise<void>;
}

export const ProfileUserEmail: FunctionComponent<ProfileUserEmailProps> = ({
  fullUserProfile,
  loginConfigAbility,
  loginConfiguration,
  onRequestEmailChange,
  onCancelEmailChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pendingEmailChange = fullUserProfile.pendingEmailChange;
  const canChangeEmail = loginConfigAbility.can('update', 'Email');
  // While a request is outstanding the edit affordance is suppressed - one change at a time.
  const showEditAffordance = canChangeEmail && !pendingEmailChange;

  async function handleCancelPending() {
    const confirmed = await ConfirmationModalPromise({
      content: 'This will cancel the pending email address change. Your current email address will stay the same.',
      header: 'Cancel email change?',
      confirm: 'Cancel change',
      cancel: 'Keep request',
    });
    if (!confirmed) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await onCancelEmailChange();
    } catch (ex) {
      setErrorMessage(ex instanceof Error ? ex.message : 'There was a problem cancelling the change');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Fragment>
      <FormRowItem>
        {/*
          slds-form__item is `display:flex`, so every child of it becomes a flex item that shrinks to
          its own content width. This wrapper keeps the form element the single full-width child, so
          the label and value stay aligned with the Name and Password rows above and below.
        */}
        <div
          css={css`
            width: 100%;
          `}
        >
          <ReadOnlyFormItem
            label="Email"
            horizontal
            omitEdit={!showEditAffordance}
            onEditMore={() => setIsModalOpen(true)}
            labelHelp={canChangeEmail ? null : getBlockedHelpText(loginConfiguration?.emailChange?.blockedReason)}
          >
            {fullUserProfile.email}
          </ReadOnlyFormItem>

          {pendingEmailChange && (
            <div
              data-testid="pending-email-change"
              className="slds-text-body_small slds-m-top_xx-small slds-p-horizontal_xx-small"
              css={css`
                display: flex;
                align-items: flex-start;
                gap: 0.25rem;
              `}
            >
              <Icon
                type="utility"
                icon="clock"
                className="slds-icon slds-icon-text-default slds-icon_xx-small"
                containerClassname="slds-m-top_xxx-small"
              />
              <div>
                Pending change to <strong>{pendingEmailChange.newEmail}</strong> - open the link in that inbox to finish, it expires{' '}
                {formatDistanceToNow(new Date(pendingEmailChange.expiresAt), { addSuffix: true })}.
                <button type="button" className="slds-button slds-m-left_xx-small" onClick={handleCancelPending} disabled={isLoading}>
                  Cancel request
                </button>
                {isLoading && (
                  <Spinner
                    className="slds-m-left_x-small slds-spinner slds-spinner_brand slds-spinner_x-small slds-spinner_inline"
                    hasContainer={false}
                  />
                )}
              </div>
            </div>
          )}

          {errorMessage && (
            <ScopedNotification theme="error" className="slds-m-top_xx-small">
              {errorMessage}
            </ScopedNotification>
          )}
        </div>
      </FormRowItem>

      {isModalOpen && (
        <ProfileUserEmailChangeModal
          currentEmail={fullUserProfile.email}
          onRequestEmailChange={onRequestEmailChange}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </Fragment>
  );
};

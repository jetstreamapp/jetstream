import { Textarea } from '@jetstream/ui';
import { SettingsGroup, SettingsRow } from '@jetstream/ui-core';
import { FunctionComponent, useState } from 'react';

const DELETE_ACCOUNT_BUTTON_ID = 'settings-delete-account-button';
const CONFIRMATION_TEXTAREA_ID = 'delete-confirmation';

export interface SettingsDeleteAccountProps {
  onDeleteAccount: (reason?: string) => void;
}

export const SettingsDeleteAccount: FunctionComponent<SettingsDeleteAccountProps> = ({ onDeleteAccount }) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [reason, setReason] = useState('');

  // Each step unmounts the button that opened it, which would drop keyboard focus to <body> —
  // move it into the confirmation, and back to Delete Account on cancel
  function handleInitialDelete() {
    setShowConfirmation(true);
    window.setTimeout(() => document.getElementById(CONFIRMATION_TEXTAREA_ID)?.focus());
  }

  function handleCancel() {
    setShowConfirmation(false);
    setReason('');
    window.setTimeout(() => document.getElementById(DELETE_ACCOUNT_BUTTON_ID)?.focus());
  }

  return (
    <SettingsGroup variant="danger">
      <SettingsRow
        id="setting-delete-account"
        title="Delete account"
        description="Permanently delete your Jetstream account and all of your stored data. Any active subscriptions are cancelled at the end of your current billing period."
      >
        {!showConfirmation && (
          <button id={DELETE_ACCOUNT_BUTTON_ID} className="slds-button slds-button_text-destructive" onClick={handleInitialDelete}>
            Delete Account
          </button>
        )}
      </SettingsRow>
      {showConfirmation && (
        <div className="slds-p-horizontal_large slds-p-vertical_medium">
          <p className="slds-text-heading_small slds-text-color_destructive">Are you sure you want to delete your account?</p>
          <p className="slds-text-color_destructive">This action is not reversible.</p>
          <Textarea
            id={CONFIRMATION_TEXTAREA_ID}
            className="slds-m-vertical_small"
            label="Do you have any feedback you would like to provide?"
          >
            <textarea
              id={CONFIRMATION_TEXTAREA_ID}
              className="slds-textarea"
              value={reason}
              rows={4}
              onChange={(event) => setReason(event.target.value)}
            />
          </Textarea>
          <button className="slds-button slds-button_neutral" onClick={handleCancel}>
            Cancel
          </button>
          <button className="slds-button slds-button_destructive" onClick={() => onDeleteAccount(reason)}>
            Yes, Permanently Delete My Account
          </button>
        </div>
      )}
    </SettingsGroup>
  );
};

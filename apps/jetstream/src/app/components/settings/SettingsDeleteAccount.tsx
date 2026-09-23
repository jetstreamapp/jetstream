import { Textarea } from '@jetstream/ui';
import { SettingsGroup, SettingsRow } from '@jetstream/ui-core';
import { FunctionComponent, useState } from 'react';

export interface SettingsDeleteAccountProps {
  onDeleteAccount: (reason?: string) => void;
}

export const SettingsDeleteAccount: FunctionComponent<SettingsDeleteAccountProps> = ({ onDeleteAccount }) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [reason, setReason] = useState('');

  function handleCancel() {
    setShowConfirmation(false);
    setReason('');
  }

  return (
    <SettingsGroup variant="danger">
      <SettingsRow
        id="setting-delete-account"
        title="Delete account"
        description="Permanently delete your Jetstream account and all of your stored data. Any active subscriptions are cancelled at the end of your current billing period."
      >
        {!showConfirmation && (
          <button className="slds-button slds-button_text-destructive" onClick={() => setShowConfirmation(true)}>
            Delete Account
          </button>
        )}
      </SettingsRow>
      {showConfirmation && (
        <div className="slds-p-horizontal_large slds-p-vertical_medium">
          <p className="slds-text-heading_small slds-text-color_destructive">Are you sure you want to delete your account?</p>
          <p className="slds-text-color_destructive">This action is not reversible.</p>
          <Textarea id="delete-confirmation" className="slds-m-vertical_small" label="Do you have any feedback you would like to provide?">
            <textarea
              id="delete-confirmation"
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

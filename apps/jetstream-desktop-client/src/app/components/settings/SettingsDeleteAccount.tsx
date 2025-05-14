import { css } from '@emotion/react';
import { Grid, Icon, Textarea } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';

export interface SettingsDeleteAccountProps {
  onDeleteAccount: (reason?: string) => void;
}

export const SettingsDeleteAccount: FunctionComponent<SettingsDeleteAccountProps> = ({ onDeleteAccount }) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [reason, setReason] = useState('');

  function handleInitialDelete() {
    setShowConfirmation(true);
  }

  function handleCancel() {
    setShowConfirmation(false);
    setReason('');
  }

  return (
    <div
      css={css`
        max-width: 33rem;
        margin-top: 3rem;
        padding: 1rem;
        border-radius: 0.25rem;
        border: 1px solid #ea001e;
      `}
    >
      <Grid verticalAlign="center" className="slds-m-bottom_small">
        <Icon
          type="utility"
          icon="error"
          className="slds-icon slds-icon-text-error slds-m-right_small slds-icon_small"
          containerClassname="slds-icon_container slds-icon-utility-error"
        />
        <div className="slds-text-heading_medium slds-text-color_destructive">Danger Zone</div>
      </Grid>
      <p className=" slds-m-bottom_small">Would you like to delete your account and all of your stored data?</p>
      <p className=" slds-m-bottom_small">Any active subscriptions will be cancelled at the end of your current billing period.</p>
      {!showConfirmation && (
        <button className="slds-button slds-button_text-destructive" onClick={handleInitialDelete}>
          Delete Account
        </button>
      )}
      {showConfirmation && (
        <Grid vertical>
          <div className="slds-text-color_destructive">
            <p>Are you sure you want to delete your account?</p>
            <p>This action is not reversible.</p>
          </div>
          <div>
            <Textarea
              id="delete-confirmation"
              className="slds-m-vertical_small"
              label="Do you have any feedback you would like to provide?"
            >
              <textarea
                id="delete-confirmation"
                className="slds-textarea"
                value={reason}
                rows={5}
                onChange={(event) => setReason(event.target.value)}
              />
            </Textarea>
          </div>
          <div>
            <button className="slds-button slds-button_neutral" onClick={handleCancel}>
              Cancel
            </button>
            <button className="slds-button slds-button_destructive" onClick={() => onDeleteAccount(reason)}>
              Yes, Permanently Delete My Account
            </button>
          </div>
        </Grid>
      )}
    </div>
  );
};

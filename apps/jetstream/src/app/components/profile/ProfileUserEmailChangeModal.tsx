import { EMAIL_MAX_LENGTH, EmailSchema } from '@jetstream/types';
import { Input, Modal, ReadOnlyFormItem, ScopedNotification, Spinner } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';

export interface ProfileUserEmailChangeModalProps {
  currentEmail: string;
  /** Resolves false when the user dismissed the step-up prompt, so the form can stay open. */
  onRequestEmailChange: (newEmail: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * A modal rather than an inline row: requesting a change immediately hands off to the step-up prompt,
 * and an inline form also let the user open the name editor at the same time and submit whichever
 * they forgot about.
 */
export const ProfileUserEmailChangeModal: FunctionComponent<ProfileUserEmailChangeModalProps> = ({
  currentEmail,
  onRequestEmailChange,
  onClose,
}) => {
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailValidation = EmailSchema.safeParse(newEmail);
  const isSameAsCurrent = emailValidation.success && emailValidation.data === currentEmail.toLowerCase();
  const canSubmit = !isLoading && emailValidation.success && !isSameAsCurrent;

  /**
   * Kept free of any event argument because it is driven from two places that pass different events:
   * the form's onSubmit (Enter in the input) and the footer button's onClick. The footer is rendered
   * outside the form by Modal, so the button cannot rely on submit semantics.
   */
  async function submitEmailChange() {
    if (!emailValidation.success || isSameAsCurrent) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (await onRequestEmailChange(emailValidation.data)) {
        onClose();
        return;
      }
      setIsLoading(false);
    } catch (ex) {
      setErrorMessage(ex instanceof Error ? ex.message : 'There was a problem requesting the change');
      setIsLoading(false);
    }
  }

  return (
    <Modal
      testId="email-change-modal"
      header="Change email address"
      // While a request is in flight the step-up prompt is stacked on top of this modal - dismissing
      // the one underneath would leave that prompt orphaned over an empty page.
      closeDisabled={isLoading}
      closeOnEsc={!isLoading}
      closeOnBackdropClick={!isLoading}
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" onClick={submitEmailChange} disabled={!canSubmit} type="button">
            Send confirmation
          </button>
        </Fragment>
      }
      onClose={onClose}
    >
      <div className="slds-is-relative">
        {isLoading && <Spinner />}
        {errorMessage && (
          <ScopedNotification theme="error" className="slds-m-bottom_small">
            {errorMessage}
          </ScopedNotification>
        )}

        <ReadOnlyFormItem label="Current email address" omitEdit>
          {currentEmail}
        </ReadOnlyFormItem>

        <form
          className="slds-m-top_small"
          onSubmit={(event) => {
            event.preventDefault();
            void submitEmailChange();
          }}
        >
          <Input
            id="new-email"
            label="New email address"
            hasError={!!newEmail && (!emailValidation.success || isSameAsCurrent)}
            errorMessage={isSameAsCurrent ? 'This is already your email address' : 'Enter a valid email address'}
          >
            <input
              id="new-email"
              className="slds-input"
              type="email"
              autoComplete="email"
              maxLength={EMAIL_MAX_LENGTH}
              required
              autoFocus
              disabled={isLoading}
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
            />
          </Input>
        </form>

        <p className="slds-text-body_small slds-m-top_small">
          We'll send a confirmation link to the new address. Your email address will not change until you open that link, and we'll notify
          your current address so you can stop a change you did not make.
        </p>
      </div>
    </Modal>
  );
};

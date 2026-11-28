import { CopyToClipboard, Grid, Modal, ScopedNotification } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import type { GeneratedCredentials } from '../scratch-org.types';

export interface CredentialsModalProps {
  credentials: GeneratedCredentials;
  onClose: () => void;
}

const CredentialRow: FunctionComponent<{ label: string; value: string }> = ({ label, value }) => (
  <div className="slds-form-element slds-m-bottom_small">
    <span className="slds-form-element__label">{label}</span>
    <Grid verticalAlign="center" className="slds-form-element__control">
      <code className="slds-truncate slds-p-around_xx-small slds-grow">{value}</code>
      <CopyToClipboard className="slds-m-left_x-small" type="button" buttonText={`Copy ${label}`} content={value} />
    </Grid>
  </div>
);

/**
 * Shows a generated password once. It is not stored anywhere, closing this is the last time it can be seen.
 */
export const CredentialsModal: FunctionComponent<CredentialsModalProps> = ({ credentials, onClose }) => {
  const { username, password, loginUrl } = credentials;
  return (
    <Modal
      header="Password Generated"
      size="sm"
      closeOnBackdropClick={false}
      footer={
        <button className="slds-button slds-button_brand" onClick={onClose}>
          Done
        </button>
      }
      onClose={onClose}
    >
      <ScopedNotification theme="warning" className="slds-m-bottom_small">
        Copy the password now. Jetstream does not store it, so it cannot be shown again. You can always generate a new one.
      </ScopedNotification>
      <CredentialRow label="Username" value={username} />
      <CredentialRow label="Password" value={password} />
      <CredentialRow label="Login URL" value={loginUrl} />
    </Modal>
  );
};

export default CredentialsModal;

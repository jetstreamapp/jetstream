import { css } from '@emotion/react';
import { getErrorMessage } from '@jetstream/shared/utils';
import { CustomPermissionRecord, SalesforceOrgUi } from '@jetstream/types';
import { Grid, Input, Modal, ScopedNotification, Spinner, Textarea } from '@jetstream/ui';
import { ConfirmPageChange } from '@jetstream/ui-core';
import { FormEvent, FunctionComponent, useState } from 'react';
import {
  CUSTOM_PERMISSION_DESCRIPTION_MAX_LENGTH,
  CUSTOM_PERMISSION_NAME_MAX_LENGTH,
  createCustomPermission,
  generateCustomPermissionApiName,
  isValidCustomPermissionApiName,
} from './utils/custom-permission-create-utils';

export interface CreateCustomPermissionModalProps {
  selectedOrg: SalesforceOrgUi;
  apiVersion: string;
  onClose: () => void;
  /** Called instead of `onClose` once the custom permission exists in Salesforce */
  onCreated: (record: CustomPermissionRecord) => void;
}

/**
 * Creates a custom permission through a metadata deployment, so it can be assigned straight away from the
 * Custom Permissions tab without a trip to Setup.
 */
export const CreateCustomPermissionModal: FunctionComponent<CreateCustomPermissionModalProps> = ({
  selectedOrg,
  apiVersion,
  onClose,
  onCreated,
}) => {
  const [label, setLabel] = useState('');
  /** The API Name follows the label until the user edits it */
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const name = nameOverride ?? generateCustomPermissionApiName(label);
  const nameIsValid = !name || isValidCustomPermissionApiName(name);
  const canSave = !saving && !!label.trim() && !!name && nameIsValid;

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!canSave) {
      return;
    }
    try {
      setSaving(true);
      setErrorMessage(null);
      const record = await createCustomPermission(
        selectedOrg,
        apiVersion,
        { label: label.trim(), name, description: description.trim() },
        setProgressMessage,
      );
      onCreated(record);
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex));
    } finally {
      setSaving(false);
      setProgressMessage(null);
    }
  }

  function handleClose() {
    if (!saving) {
      onClose();
    }
  }

  return (
    <>
      <ConfirmPageChange actionInProgress={saving} />
      <Modal
        testId="create-custom-permission-modal"
        header="New Custom Permission"
        tagline="Create a custom permission, then grant it to profiles and permission sets from the table"
        size="sm"
        closeOnEsc={!saving}
        closeOnBackdropClick={false}
        closeDisabled={saving}
        footer={
          <Grid align="end">
            <button className="slds-button slds-button_neutral" onClick={handleClose} disabled={saving}>
              Cancel
            </button>
            <button className="slds-button slds-button_brand" form="create-custom-permission-form" type="submit" disabled={!canSave}>
              Create
            </button>
          </Grid>
        }
        onClose={handleClose}
      >
        <div
          className="slds-is-relative"
          css={css`
            min-height: 14rem;
          `}
        >
          {saving && <Spinner />}
          {progressMessage && (
            <p className="slds-text-align_center slds-text-color_weak slds-m-bottom_small" role="status">
              {progressMessage}…
            </p>
          )}
          {errorMessage && (
            <ScopedNotification theme="error" className="slds-m-bottom_small">
              {errorMessage}
            </ScopedNotification>
          )}
          <form id="create-custom-permission-form" onSubmit={handleSubmit}>
            <Input id="custom-permission-label" label="Label" isRequired>
              <input
                id="custom-permission-label"
                className="slds-input"
                value={label}
                maxLength={CUSTOM_PERMISSION_NAME_MAX_LENGTH}
                required
                autoFocus
                disabled={saving}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Input>

            <Input
              id="custom-permission-name"
              label="API Name"
              isRequired
              className="slds-m-top_small"
              hasError={!nameIsValid}
              errorMessageId="custom-permission-name-error"
              errorMessage="The API Name must begin with a letter, contain only letters, numbers and single underscores, and cannot end with an underscore."
              helpText={
                selectedOrg.orgNamespacePrefix
                  ? `The org namespace (${selectedOrg.orgNamespacePrefix}__) is added by Salesforce automatically.`
                  : undefined
              }
            >
              <input
                id="custom-permission-name"
                className="slds-input"
                value={name}
                maxLength={CUSTOM_PERMISSION_NAME_MAX_LENGTH}
                required
                disabled={saving}
                aria-describedby={!nameIsValid ? 'custom-permission-name-error' : undefined}
                onChange={(event) => setNameOverride(event.target.value)}
              />
            </Input>

            <Textarea id="custom-permission-description" label="Description" className="slds-m-top_small">
              <textarea
                id="custom-permission-description"
                className="slds-textarea"
                value={description}
                rows={2}
                maxLength={CUSTOM_PERMISSION_DESCRIPTION_MAX_LENGTH}
                disabled={saving}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Textarea>
          </form>
        </div>
      </Modal>
    </>
  );
};

export default CreateCustomPermissionModal;

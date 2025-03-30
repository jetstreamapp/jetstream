import { useSentry } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { JetstreamOrganizationCreateUpdatePayload, JetstreamOrganizationWithOrgs, Maybe } from '@jetstream/types';
import { fireToast, Grid, Input, Modal, Textarea } from '@jetstream/ui';
import { ConfirmPageChange } from '@jetstream/ui-core';
import { useEffect, useRef, useState } from 'react';

interface OrganizationModalProps {
  organization?: Maybe<JetstreamOrganizationWithOrgs>;
  onSubmit: (organization: JetstreamOrganizationCreateUpdatePayload) => Promise<void>;
  onClose: () => void;
}

export function OrganizationModal({ organization, onSubmit, onClose }: OrganizationModalProps) {
  const isMounted = useRef(true);
  const sentry = useSentry();
  const [loading, setLoading] = useState(false);
  const [updatedOrg, setUpdatedOrg] = useState(() => ({
    name: organization?.name || '',
    description: organization?.description || '',
  }));
  const isCreate = !organization;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleSubmit() {
    try {
      await onSubmit(updatedOrg);
      onClose();
    } catch (ex) {
      fireToast({ message: `There was an error creating the organization. ${getErrorMessage(ex)}`, type: 'error' });
      sentry.trackError('OrganizationModal: Error creating organization', ex, 'OrganizationModal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      header={isCreate ? 'Create Organization' : 'Edit Organization'}
      closeDisabled={loading}
      closeOnBackdropClick={false}
      closeOnEsc={false}
      footer={
        <Grid align="spread">
          <div>
            <button type="button" className="slds-button slds-button_neutral" disabled={loading} onClick={onClose}>
              Close
            </button>
            <button type="submit" form="organization-form" className="slds-button slds-button_brand" disabled={loading}>
              Save
            </button>
          </div>
        </Grid>
      }
      size="sm"
      onClose={onClose}
    >
      <div className="slds-is-relative">
        <ConfirmPageChange actionInProgress={loading} />
        <form
          id="organization-form"
          onSubmit={(ev) => {
            ev.preventDefault();
            handleSubmit();
          }}
        >
          <Input label="Name" isRequired hasError={false} errorMessageId="Error" errorMessage="This is not valid">
            <input
              id="organization-name"
              className="slds-input"
              value={updatedOrg.name}
              required
              minLength={1}
              maxLength={60}
              onChange={(event) => setUpdatedOrg((prevValue) => ({ ...prevValue, name: event.target.value }))}
              disabled={loading}
            />
          </Input>
          <Textarea id="org-description" label="Description">
            <textarea
              id="organization-description"
              className="slds-input"
              value={updatedOrg.description}
              rows={2}
              maxLength={255}
              onChange={(event) => setUpdatedOrg((prevValue) => ({ ...prevValue, description: event.target.value }))}
              disabled={loading}
            />
          </Textarea>
        </form>
      </div>
    </Modal>
  );
}

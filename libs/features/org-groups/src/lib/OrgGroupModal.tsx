import { useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe, OrgGroupCreateUpdatePayload, OrgGroupWithOrgs } from '@jetstream/types';
import { fireToast, Grid, Input, Modal, Textarea } from '@jetstream/ui';
import { ConfirmPageChange } from '@jetstream/ui-core';
import { useEffect, useRef, useState } from 'react';

interface OrgGroupModalProps {
  orgGroup?: Maybe<OrgGroupWithOrgs>;
  onSubmit: (orgGroup: OrgGroupCreateUpdatePayload, groupToUpdateId?: string) => Promise<void>;
  onClose: () => void;
}

export function OrgGroupModal({ orgGroup, onSubmit, onClose }: OrgGroupModalProps) {
  const isMounted = useRef(true);
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(false);
  const [updatedOrg, setUpdatedOrg] = useState(() => ({
    name: orgGroup?.name || '',
    description: orgGroup?.description || '',
  }));
  const isCreate = !orgGroup;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleSubmit() {
    try {
      await onSubmit(updatedOrg, orgGroup?.id);
      onClose();
    } catch (ex) {
      fireToast({ message: `There was an error creating the organization. ${getErrorMessage(ex)}`, type: 'error' });
      rollbar.error('SalesforceGroupModal: Error creating organization', getErrorMessageAndStackObj(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      header={isCreate ? 'Create Group' : 'Edit Group'}
      closeDisabled={loading}
      closeOnBackdropClick={false}
      closeOnEsc={false}
      footer={
        <Grid align="spread">
          <div>
            <button type="button" className="slds-button slds-button_neutral" disabled={loading} onClick={onClose}>
              Close
            </button>
            <button type="submit" form="group-form" className="slds-button slds-button_brand" disabled={loading}>
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
          id="group-form"
          onSubmit={(ev) => {
            ev.preventDefault();
            handleSubmit();
          }}
        >
          <Input id="group-name" label="Group Name" isRequired hasError={false} errorMessageId="Error" errorMessage="This is not valid">
            <input
              id="group-name"
              name="group-name"
              className="slds-input"
              autoFocus
              value={updatedOrg.name}
              required
              minLength={1}
              maxLength={60}
              onChange={(event) => setUpdatedOrg((prevValue) => ({ ...prevValue, name: event.target.value }))}
              disabled={loading}
            />
          </Input>
          <Textarea id="group-description" label="Description">
            <textarea
              id="group-description"
              name="group-description"
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

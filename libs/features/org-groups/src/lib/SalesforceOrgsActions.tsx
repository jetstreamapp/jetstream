import { SalesforceOrgUi } from '@jetstream/types';
import { DropDown } from '@jetstream/ui';
import { useState } from 'react';
import { DeleteOrgsModal } from './DeleteOrgsModal';

interface SalesforceOrgsActionsProps {
  orgs: SalesforceOrgUi[];
  onOrgsDeleted?: () => void;
}

export const SalesforceOrgsActions = ({ orgs, onOrgsDeleted }: SalesforceOrgsActionsProps) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  function handleAction(action: string) {
    switch (action) {
      case 'DELETE_ORGS':
        setIsDeleteModalOpen(true);
        break;
    }
  }

  return (
    <>
      <DropDown
        className="slds-button_last"
        position="right"
        onSelected={handleAction}
        items={[
          {
            id: 'DELETE_ORGS',
            icon: { type: 'utility', icon: 'delete' },
            value: 'Delete Salesforce Orgs',
          },
        ]}
      />
      {isDeleteModalOpen && (
        <DeleteOrgsModal
          orgs={orgs}
          onClose={() => setIsDeleteModalOpen(false)}
          onDeleted={() => {
            setIsDeleteModalOpen(false);
            onOrgsDeleted?.();
          }}
        />
      )}
    </>
  );
};

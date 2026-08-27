import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import { DropDown } from '@jetstream/ui';
import { useAnalytics } from '@jetstream/ui-core';
import { useState } from 'react';
import { DeleteOrgsModal } from './DeleteOrgsModal';

interface SalesforceOrgsActionsProps {
  orgs: SalesforceOrgUi[];
  onOrgsDeleted?: () => void;
}

export const SalesforceOrgsActions = ({ orgs, onOrgsDeleted }: SalesforceOrgsActionsProps) => {
  const { trackEvent } = useAnalytics();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  function handleAction(action: string) {
    switch (action) {
      case 'DELETE_ORGS':
        trackEvent(ANALYTICS_KEYS.sfdc_org_delete_modal_open, {
          orgCount: orgs.length,
          orgsWithErrorCount: orgs.filter(({ connectionError }) => !!connectionError).length,
        });
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

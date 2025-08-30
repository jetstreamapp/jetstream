import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { appActionObservable } from '@jetstream/shared/ui-utils';
import { CloneEditView, SalesforceOrgUi } from '@jetstream/types';
import { Grid, RecordLookupPopover } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';

interface LastCreatedRecordProps {
  selectedOrg: SalesforceOrgUi;
  recordId: string;
}

export function LastCreatedRecord({ selectedOrg, recordId }: LastCreatedRecordProps) {
  const { trackEvent } = useAmplitude();

  const { serverUrl } = useAtomValue(applicationCookieState);
  const skipFrontDoorAuth = useAtomValue(selectSkipFrontdoorAuth);

  function handleCloneEditView(action: CloneEditView, recordId: string, sobjectName: string) {
    switch (action) {
      case 'clone':
        appActionObservable.next({ action: 'CLONE_RECORD', payload: { recordId } });
        break;
      case 'create':
        appActionObservable.next({ action: 'CREATE_RECORD', payload: { objectName: sobjectName } });
        break;
      case 'edit':
        appActionObservable.next({ action: 'EDIT_RECORD', payload: { recordId } });
        break;
      case 'view':
        appActionObservable.next({ action: 'VIEW_RECORD', payload: { recordId } });
        break;
    }
    trackEvent(ANALYTICS_KEYS.create_record_action, { action, source: 'CREATE_RECORD' });
  }

  return (
    <Grid verticalAlign="center">
      <p className="slds-m-top_xx-small slds-m-horizontal_xx-small">Last created record:</p>
      <RecordLookupPopover
        org={selectedOrg}
        serverUrl={serverUrl}
        recordId={recordId}
        skipFrontDoorAuth={skipFrontDoorAuth}
        returnUrl={`/${recordId}`}
        isTooling={false}
        onRecordAction={handleCloneEditView}
      />
    </Grid>
  );
}

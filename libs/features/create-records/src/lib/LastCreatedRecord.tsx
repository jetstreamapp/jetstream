import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { CloneEditView, SalesforceOrgUi } from '@jetstream/types';
import { Grid, RecordLookupPopover } from '@jetstream/ui';
import { useAmplitude, ViewEditCloneRecord } from '@jetstream/ui-core';
import { applicationCookieState, selectSkipFrontdoorAuth } from '@jetstream/ui/app-state';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';

interface LastCreatedRecordProps {
  selectedOrg: SalesforceOrgUi;
  recordId: string;
}

export function LastCreatedRecord({ selectedOrg, recordId }: LastCreatedRecordProps) {
  const { trackEvent } = useAmplitude();

  const { defaultApiVersion, serverUrl } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);

  const [cloneEditViewRecord, setCloneEditViewRecord] = useState<{
    action: CloneEditView;
    sobjectName: string;
    recordId: string | null;
  } | null>(null);

  function handleCloneEditView(action: CloneEditView, recordId: string, sobjectName: string) {
    setCloneEditViewRecord({
      action,
      recordId,
      sobjectName,
    });
    trackEvent(ANALYTICS_KEYS.create_record_action, { action });
  }

  function handleChangeAction(action: CloneEditView) {
    setCloneEditViewRecord((currentAction) => (currentAction ? { ...currentAction, action } : null));
  }

  async function handleCloseEditCloneModal(reloadRecords?: boolean) {
    setCloneEditViewRecord(null);
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
      {cloneEditViewRecord && (
        <ViewEditCloneRecord
          apiVersion={defaultApiVersion}
          selectedOrg={selectedOrg}
          action={cloneEditViewRecord.action}
          sobjectName={cloneEditViewRecord.sobjectName}
          recordId={cloneEditViewRecord.recordId}
          onClose={handleCloseEditCloneModal}
          onChangeAction={handleChangeAction}
        />
      )}
    </Grid>
  );
}

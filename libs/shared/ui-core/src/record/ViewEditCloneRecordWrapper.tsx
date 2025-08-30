import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal } from '@jetstream/shared/data';
import {
  appActionObservable$,
  appActionRecordEventFilter,
  convertId15To18,
  isValidSalesforceRecordId,
  recordActionModalClosedObservable,
  useObservable,
} from '@jetstream/shared/ui-utils';
import { CloneEditView, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { applicationCookieState, selectedOrgState } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue } from 'jotai';
import { FunctionComponent, useEffect, useState } from 'react';
import { ViewEditCloneRecord } from './ViewEditCloneRecord';

async function fetchSobjectName(selectedOrg: SalesforceOrgUi, recordId: string) {
  try {
    const keyPrefix = recordId.substring(0, 3);
    const describeGlobalResults = await describeGlobal(selectedOrg);
    const sobject = describeGlobalResults.data.sobjects.find((sobject) => sobject.keyPrefix === keyPrefix);
    if (!sobject) {
      return null;
    }
    if (recordId.length === 15) {
      try {
        recordId = convertId15To18(recordId);
      } catch (ex) {
        logger.warn('[ERROR] Could not convert 15 digit to 18 digit id', ex);
      }
    }
    return { recordId, sobjectName: sobject.name };
  } catch (ex) {
    return null;
  }
}

/**
 * Manages the state and behavior of the ViewEditCloneRecord component.
 * Anywhere in the app, components can emit observable events to trigger this to open.
 */
export const ViewEditCloneRecordWrapper: FunctionComponent = () => {
  const [{ defaultApiVersion }] = useAtom(applicationCookieState);
  const selectedOrg = useAtomValue(selectedOrgState);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [recordId, setRecordId] = useState<string>('');
  const [sobjectName, setSobjectName] = useState<string | null>(null);
  const [action, setAction] = useState<CloneEditView>('view');

  const appActionEvents = useObservable(appActionObservable$.pipe(appActionRecordEventFilter));

  useEffect(() => {
    if (!appActionEvents) {
      return;
    }
    let _modalOpen = false;
    let _recordId = '';
    let _sobjectName = appActionEvents.payload.objectName || '';

    switch (appActionEvents.action) {
      case 'VIEW_RECORD': {
        if (!isValidSalesforceRecordId(appActionEvents.payload.recordId)) {
          return;
        }
        setAction('view');
        _modalOpen = true;
        _recordId = appActionEvents.payload.recordId;
        break;
      }
      case 'EDIT_RECORD': {
        if (!isValidSalesforceRecordId(appActionEvents.payload.recordId)) {
          return;
        }
        setAction('edit');
        _modalOpen = true;
        _recordId = appActionEvents.payload.recordId;
        break;
      }
      case 'CREATE_RECORD': {
        setAction('create');
        _modalOpen = true;
        _sobjectName = appActionEvents.payload.objectName;
        break;
      }
      case 'CLONE_RECORD': {
        if (!isValidSalesforceRecordId(appActionEvents.payload.recordId)) {
          return;
        }
        setAction('clone');
        _modalOpen = true;
        _recordId = appActionEvents.payload.recordId;
        break;
      }
    }

    if (!_modalOpen) {
      setModalOpen(false);
      return;
    }

    // Fetch object name if needed
    if (!_sobjectName && _recordId) {
      fetchSobjectName(selectedOrg, _recordId).then((result) => {
        if (result) {
          setRecordId(result.recordId);
          setSobjectName(result.sobjectName);
          setModalOpen(true);
        }
      });
    } else if (_sobjectName && _recordId) {
      setRecordId(_recordId);
      setSobjectName(_sobjectName);
      setModalOpen(true);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appActionEvents]);

  function onActionChange(action: CloneEditView) {
    setAction(action);
  }

  function onModalClose(reloadRecords?: Maybe<boolean>) {
    const objectName = sobjectName;
    setAction('view');
    setModalOpen(false);
    setSobjectName(null);
    setRecordId('');
    recordActionModalClosedObservable.next({ objectName, reloadRecords });
  }

  if (!selectedOrg || !!selectedOrg.connectionError || !modalOpen || !sobjectName) {
    return null;
  }

  return (
    <ViewEditCloneRecord
      apiVersion={defaultApiVersion}
      selectedOrg={selectedOrg}
      action={action}
      sobjectName={sobjectName}
      recordId={recordId}
      onClose={onModalClose}
      onChangeAction={onActionChange}
    />
  );
};

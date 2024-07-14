import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { describeGlobal } from '@jetstream/shared/data';
import {
  appActionObservable$,
  appActionRecordEventFilter,
  convertId15To18,
  hasModifierKey,
  isKKey,
  isValidSalesforceRecordId,
  useGlobalEventHandler,
  useObservable,
} from '@jetstream/shared/ui-utils';
import { CloneEditView, SalesforceOrgUi } from '@jetstream/types';
import { Grid, Icon, Input, KeyboardShortcut, Popover, PopoverRef, ScopedNotification, Spinner, getModifierKey } from '@jetstream/ui';
import localforage from 'localforage';
import uniqBy from 'lodash/uniqBy';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { applicationCookieState, selectedOrgState } from '../state-management/app-state';
import { ViewEditCloneRecord } from './ViewEditCloneRecord';

type RecentRecordMap = Record<string, RecentRecord[]>;
interface RecentRecord {
  recordId: string;
  sobject: string;
  name?: string;
}

const NUM_HISTORY_ITEMS = 10;

export const RecordSearchPopover: FunctionComponent = () => {
  const popoverRef = useRef<PopoverRef>(null);
  const retainRecordId = useRef<boolean>(false);
  const [{ defaultApiVersion }] = useRecoilState(applicationCookieState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  const [loading, setLoading] = useState<boolean>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>();
  const [modalOpen, setModalOpen] = useState<boolean>();

  const [recordId, setRecordId] = useState<string>('');
  const [sobjectName, setSobjectName] = useState<string | null>(null);
  const [action, setAction] = useState<CloneEditView>('view');

  const appActionEvents = useObservable(appActionObservable$.pipe(appActionRecordEventFilter));

  useEffect(() => {
    if (appActionEvents && appActionEvents.action === 'VIEW_RECORD' && isValidSalesforceRecordId(appActionEvents.payload.recordId)) {
      handleSubmit(null, appActionEvents.payload.recordId);
      setRecordId(appActionEvents.payload.recordId);
      setAction('view');
    } else if (appActionEvents && appActionEvents.action === 'EDIT_RECORD' && isValidSalesforceRecordId(appActionEvents.payload.recordId)) {
      handleSubmit(null, appActionEvents.payload.recordId);
      setRecordId(appActionEvents.payload.recordId);
      setAction('edit');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appActionEvents]);

  const getRecentRecords = useCallback(async () => {
    setRecordId('');
    try {
      if (selectedOrg?.uniqueId) {
        const recentItems = (await localforage.getItem<RecentRecordMap>(INDEXED_DB.KEYS.userPreferences)) || {};
        setRecentRecords(recentItems[selectedOrg.uniqueId] || []);
      }
    } catch (ex) {
      logger.warn('[ERROR] Could not get recent record history', ex);
    }
  }, [selectedOrg]);

  useEffect(() => {
    getRecentRecords();
  }, [getRecentRecords, selectedOrg]);

  const onKeydown = useCallback((event: KeyboardEvent) => {
    if (hasModifierKey(event as any) && isKKey(event as any)) {
      event.stopPropagation();
      event.preventDefault();
      popoverRef.current?.open();
    }
  }, []);

  useGlobalEventHandler('keydown', onKeydown);

  function setFromHistory(recordId) {
    setRecordId(recordId);
    handleSubmit(null, recordId);
  }

  async function handleSubmit(event?: React.FormEvent<HTMLFormElement> | null, _recordId?: string) {
    try {
      if (event) {
        event.preventDefault();
      }
      _recordId = _recordId || recordId;
      setErrorMessage(null);
      setSobjectName(null);
      setLoading(true);
      const keyPrefix = _recordId.substring(0, 3);
      const describeGlobalResults = await describeGlobal(selectedOrg);
      const sobject = describeGlobalResults.data.sobjects.find((sobject) => sobject.keyPrefix === keyPrefix);
      if (!sobject) {
        setErrorMessage(`An object with the prefix "${keyPrefix}" was not found.`);
        return;
      }
      if (recordId.length === 15) {
        try {
          _recordId = convertId15To18(_recordId);
          setRecordId(_recordId);
        } catch (ex) {
          logger.warn('[ERROR] Could not convert 15 digit to 18 digit id', ex);
        }
      }
      setLoading(false);
      setSobjectName(sobject.name);
      setModalOpen(true);
      saveRecentRecords(_recordId, sobject.name);
      retainRecordId.current = false;
    } catch (ex) {
      setErrorMessage('An unexpected error has occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function saveRecentRecords(recordId: string, sobject: string) {
    try {
      // TODO: we need to clear this out when a user deletes their org
      const recentItems = (await localforage.getItem<RecentRecordMap>(INDEXED_DB.KEYS.userPreferences)) || {};
      recentItems[selectedOrg.uniqueId] = recentItems[selectedOrg.uniqueId] || [];
      recentItems[selectedOrg.uniqueId].unshift({ recordId, sobject });
      recentItems[selectedOrg.uniqueId] = uniqBy(recentItems[selectedOrg.uniqueId], 'recordId').slice(0, NUM_HISTORY_ITEMS);
      setRecentRecords(recentItems[selectedOrg.uniqueId]);
      await localforage.setItem<RecentRecordMap>(INDEXED_DB.KEYS.userPreferences, recentItems);
    } catch (ex) {
      logger.warn('[ERROR] Could not save recent record history', ex);
    }
  }

  function onActionChange(action: CloneEditView) {
    setAction(action);
  }

  function onModalClose() {
    setAction('view');
    setModalOpen(false);
    if (!retainRecordId.current) {
      setRecordId('');
    }
  }

  async function onFetch(recordId: string, record: any) {
    try {
      if (recordId && record?.Name) {
        const recentItems = (await localforage.getItem<RecentRecordMap>(INDEXED_DB.KEYS.userPreferences)) || {};
        if (Array.isArray(recentItems[selectedOrg.uniqueId])) {
          recentItems[selectedOrg.uniqueId] = recentItems[selectedOrg.uniqueId].map((item) =>
            item.recordId !== recordId ? item : { ...item, name: record.Name }
          );
          setRecentRecords(recentItems[selectedOrg.uniqueId]);
          await localforage.setItem<RecentRecordMap>(INDEXED_DB.KEYS.userPreferences, recentItems);
        }
      }
    } catch (ex) {
      logger.warn('[ERROR] Could not remove invalid recent record history', ex);
    }
  }

  async function onFetchError(recordId: string, sobjectName: string) {
    try {
      retainRecordId.current = true;
      setRecordId(recordId);
      const recentItems = (await localforage.getItem<RecentRecordMap>(INDEXED_DB.KEYS.userPreferences)) || {};
      if (Array.isArray(recentItems[selectedOrg.uniqueId])) {
        recentItems[selectedOrg.uniqueId] = recentItems[selectedOrg.uniqueId].filter((item) => item.recordId !== recordId);
        setRecentRecords(recentItems[selectedOrg.uniqueId]);
        await localforage.setItem<RecentRecordMap>(INDEXED_DB.KEYS.userPreferences, recentItems);
      }
    } catch (ex) {
      logger.warn('[ERROR] Could not remove invalid recent record history', ex);
    }
  }

  const isDisabled = !recordId || (recordId.length !== 15 && recordId.length !== 18);

  if (!selectedOrg || !!selectedOrg.connectionError) {
    return null;
  }

  return (
    <Fragment>
      {modalOpen && sobjectName && (
        <ViewEditCloneRecord
          apiVersion={defaultApiVersion}
          selectedOrg={selectedOrg}
          action={action}
          sobjectName={sobjectName}
          recordId={recordId}
          onClose={onModalClose}
          onChangeAction={onActionChange}
          onFetch={onFetch}
          onFetchError={onFetchError}
        />
      )}
      <Popover
        ref={popoverRef}
        size="large"
        header={
          <header className="slds-popover__header slds-grid">
            <h2 className="slds-text-heading_small">View Record Details</h2>
            <KeyboardShortcut className="slds-m-left_x-small" keys={[getModifierKey(), 'k']} />
          </header>
        }
        content={
          <div className="slds-popover__body slds-p-around_none slds-is-relative">
            {loading && <Spinner />}
            {errorMessage && (
              <div className="slds-m-around-medium">
                <ScopedNotification theme="error" className="slds-m-top_medium">
                  {errorMessage}
                </ScopedNotification>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <Grid verticalAlign="end">
                <Input label="Record Id" className="slds-grow">
                  <input
                    className="slds-input"
                    max={18}
                    min={15}
                    value={recordId}
                    placeholder="15 or 18 digit record id"
                    autoComplete="off"
                    autoFocus
                    onChange={(event) => setRecordId(event.target.value.trim())}
                  />
                </Input>
                <div>
                  <button
                    type="submit"
                    className="slds-button slds-button_brand slds-m-left_x-small"
                    disabled={isDisabled}
                    onClick={() => handleSubmit()}
                  >
                    Submit
                  </button>
                </div>
              </Grid>
            </form>
            {!!recentRecords?.length && (
              <Fragment>
                <h2 className="slds-text-heading_small slds-m-top_small" title="Refresh Metadata">
                  Recent Records
                </h2>
                <ul className="slds-has-dividers_top-space slds-dropdown_length-10">
                  {recentRecords.map((recentRecord) => (
                    <li
                      key={recentRecord.recordId}
                      className="slds-item slds-text-link"
                      onClick={() => setFromHistory(recentRecord.recordId)}
                    >
                      <div className="slds-truncate" title={recentRecord.recordId}>
                        {recentRecord.recordId} {recentRecord.name && <span title={recentRecord.name}>- {recentRecord.name}</span>}
                      </div>
                      <div className="slds-truncate slds-text-color_weak" title={recentRecord.sobject}>
                        {recentRecord.sobject}
                      </div>
                    </li>
                  ))}
                </ul>
              </Fragment>
            )}
          </div>
        }
        buttonProps={{
          className:
            'slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__help slds-global-actions__item-action cursor-pointer',
          title: 'View Record Details - ctrl/command + k',
          disabled: !selectedOrg || !!selectedOrg.connectionError,
        }}
      >
        <Icon type="utility" icon="record_lookup" className="slds-button__icon slds-global-header__icon" omitContainer />
      </Popover>
    </Fragment>
  );
};

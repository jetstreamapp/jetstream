import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal } from '@jetstream/shared/data';
import { appActionObservable, convertId15To18, hasModifierKey, isKKey, useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import { getModifierKey, Grid, Icon, Input, KeyboardShortcut, Popover, PopoverRef, ScopedNotification, Spinner } from '@jetstream/ui';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { addRecentRecordToStorage, getRecentRecordsFromStorage, RecentRecord } from './record-utils';

export const RecordSearchPopover: FunctionComponent = () => {
  const popoverRef = useRef<PopoverRef>(null);
  const retainRecordId = useRef<boolean>(false);
  const selectedOrg = useAtomValue(selectedOrgState);

  const [loading, setLoading] = useState<boolean>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>();
  const [recordId, setRecordId] = useState<string>('');

  const getRecentRecords = useCallback(async () => {
    setRecordId('');
    try {
      if (selectedOrg?.uniqueId) {
        const recentItems = await getRecentRecordsFromStorage();
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
      saveRecentRecords(_recordId, sobject.name);
      retainRecordId.current = false;
      appActionObservable.next({ action: 'VIEW_RECORD', payload: { recordId: _recordId } });
      popoverRef.current?.close();
    } catch (ex) {
      setErrorMessage('An unexpected error has occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function saveRecentRecords(recordId: string, sobject: string) {
    try {
      // TODO: we need to clear this out when a user deletes their org
      const orgRecentRecords = await addRecentRecordToStorage({ recordId, sobject }, selectedOrg.uniqueId);
      setRecentRecords(orgRecentRecords);
    } catch (ex) {
      logger.warn('[ERROR] Could not save recent record history', ex);
    }
  }

  const isDisabled = !recordId || (recordId.length !== 15 && recordId.length !== 18);

  if (!selectedOrg?.uniqueId || !!selectedOrg.connectionError) {
    return null;
  }

  return (
    <Popover
      ref={popoverRef}
      size="large"
      onChange={(isOpen) => {
        if (isOpen) {
          getRecentRecordsFromStorage().then((recentRecords) => setRecentRecords(recentRecords[selectedOrg.uniqueId] || []));
        }
      }}
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
              <Input id="record-id" label="Record Id" className="slds-grow">
                <input
                  id="record-id-input"
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
  );
};

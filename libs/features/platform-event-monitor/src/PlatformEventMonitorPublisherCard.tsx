import { mockPicklistValuesFromSobjectDescribe, UiRecordForm } from '@jetstream/record-form';
import { clearCacheForOrg, describeSObject } from '@jetstream/shared/data';
import { useReducerFetchFn } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { DescribeSObjectResult, ListItem, Maybe, PicklistFieldValues, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import { Card, ComboboxWithItems, Grid, Icon, ScopedNotification, Spinner, Tooltip } from '@jetstream/ui';
import { formatRelative } from 'date-fns';
import { Fragment, FunctionComponent, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { PlatformEventObject } from './platform-event-monitor.types';

export interface PlatformEventMonitorPublisherCardProps {
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
  loadingPlatformEvents: boolean;
  picklistKey: string | number;
  platformEventsList: ListItem<string, PlatformEventObject>[];
  selectedPublishEvent: Maybe<string>;
  onSelectedPublishEvent: (id: string) => void;
  publish: (platformEventName: string, data: any) => Promise<string>;
}

export const PlatformEventMonitorPublisherCard: FunctionComponent<PlatformEventMonitorPublisherCardProps> = ({
  selectedOrg,
  loadingPlatformEvents,
  picklistKey,
  platformEventsList,
  selectedPublishEvent,
  onSelectedPublishEvent,
  publish,
}) => {
  const isMounted = useRef(true);

  const [
    {
      hasLoaded: sobjectDescribeLoaded,
      loading: sobjectDescribeLoading,
      data: sobjectDescribeData,
      hasError: sobjectDescribeError,
      errorMessage: sobjectDescribeErrorMsg,
    },
    dispatchSobjectDescribe,
  ] = useReducer(useReducerFetchFn<{ describe: DescribeSObjectResult; lastRefreshed: string; picklistValues: PicklistFieldValues }>(), {
    hasLoaded: false,
    loading: false,
    hasError: false,
    data: null,
  });

  const [publishLoading, setPublishLoading] = useState(false);
  const [publishKey, setPublishKey] = useState<number>(1);
  const [publishEventRecord, setPublishEventRecord] = useState<SalesforceRecord>({});
  const [publishEventResponse, setPublishEventResponse] = useState<{ success: boolean; eventId?: string; errorMessage?: string } | null>(
    null
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchSobjectDescribe = useCallback(
    async (clearCache = false) => {
      try {
        if (!selectedPublishEvent) {
          return null;
        }
        dispatchSobjectDescribe({ type: 'REQUEST' });
        if (clearCache) {
          await clearCacheForOrg(selectedOrg);
        }
        const results = await describeSObject(selectedOrg, selectedPublishEvent);
        const picklistValues = mockPicklistValuesFromSobjectDescribe(results.data);
        // remove readonly fields
        results.data.fields = results.data.fields.filter((field) => field.createable);
        if (!isMounted.current) {
          return;
        }
        dispatchSobjectDescribe({
          type: 'SUCCESS',
          payload: {
            describe: results.data,
            lastRefreshed: `Last updated ${formatRelative(results.cache?.age || new Date().getTime(), new Date())}`,
            picklistValues,
          },
        });
      } catch (ex) {
        // ignore error if component is unmounted or if user changes org
        if (!isMounted.current || getErrorMessage(ex) === 'The requested resource does not exist') {
          return;
        }
        dispatchSobjectDescribe({ type: 'ERROR', payload: { errorMessage: getErrorMessage(ex) } });
      }
    },
    [selectedOrg, selectedPublishEvent]
  );

  useEffect(() => {
    if (selectedPublishEvent) {
      fetchSobjectDescribe();
      setPublishEventResponse(null);
    }
  }, [fetchSobjectDescribe, selectedOrg, selectedPublishEvent]);

  const publishEvent = useCallback(
    async (record: SalesforceRecord) => {
      if (!selectedPublishEvent) {
        return;
      }
      try {
        setPublishLoading(true);
        const results = await publish(selectedPublishEvent, record);
        if (isMounted.current) {
          setPublishEventResponse({ success: true, eventId: results });
        }
      } catch (ex) {
        if (isMounted.current) {
          setPublishEventResponse({ success: false, errorMessage: getErrorMessage(ex) });
        }
      } finally {
        if (isMounted.current) {
          setPublishLoading(false);
        }
      }
    },
    [publish, selectedPublishEvent]
  );

  function handlePlatformEventChange(item: ListItem<string, any>) {
    onSelectedPublishEvent(item.id);
    clearForm();
  }

  function clearForm() {
    setPublishEventRecord({});
    setPublishKey((key) => key + 1);
  }

  return (
    <Card
      testId="platform-event-monitor-publisher-card"
      className="slds-grow"
      icon={{ type: 'standard', icon: 'record_create' }}
      title="Publish Event"
      actions={
        <button
          className="slds-button slds-button_brand slds-is-relative"
          disabled={!sobjectDescribeLoaded || !sobjectDescribeData}
          onClick={() => publishEvent(publishEventRecord)}
        >
          Publish Event
          {publishLoading && <Spinner className="slds-spinner slds-spinner_small" />}
        </button>
      }
    >
      {(loadingPlatformEvents || sobjectDescribeLoading) && <Spinner />}
      <Grid vertical>
        <Grid verticalAlign="end">
          <div className="slds-grow">
            <ComboboxWithItems
              key={picklistKey}
              comboboxProps={{
                label: 'Platform Events',
                itemLength: 10,
              }}
              items={platformEventsList}
              selectedItemId={selectedPublishEvent}
              onSelected={handlePlatformEventChange}
            />
          </div>
        </Grid>
        {publishEventResponse && publishEventResponse.success && (
          <div className="slds-m-top_x-small">
            <ScopedNotification theme="success">Event Id: {publishEventResponse.eventId}</ScopedNotification>
          </div>
        )}
        {publishEventResponse && !publishEventResponse.success && (
          <div className="slds-m-top_x-small">
            <ScopedNotification theme="error">
              There was an error publishing your event:
              <p>{publishEventResponse.errorMessage}</p>
            </ScopedNotification>
          </div>
        )}
        {sobjectDescribeError && (
          <div className="slds-m-top_x-small">
            <ScopedNotification theme="error">
              There was a problem loading the fields for the event:
              <p>{sobjectDescribeErrorMsg}</p>
            </ScopedNotification>
          </div>
        )}
        <div>
          {sobjectDescribeLoaded && sobjectDescribeData && (
            <Fragment>
              {!!sobjectDescribeData.describe.fields.length && (
                <Fragment>
                  <UiRecordForm
                    key={publishKey}
                    action="create"
                    sobjectFields={sobjectDescribeData.describe.fields}
                    picklistValues={sobjectDescribeData.picklistValues}
                    record={publishEventRecord}
                    onChange={setPublishEventRecord}
                  />
                  <Grid align="end" className="slds-m-right_xx-small">
                    <button className="slds-button slds-button_neutral" onClick={clearForm}>
                      <Icon type="utility" icon="clear" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Clear Form
                    </button>
                  </Grid>
                </Fragment>
              )}
              {!sobjectDescribeData.describe.fields.length && (
                <div className="slds-m-top_medium">
                  This platform event does not have any custom fields.
                  <Tooltip id={`sobject-list-refresh-tooltip`} content={sobjectDescribeData.lastRefreshed}>
                    <button
                      className="slds-button slds-button_icon slds-button_icon-container"
                      disabled={loadingPlatformEvents}
                      onClick={() => fetchSobjectDescribe(true)}
                    >
                      <Icon type="utility" icon="refresh" className="slds-button__icon" omitContainer />
                    </button>
                  </Tooltip>
                </div>
              )}
            </Fragment>
          )}
        </div>
      </Grid>
    </Card>
  );
};

export default PlatformEventMonitorPublisherCard;

import { mockPicklistValuesFromSobjectDescribe, UiRecordForm } from '@jetstream/record-form';
import { clearCacheForOrg, describeSObject } from '@jetstream/shared/data';
import { useReducerFetchFn } from '@jetstream/shared/ui-utils';
import { ListItem, PicklistFieldValues, Record, SalesforceOrgUi } from '@jetstream/types';
import { Card, Grid, Icon, Picklist, ScopedNotification, Spinner, Tooltip } from '@jetstream/ui';
import { formatRelative } from 'date-fns';
import type { DescribeGlobalSObjectResult, DescribeSObjectResult } from 'jsforce';
import { Fragment, FunctionComponent, useCallback, useEffect, useReducer, useRef, useState } from 'react';

export interface PlatformEventMonitorPublisherCardProps {
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
  loadingPlatformEvents: boolean;
  picklistKey: string | number;
  platformEventsList: ListItem<string, DescribeGlobalSObjectResult>[];
  selectedPublishEvent: string;
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
  const isMounted = useRef(null);

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
  const [publishEventRecord, setPublishEventRecord] = useState<Record>({});
  const [publishEventResponse, setPublishEventResponse] = useState<{ success: boolean; eventId?: string; errorMessage?: string }>();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedPublishEvent) {
      fetchSobjectDescribe();
      setPublishEventResponse(null);
    }
  }, [selectedOrg, selectedPublishEvent]);

  const fetchSobjectDescribe = useCallback(
    async (clearCache = false) => {
      dispatchSobjectDescribe({ type: 'REQUEST' });
      if (clearCache) {
        await clearCacheForOrg(selectedOrg);
      }
      const results = await describeSObject(selectedOrg, selectedPublishEvent);
      const picklistValues = mockPicklistValuesFromSobjectDescribe(results.data);
      // remove readonly fields
      results.data.fields = results.data.fields.filter((field) => field.createable);
      dispatchSobjectDescribe({
        type: 'SUCCESS',
        payload: { describe: results.data, lastRefreshed: `Last updated ${formatRelative(results.cache.age, new Date())}`, picklistValues },
      });
    },
    [selectedOrg, selectedPublishEvent]
  );

  const publishEvent = useCallback(
    async (record: Record) => {
      try {
        setPublishLoading(true);
        const results = await publish(selectedPublishEvent, record);
        if (isMounted.current) {
          // clear record and reset form
          setPublishEventRecord({});
          setPublishKey((key) => key + 1);
          setPublishEventResponse({ success: true, eventId: results });
        }
      } catch (ex) {
        if (isMounted.current) {
          setPublishEventResponse({ success: false, errorMessage: ex.message });
        }
      } finally {
        if (isMounted.current) {
          setPublishLoading(false);
        }
      }
    },
    [selectedOrg, selectedPublishEvent]
  );

  return (
    <Card
      className="slds-grow"
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
            <Picklist
              key={picklistKey}
              label="Platform Events"
              items={platformEventsList}
              allowDeselection={false}
              selectedItemIds={selectedPublishEvent ? [selectedPublishEvent] : undefined}
              onChange={(items) => {
                onSelectedPublishEvent(items[0].id);
              }}
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
                <UiRecordForm
                  key={publishKey}
                  action="create"
                  sobjectFields={sobjectDescribeData.describe.fields}
                  picklistValues={sobjectDescribeData.picklistValues}
                  record={publishEventRecord}
                  showReadOnlyFields
                  showFieldTypes={true}
                  onChange={setPublishEventRecord}
                />
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

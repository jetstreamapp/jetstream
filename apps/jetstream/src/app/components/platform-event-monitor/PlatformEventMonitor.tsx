/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { mockPicklistValuesFromSobjectDescribe, UiRecordForm } from '@jetstream/record-form';
import { describeSObject } from '@jetstream/shared/data';
import { useReducerFetchFn } from '@jetstream/shared/ui-utils';
import { ListItem, PicklistFieldValues, Record, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Card, Grid, Picklist, ScopedNotification, Spinner } from '@jetstream/ui';
import PlatformEventMonitorListenerCard from 'apps/jetstream/src/app/components/platform-event-monitor/PlatformEventMonitorListenerCard';
import { usePlatformEvent } from 'apps/jetstream/src/app/components/platform-event-monitor/usePlatformEvent';
import { DescribeGlobalSObjectResult, DescribeSObjectResult } from 'jsforce';
import { Fragment, FunctionComponent, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Split from 'react-split';
import { useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PlatformEventMonitorProps {}

export const PlatformEventMonitor: FunctionComponent<PlatformEventMonitorProps> = ({}) => {
  const isMounted = useRef(null);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  // TODO: include callback function of event data
  const { platformEvents, messagesByChannel, loadingPlatformEvents, publish, subscribe, unsubscribe } = usePlatformEvent({ selectedOrg });

  const [
    {
      hasLoaded: sobjectDescribeLoaded,
      loading: sobjectDescribeLoading,
      data: sobjectDescribeData,
      hasError: sobjectDescribeError,
      errorMessage: sobjectDescribeErrorMsg,
    },
    dispatchSobjectDescribe,
  ] = useReducer(useReducerFetchFn<{ describe: DescribeSObjectResult; picklistValues: PicklistFieldValues }>(), {
    hasLoaded: false,
    loading: false,
    hasError: false,
    data: null,
  });

  const [platformEventsList, setPlatformEventsList] = useState<ListItem<string, DescribeGlobalSObjectResult>[]>([]);
  const [picklistKey, setPicklistKey] = useState<number>(1);
  const [publishKey, setPublishKey] = useState<number>(1);
  const [selectedSubscribeEvent, setSelectedSubscribeEvent] = useState<string>();
  const [selectedPublishEvent, setSelectedPublishEvent] = useState<string>();
  const [publishEventRecord, setPublishEventRecord] = useState<Record>({});
  const [publishEventResponse, setPublishEventResponse] = useState<{ success: boolean; eventId?: string; errorMessage?: string }>();

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    const events = platformEvents.map<ListItem<string, DescribeGlobalSObjectResult>>((event) => ({
      id: event.name,
      label: event.label,
      secondaryLabel: event.name,
      value: event.name,
      meta: event,
    }));
    if (events.length) {
      setPlatformEventsList(events);
      setSelectedSubscribeEvent(events[0].id);
      setSelectedPublishEvent(events[0].id);
      setPicklistKey((prevKey) => prevKey + 1);
    }
  }, [platformEvents]);

  // picklistValues = mockPicklistValuesFromSobjectDescribe(sobjectMetadata.data);

  useEffect(() => {
    if (selectedPublishEvent) {
      fetchSobjectDescribe();
      setPublishEventResponse(null);
    }
  }, [selectedOrg, selectedPublishEvent]);

  const fetchSobjectDescribe = useCallback(async () => {
    dispatchSobjectDescribe({ type: 'REQUEST' });
    const results = await describeSObject(selectedOrg, selectedPublishEvent);
    const picklistValues = mockPicklistValuesFromSobjectDescribe(results.data);
    // remove readonly fields
    results.data.fields = results.data.fields.filter((field) => field.createable);
    dispatchSobjectDescribe({ type: 'SUCCESS', payload: { describe: results.data, picklistValues } });
  }, [selectedOrg, selectedPublishEvent]);

  const publishEvent = useCallback(
    async (record: Record) => {
      try {
        // TODO: loading
        const results = await publish(selectedPublishEvent, record);
        // TODO clear record and reset form
        setPublishEventRecord({});
        setPublishKey((key) => key + 1);
        setPublishEventResponse({ success: true, eventId: results });
      } catch (ex) {
        setPublishEventResponse({ success: false, errorMessage: ex.message });
      }
    },
    [selectedOrg, selectedPublishEvent]
  );

  return (
    <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none">
      <Split
        sizes={[66, 33]}
        minSize={[300, 300]}
        gutterSize={10}
        className="slds-gutters"
        css={css`
          display: flex;
          flex-direction: row;
        `}
      >
        <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-grid slds-grid_vertical">
          <PlatformEventMonitorListenerCard
            loading={loadingPlatformEvents}
            picklistKey={picklistKey}
            platformEventsList={platformEventsList}
            selectedSubscribeEvent={selectedSubscribeEvent}
            messagesByChannel={messagesByChannel}
            subscribe={subscribe}
            unsubscribe={unsubscribe}
            onSelectedSubscribeEvent={setSelectedSubscribeEvent}
          />
        </AutoFullHeightContainer>
        <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-is-relative slds-grid slds-grid_vertical">
          <Card
            className="slds-grow"
            title="Publish Event"
            actions={
              <button
                className="slds-button slds-button_brand"
                disabled={!sobjectDescribeLoaded || !sobjectDescribeData}
                onClick={() => publishEvent(publishEventRecord)}
              >
                Publish Event
              </button>
            }
          >
            {loadingPlatformEvents || (sobjectDescribeLoading && <Spinner />)}
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
                      setSelectedPublishEvent(items[0].id);
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
                      <div className="slds-m-top_medium">This platform event does not have any custom fields.</div>
                    )}
                  </Fragment>
                )}
              </div>
            </Grid>
          </Card>
        </AutoFullHeightContainer>
      </Split>
    </AutoFullHeightContainer>
  );
};

export default PlatformEventMonitor;

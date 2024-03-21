import { css } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { useNonInitialEffect, useTitle } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { ListItem, ListItemGroup, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer } from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { applicationCookieState, selectedOrgState } from '../../app-state';
import PlatformEventMonitorFetchEventStatus from './PlatformEventMonitorFetchEventStatus';
import PlatformEventMonitorListenerCard from './PlatformEventMonitorListenerCard';
import PlatformEventMonitorPublisherCard from './PlatformEventMonitorPublisherCard';
import { PlatformEventObject } from './platform-event-monitor.types';
import { usePlatformEvent } from './usePlatformEvent';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PlatformEventMonitorProps {}

export const PlatformEventMonitor: FunctionComponent<PlatformEventMonitorProps> = ({}) => {
  useTitle(TITLES.PLATFORM_EVENTS);
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const isMounted = useRef(true);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const {
    hasPlatformEvents,
    platformEventFetchError,
    platformEvents,
    messagesByChannel,
    loadingPlatformEvents,
    fetchPlatformEvents,
    publish,
    subscribe,
    unsubscribe,
  } = usePlatformEvent({ selectedOrg });
  const [platformEventsListSubscriptions, setPlatformEventsListSubscriptions] = useState<ListItemGroup<string, PlatformEventObject>[]>([]);
  const [platformEventsListPublisher, setPlatformEventsListPublisher] = useState<ListItem<string, PlatformEventObject>[]>([]);
  const [subscribedPlatformEventsList, setSubscribedPlatformEventsList] = useState<ListItem<string, PlatformEventObject>[]>([]);
  const [picklistKey, setPicklistKey] = useState<number>(1);
  const [selectedSubscribeEvent, setSelectedSubscribeEvent] = useState<string | null>(null);
  const [selectedPublishEvent, setSelectedPublishEvent] = useState<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useNonInitialEffect(() => {
    setSelectedPublishEvent(null);
  }, [selectedOrg]);

  useEffect(() => {
    const subscriptionEvents: ListItemGroup<string, PlatformEventObject>[] = [
      {
        id: 'PLATFORM_EVENT',
        label: 'Platform Events (Custom)',
        items: platformEvents
          .filter((item) => item.type === 'PLATFORM_EVENT')
          .map<ListItem<string, PlatformEventObject>>((event) => ({
            id: event.channel,
            label: `${event.label} (${event.name})`,
            secondaryLabel: event.channel,
            secondaryLabelOnNewLine: true,
            value: event.channel,
            meta: event,
          })),
      },
      {
        id: 'PLATFORM_EVENT_STANDARD',
        label: 'Platform Events (Standard)',
        items: platformEvents
          .filter((item) => item.type === 'PLATFORM_EVENT_STANDARD')
          .map<ListItem<string, PlatformEventObject>>((event) => ({
            id: event.channel,
            label: `${event.label} (${event.name})`,
            secondaryLabel: event.channel,
            secondaryLabelOnNewLine: true,
            value: event.channel,
            meta: event,
          })),
      },
      {
        id: 'CHANGE_EVENT',
        label: 'Change Data Capture Events',
        items: platformEvents
          .filter((item) => item.type === 'CHANGE_EVENT')
          .map<ListItem<string, PlatformEventObject>>((event) => ({
            id: event.channel,
            label: `${event.label} (${event.name})`,
            secondaryLabel: event.channel,
            secondaryLabelOnNewLine: true,
            value: event.channel,
            meta: event,
          })),
      },
    ];

    setPlatformEventsListSubscriptions(subscriptionEvents);
    setSelectedSubscribeEvent(platformEvents.length ? platformEvents[0].channel : null);
    setPicklistKey((prevKey) => prevKey + 1);

    const publisherEvents = platformEvents
      .filter((event) => event.type === 'PLATFORM_EVENT')
      .map<ListItem<string, PlatformEventObject>>((event) => ({
        id: event.name,
        label: event.label,
        secondaryLabel: event.name,
        secondaryLabelOnNewLine: true,
        value: event.name,
        meta: event,
      }));

    if (publisherEvents.length) {
      setPlatformEventsListPublisher(publisherEvents);
      setSelectedPublishEvent(publisherEvents[0].id);
      setPicklistKey((prevKey) => prevKey + 1);
    }
  }, [platformEvents]);

  useEffect(() => {
    setSubscribedPlatformEventsList(
      platformEventsListSubscriptions.flatMap((item) => item.items).filter((item) => !!messagesByChannel[item.value])
    );
  }, [messagesByChannel, platformEventsListSubscriptions]);

  const hasErrorOrNoEvents = !hasPlatformEvents || platformEventFetchError;

  return (
    <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" key={selectedOrg.uniqueId}>
      {hasErrorOrNoEvents && (
        <PlatformEventMonitorFetchEventStatus
          serverUrl={serverUrl}
          selectedOrg={selectedOrg}
          loadingPlatformEvents={loadingPlatformEvents}
          hasPlatformEvents={hasPlatformEvents}
          platformEventFetchError={platformEventFetchError}
          fetchPlatformEvents={fetchPlatformEvents}
        />
      )}
      {!hasErrorOrNoEvents && (
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
              platformEventsList={platformEventsListSubscriptions}
              subscribedPlatformEventsList={subscribedPlatformEventsList}
              selectedSubscribeEvent={selectedSubscribeEvent}
              messagesByChannel={messagesByChannel}
              fetchPlatformEvents={fetchPlatformEvents}
              subscribe={subscribe}
              unsubscribe={unsubscribe}
              onSelectedSubscribeEvent={setSelectedSubscribeEvent}
            />
          </AutoFullHeightContainer>
          <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-is-relative slds-grid slds-grid_vertical">
            <PlatformEventMonitorPublisherCard
              selectedOrg={selectedOrg}
              serverUrl={serverUrl}
              loadingPlatformEvents={loadingPlatformEvents}
              picklistKey={picklistKey}
              platformEventsList={platformEventsListPublisher}
              selectedPublishEvent={selectedPublishEvent}
              onSelectedPublishEvent={setSelectedPublishEvent}
              publish={publish}
            />
          </AutoFullHeightContainer>
        </Split>
      )}
    </AutoFullHeightContainer>
  );
};

export default PlatformEventMonitor;

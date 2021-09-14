/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer } from '@jetstream/ui';
import type { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import Split from 'react-split';
import { useTitle } from 'react-use';
import { useRecoilState, useRecoilValue } from 'recoil';
import { applicationCookieState, selectedOrgState } from '../../app-state';
import PlatformEventMonitorFetchEventStatus from './PlatformEventMonitorFetchEventStatus';
import PlatformEventMonitorListenerCard from './PlatformEventMonitorListenerCard';
import PlatformEventMonitorPublisherCard from './PlatformEventMonitorPublisherCard';
import { usePlatformEvent } from './usePlatformEvent';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PlatformEventMonitorProps {}

export const PlatformEventMonitor: FunctionComponent<PlatformEventMonitorProps> = ({}) => {
  useTitle(TITLES.PLATFORM_EVENTS);
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const isMounted = useRef(null);
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
  const [platformEventsList, setPlatformEventsList] = useState<ListItem<string, DescribeGlobalSObjectResult>[]>([]);
  const [picklistKey, setPicklistKey] = useState<number>(1);
  const [selectedSubscribeEvent, setSelectedSubscribeEvent] = useState<string>();
  const [selectedPublishEvent, setSelectedPublishEvent] = useState<string>();

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

  const hasErrorOrNoEvents = !hasPlatformEvents || platformEventFetchError;

  return (
    <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none">
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
              platformEventsList={platformEventsList}
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
              platformEventsList={platformEventsList}
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

import { ListItem } from '@jetstream/types';
import { Card, Grid, Pill, Spinner, ViewDocsLink } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent } from 'react';
import PlatformEventMonitorEvents from './PlatformEventMonitorEvents';
import PlatformEventMonitorSubscribe from './PlatformEventMonitorSubscribe';
import { MessagesByChannel } from './usePlatformEvent';

export interface PlatformEventMonitorListenerCardListenerCard {
  loading: boolean;
  picklistKey: string | number;
  platformEventsList: ListItem<string, DescribeGlobalSObjectResult>[];
  subscribedPlatformEventsList: ListItem<string, DescribeGlobalSObjectResult>[];
  selectedSubscribeEvent: string;
  messagesByChannel: MessagesByChannel;
  fetchPlatformEvents: (clearCache?: boolean) => void;
  subscribe: (platformEventName: string, replayId?: number) => Promise<any>;
  unsubscribe: (platformEventName: string) => Promise<any>;
  onSelectedSubscribeEvent: (id: string) => void;
}

export const PlatformEventMonitorListenerCard: FunctionComponent<PlatformEventMonitorListenerCardListenerCard> = ({
  loading,
  picklistKey,
  platformEventsList,
  subscribedPlatformEventsList,
  selectedSubscribeEvent,
  messagesByChannel,
  fetchPlatformEvents,
  subscribe,
  unsubscribe,
  onSelectedSubscribeEvent,
}) => {
  return (
    <Card
      className="slds-grow"
      title={
        <Grid vertical>
          <div>Subscribe to Events</div>
          <ViewDocsLink textReset path="/developer/platform-events" />
        </Grid>
      }
      actions={
        <button className="slds-button" onClick={() => fetchPlatformEvents(true)}>
          Just added a new event?
        </button>
      }
    >
      {loading && <Spinner />}
      <Grid vertical>
        <PlatformEventMonitorSubscribe
          picklistKey={picklistKey}
          platformEventsList={platformEventsList}
          selectedSubscribeEvent={selectedSubscribeEvent}
          messagesByChannel={messagesByChannel}
          fetchPlatformEvents={fetchPlatformEvents}
          subscribe={subscribe}
          unsubscribe={unsubscribe}
          onSelectedSubscribeEvent={onSelectedSubscribeEvent}
        />
        <div className="slds-m-vertical_small">
          {subscribedPlatformEventsList.map((item) => (
            <Pill
              key={item.id}
              className="slds-m-right-xx-small"
              title={`${item.label} - ${item.secondaryLabel}`}
              onRemove={() => unsubscribe(item.value)}
            >
              {item.label}
            </Pill>
          ))}
        </div>
        <div>
          <PlatformEventMonitorEvents messagesByChannel={messagesByChannel} />
        </div>
      </Grid>
    </Card>
  );
};

export default PlatformEventMonitorListenerCard;

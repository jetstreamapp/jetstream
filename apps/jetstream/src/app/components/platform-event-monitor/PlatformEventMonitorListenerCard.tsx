/** @jsx jsx */
import { jsx } from '@emotion/react';
import { ListItem } from '@jetstream/types';
import { Card, Grid, Spinner } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent } from 'react';
import PlatformEventMonitorEvents from './PlatformEventMonitorEvents';
import PlatformEventMonitorSubscribe from './PlatformEventMonitorSubscribe';
import { MessagesByChannel } from './usePlatformEvent';

export interface PlatformEventMonitorListenerCardListenerCard {
  loading: boolean;
  picklistKey: string | number;
  platformEventsList: ListItem<string, DescribeGlobalSObjectResult>[];
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
      title="Subscribe to Event"
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
        <div>
          <PlatformEventMonitorEvents messagesByChannel={messagesByChannel} />
        </div>
      </Grid>
    </Card>
  );
};

export default PlatformEventMonitorListenerCard;

import { ListItem, ListItemGroup, Maybe } from '@jetstream/types';
import { Card, Grid, Icon, Pill, Spinner, Tooltip, ViewDocsLink } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import PlatformEventMonitorEvents from './PlatformEventMonitorEvents';
import PlatformEventMonitorSubscribe from './PlatformEventMonitorSubscribe';
import { PlatformEventObject } from './platform-event-monitor.types';
import { MessagesByChannel } from './usePlatformEvent';

export interface PlatformEventMonitorListenerCardListenerCard {
  loading: boolean;
  picklistKey: string | number;
  platformEventsList: ListItemGroup<string, PlatformEventObject>[];
  subscribedPlatformEventsList: ListItem<string, PlatformEventObject>[];
  selectedSubscribeEvent?: Maybe<string>;
  messagesByChannel: MessagesByChannel;
  fetchPlatformEvents: (clearCache?: boolean) => void;
  onClear: () => void;
  onDownload: () => void;
  onSelectedSubscribeEvent: (id: string) => void;
  subscribe: (platformEventName: string, replayId?: number) => Promise<any>;
  unsubscribe: (platformEventName: string) => Promise<any>;
}

export const PlatformEventMonitorListenerCard: FunctionComponent<PlatformEventMonitorListenerCardListenerCard> = ({
  loading,
  picklistKey,
  platformEventsList,
  subscribedPlatformEventsList,
  selectedSubscribeEvent,
  messagesByChannel,
  fetchPlatformEvents,
  onClear,
  onDownload,
  onSelectedSubscribeEvent,
  subscribe,
  unsubscribe,
}) => {
  const hasSubscriptions = Object.keys(messagesByChannel).length > 0;
  const hasEvents = hasSubscriptions && Object.values(messagesByChannel).some((channel) => channel.messages.length > 0);

  return (
    <Card
      testId="platform-event-monitor-listener-card"
      className="slds-grow"
      icon={{ type: 'standard', icon: 'events' }}
      title={
        <Grid vertical>
          <div>Subscribe to Events</div>
          <ViewDocsLink textReset path="/developer/platform-events" />
        </Grid>
      }
      actions={
        <>
          <button className="slds-button slds-m-right_x-small" onClick={() => fetchPlatformEvents(true)}>
            Just added a new event?
          </button>
          <Tooltip content={'Unsubscribe from all events and clear results.'}>
            <button
              className="slds-button slds-button_icon slds-button_icon-border slds-button_icon-container slds-m-right_x-small"
              disabled={!hasSubscriptions}
              onClick={() => onClear()}
            >
              <Icon type="utility" icon="refresh" className="slds-button__icon" omitContainer />
            </button>
          </Tooltip>
          <button className="slds-button slds-button_neutral" disabled={!hasEvents} onClick={() => onDownload()}>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download
          </button>
        </>
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

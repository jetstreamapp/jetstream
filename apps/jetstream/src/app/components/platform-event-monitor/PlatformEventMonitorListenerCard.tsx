/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { ListItem } from '@jetstream/types';
import { Card, Grid, Input, Picklist, Spinner } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent, useEffect, useState } from 'react';
import PlatformEventMonitorEvents from './PlatformEventMonitorEvents';
import { MessagesByChannel } from './usePlatformEvent';

export interface PlatformEventMonitorListenerCardListenerCard {
  loading: boolean;
  picklistKey: string | number;
  platformEventsList: ListItem<string, DescribeGlobalSObjectResult>[];
  selectedSubscribeEvent: string;
  messagesByChannel: MessagesByChannel;
  subscribe: (platformEventName: string, replayId?: number) => Promise<any>;
  unsubscribe: (platformEventName: string) => Promise<any>;
  onSelectedSubscribeEvent: (id: string) => void;
}

const REPLACE_NON_NUMERIC = /[^\d.-]/g;

export const PlatformEventMonitorListenerCard: FunctionComponent<PlatformEventMonitorListenerCardListenerCard> = ({
  loading,
  picklistKey,
  platformEventsList,
  selectedSubscribeEvent,
  messagesByChannel,
  subscribe,
  unsubscribe,
  onSelectedSubscribeEvent,
}) => {
  const [replayId, setReplayId] = useState('-1');
  const [currentEventSubscribed, setCurrentEventSubscribed] = useState(false);

  useEffect(() => {
    setCurrentEventSubscribed(selectedSubscribeEvent && !!messagesByChannel[`/event/${selectedSubscribeEvent}`]);
  }, [selectedSubscribeEvent, messagesByChannel]);

  useEffect(() => {
    if (selectedSubscribeEvent && !!messagesByChannel[`/event/${selectedSubscribeEvent}`]) {
      setReplayId(`${messagesByChannel[`/event/${selectedSubscribeEvent}`].replayId || -1}`);
    } else {
      setReplayId('-1');
    }
  }, [selectedSubscribeEvent, messagesByChannel]);

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    setReplayId(event.target.value.replace(REPLACE_NON_NUMERIC, ''));
  }

  return (
    <Card className="slds-grow" title="Subscribe to Platform Event">
      {loading && <Spinner />}
      <Grid vertical>
        <Grid verticalAlign="end">
          <div className="slds-grow">
            <Picklist
              key={picklistKey}
              label="Platform Events"
              items={platformEventsList}
              allowDeselection={false}
              selectedItemIds={selectedSubscribeEvent ? [selectedSubscribeEvent] : undefined}
              onChange={(items) => onSelectedSubscribeEvent(items[0].id)}
            />
          </div>
          <div className="slds-m-horizontal_x-small">
            <Input
              label="Replay Id"
              labelHelp="Leave blank or -1 to replay new events, -2 to replay all events in last 24 hours, or specific replayId to start from"
              css={css`
                max-width: 100px;
              `}
            >
              <input
                id="replay-id"
                className="slds-input"
                placeholder="-1"
                value={replayId}
                disabled={currentEventSubscribed}
                inputMode="numeric"
                min={-2}
                onChange={onInputChange}
              />
            </Input>
          </div>
          <div className="slds-m-horizontal_small">
            {currentEventSubscribed && (
              <button
                className="slds-button slds-button_neutral"
                onClick={() => unsubscribe(selectedSubscribeEvent)}
                disabled={!selectedSubscribeEvent}
              >
                Unsubscribe
              </button>
            )}
            {!currentEventSubscribed && (
              <button
                className="slds-button slds-button_brand"
                onClick={() => subscribe(selectedSubscribeEvent, replayId && parseInt(replayId, 10))}
                disabled={!selectedSubscribeEvent}
              >
                Subscribe
              </button>
            )}
          </div>
        </Grid>
        <div>
          <PlatformEventMonitorEvents messagesByChannel={messagesByChannel} />
        </div>
      </Grid>
    </Card>
  );
};

export default PlatformEventMonitorListenerCard;

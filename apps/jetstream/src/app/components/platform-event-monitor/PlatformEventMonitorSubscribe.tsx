import { css } from '@emotion/react';
import { isEnterKey } from '@jetstream/shared/ui-utils';
import { ListItem, Maybe } from '@jetstream/types';
import { ComboboxWithItems, Grid, Input } from '@jetstream/ui';
import type { DescribeGlobalSObjectResult } from 'jsforce';
import React, { FunctionComponent, KeyboardEvent, useEffect, useState } from 'react';
import { MessagesByChannel } from './usePlatformEvent';

export interface PlatformEventMonitorSubscribeListenerCard {
  picklistKey: string | number;
  platformEventsList: ListItem<string, DescribeGlobalSObjectResult>[];
  selectedSubscribeEvent?: Maybe<string>;
  messagesByChannel: MessagesByChannel;
  fetchPlatformEvents: (clearCache?: boolean) => void;
  subscribe: (platformEventName: string, replayId?: number) => Promise<any>;
  unsubscribe: (platformEventName: string) => Promise<any>;
  onSelectedSubscribeEvent: (id: string) => void;
}

const REPLACE_NON_NUMERIC = /[^\d.-]/g;

export const PlatformEventMonitorSubscribe: FunctionComponent<PlatformEventMonitorSubscribeListenerCard> = ({
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
    setCurrentEventSubscribed(!!selectedSubscribeEvent && !!messagesByChannel[selectedSubscribeEvent]);
  }, [selectedSubscribeEvent, messagesByChannel]);

  useEffect(() => {
    if (selectedSubscribeEvent && !!messagesByChannel[selectedSubscribeEvent]) {
      setReplayId(`${messagesByChannel[selectedSubscribeEvent].replayId || -1}`);
    } else {
      setReplayId('-1');
    }
  }, [selectedSubscribeEvent, messagesByChannel]);

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    setReplayId(event.target.value.replace(REPLACE_NON_NUMERIC, ''));
  }

  function handleSubscribe(event: React.SyntheticEvent<HTMLFormElement | HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedSubscribeEvent) {
      return;
    }
    subscribe(selectedSubscribeEvent, replayId ? parseInt(replayId, 10) : undefined);
  }

  function handleInputKeydown(event: KeyboardEvent<HTMLInputElement>) {
    if (isEnterKey(event) && !currentEventSubscribed && selectedSubscribeEvent) {
      subscribe(selectedSubscribeEvent, replayId ? parseInt(replayId, 10) : undefined);
    }
  }

  return (
    <Grid verticalAlign="end" wrap>
      <div className="slds-grow">
        <ComboboxWithItems
          comboboxProps={{
            label: 'Platform Events',
            itemLength: 10,
          }}
          items={platformEventsList}
          selectedItemId={selectedSubscribeEvent}
          onSelected={(item) => onSelectedSubscribeEvent(item.id)}
        />
      </div>
      <div className="slds-m-horizontal_x-small">
        <Input
          label="Replay Id"
          labelHelp="-1 or blank to receive new events, -2 to replay all events within retention window, or provide a specific replayId to get all events starting with the replayed event."
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
            onKeyDown={handleInputKeydown}
          />
        </Input>
      </div>
      <div
        className="slds-m-horizontal_small"
        css={css`
          margin-left: auto;
        `}
      >
        {currentEventSubscribed && (
          <button
            className="slds-button slds-button_neutral"
            onClick={() => selectedSubscribeEvent && unsubscribe(selectedSubscribeEvent)}
            disabled={!selectedSubscribeEvent}
          >
            Unsubscribe
          </button>
        )}
        {!currentEventSubscribed && (
          <button className="slds-button slds-button_brand" onClick={handleSubscribe} disabled={!selectedSubscribeEvent}>
            Subscribe
          </button>
        )}
      </div>
    </Grid>
  );
};

export default PlatformEventMonitorSubscribe;

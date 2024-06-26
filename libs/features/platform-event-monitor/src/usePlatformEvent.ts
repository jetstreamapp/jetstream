import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { clearCacheForOrg, describeGlobal, sobjectOperation } from '@jetstream/shared/data';
import { useDebounce, useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj, orderValues } from '@jetstream/shared/utils';
import { Maybe, PlatformEventMessage, PlatformEventMessagePayload, SalesforceOrgUi } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { applicationCookieState, useAmplitude } from '@jetstream/ui-core';
import { CometD } from 'cometd';
import orderBy from 'lodash/orderBy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { EventMessageUnsuccessful, PlatformEventObject } from './platform-event-monitor.types';
import * as platformEventUtils from './platform-event-monitor.utils';

export type MessagesByChannel = Record<string, { replayId?: number; channel: string; messages: PlatformEventMessagePayload[] }>;
export interface PlatformEventDownloadData {
  headers: Record<string, string[]>;
  worksheets: Record<string, any[]>;
}

export function usePlatformEvent({ selectedOrg }: { selectedOrg: SalesforceOrgUi }) {
  const isMounted = useRef(true);
  const cometD = useRef<CometD>();
  const rollbar = useRollbar();
  const { trackEvent } = useAmplitude();
  const [{ serverUrl, defaultApiVersion }] = useRecoilState(applicationCookieState);
  const [platformEvents, setPlatformEvents] = useState<PlatformEventObject[]>([]);
  const [loadingPlatformEvents, setPlatformLoadingEvents] = useState<boolean>(false);
  const [hasPlatformEvents, setHasPlatformEvents] = useState(true);
  const [platformEventFetchError, setPlatformEventFetchError] = useState<Maybe<string>>(null);
  const [messagesByChannel, setMessagesByChannel] = useState<MessagesByChannel>({});
  const debouncedMessagesByChannel = useDebounce(messagesByChannel);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      setMessagesByChannel({});
      return () => {
        if (cometD.current) {
          platformEventUtils.disconnect(cometD.current);
          cometD.current = undefined;
          trackEvent(ANALYTICS_KEYS.platform_event_unsubscribe, { user_initiated: false });
        }
      };
    }
  }, [selectedOrg, trackEvent]);

  const fetchPlatformEvents = useCallback(
    async (clearCache = false) => {
      try {
        if (clearCache) {
          await clearCacheForOrg(selectedOrg);
        }
        setPlatformLoadingEvents(true);
        setPlatformEventFetchError(null);
        const platformEvents = orderBy(
          (await describeGlobal(selectedOrg)).data.sobjects
            .filter((obj) => (obj.name.endsWith('__e') || obj.name.endsWith('Event')) && !obj.queryable)
            .map(({ name, label }): PlatformEventObject => {
              return {
                name,
                label,
                channel: name.endsWith('ChangeEvent') ? `/data/${name}` : `/event/${name}`,
                type: name.endsWith('ChangeEvent') ? 'CHANGE_EVENT' : name.endsWith('__e') ? 'PLATFORM_EVENT' : 'PLATFORM_EVENT_STANDARD',
              };
            }),
          [(obj) => obj.name.endsWith('__e'), (obj) => obj.name.endsWith('ChangeEvent'), 'label'],
          ['desc', 'asc', 'asc']
        );
        if (isMounted.current) {
          setPlatformEvents(platformEvents);
          setPlatformLoadingEvents(false);
          setHasPlatformEvents(platformEvents.length > 0);
        }
      } catch (ex) {
        setPlatformEventFetchError(getErrorMessage(ex));
        rollbar.error(`Fetch platform event error`, getErrorMessageAndStackObj(ex));
      }
    },
    [rollbar, selectedOrg]
  );

  useEffect(() => {
    if (selectedOrg) {
      fetchPlatformEvents();
    }
  }, [fetchPlatformEvents, selectedOrg]);

  const onEvent = useCallback(
    (replayId?: number) => (message: PlatformEventMessage) => {
      logger.log('[PLATFORM EVENT][RECEIVED]', message);
      if (isMounted.current) {
        const { data } = message;
        const channel = message.channel.replace('/event/', '');
        setMessagesByChannel((item) => {
          item = { ...item };
          item[channel] = { ...(item[channel] || { messages: [], replayId, channel: message.channel }) };
          const newMessages = [data].concat(item[channel].messages);

          // Order and de-duplicate events by replayId
          const eventsByEventId = newMessages.reduce((acc: Record<number, PlatformEventMessagePayload<any>>, val) => {
            acc[`${val.event.replayId}`] = val;
            return acc;
          }, {});

          item[channel].messages = orderValues(Object.keys(eventsByEventId)).map(
            (replayId) => eventsByEventId[replayId as unknown as number]
          );
          return item;
        });
      }
    },
    []
  );

  const handleSubscribeError = useCallback((message: EventMessageUnsuccessful) => {
    logger.warn('[PLATFORM EVENT][ERROR]', message);
    if (message.subscription) {
      fireToast({ type: 'error', message: `Error subscribing to event: ${message.subscription}. ${message.error}` });
      setMessagesByChannel((item) => {
        return Object.keys(item)
          .filter((key) => key !== message.subscription)
          .reduce((output: MessagesByChannel, key) => {
            output[key] = item[key];
            return output;
          }, {});
      });
    } else if (message.channel === '/meta/handshake') {
      fireToast({ type: 'error', message: `Error subscribing to event: ${message.failure?.reason || 'Unknown reason'}.` });
    } else {
      fireToast({ type: 'error', message: `There was an unknown error subscribing to the event` });
    }
  }, []);

  const subscribe = useCallback(
    async (channel: string, replayId?: number) => {
      try {
        if (selectedOrg) {
          let requiredInit = false;
          if (!cometD.current || cometD.current.isDisconnected()) {
            cometD.current = await platformEventUtils.init({
              defaultApiVersion,
              selectedOrg,
              serverUrl,
              onSubscribeError: handleSubscribeError,
            });
            requiredInit = true;
          }

          const cometd = cometD.current;
          platformEventUtils.subscribe({ cometd, channel, replayId }, onEvent(replayId));

          setMessagesByChannel((item) => {
            item = { ...item };
            item[channel] = { messages: [], channel, replayId };
            return item;
          });
          trackEvent(ANALYTICS_KEYS.platform_event_subscribed, { requiredInit, channel, replayId });
        }
      } catch (ex) {
        logger.warn('[PLATFORM EVENT][ERROR]', getErrorMessage(ex));
        fireToast({ type: 'error', message: 'Error connecting to Salesforce' });
      }
    },
    [defaultApiVersion, handleSubscribeError, onEvent, selectedOrg, serverUrl, trackEvent]
  );

  const unsubscribe = useCallback(
    async (channel: string) => {
      try {
        if (cometD.current) {
          const cometd = cometD.current;
          platformEventUtils.unsubscribe({ cometd, channel });

          setMessagesByChannel((item) => {
            return Object.keys(item)
              .filter((key) => key !== channel)
              .reduce((output: MessagesByChannel, key) => {
                output[key] = item[key];
                return output;
              }, {});
          });
          trackEvent(ANALYTICS_KEYS.platform_event_unsubscribe, { user_initiated: true });
        }
      } catch (ex) {
        logger.warn('[PLATFORM EVENT][ERROR] unsubscribing', getErrorMessage(ex));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedOrg, trackEvent]
  );

  const publish = useCallback(
    async (platformEventName: string, body: any): Promise<string> => {
      const results = (await sobjectOperation(selectedOrg, platformEventName, 'create', { records: [body] }))[0];
      trackEvent(ANALYTICS_KEYS.platform_event_publish, { success: results.success });
      const message = results.errors[0].message;
      if (results.success === false) {
        throw new Error(message);
      }
      // very strange, but the id of the event is in the errors array
      return message;
    },
    [selectedOrg, trackEvent]
  );

  const clearAndUnsubscribeFromAll = useCallback(async (): Promise<void> => {
    try {
      if (cometD.current) {
        const cometd = cometD.current;
        platformEventUtils.unsubscribeAll({ cometd });
        setMessagesByChannel({});
        trackEvent(ANALYTICS_KEYS.platform_event_clear_all, { user_initiated: true });
      }
    } catch (ex) {
      logger.warn('[PLATFORM EVENT][ERROR] unsubscribing', getErrorMessage(ex));
    }
  }, [trackEvent]);

  const prepareDownloadData = useCallback((messagesByChannel: MessagesByChannel): PlatformEventDownloadData => {
    const output: PlatformEventDownloadData = {
      headers: {},
      worksheets: {},
    };

    Object.keys(messagesByChannel)
      .filter((key) => messagesByChannel[key].messages.length)
      .forEach((key) => {
        const { messages, channel } = messagesByChannel[key];
        output.worksheets[key] = messages.map(({ event, payload }) => ({
          channel,
          ...payload,
          ...event,
        }));
        output.headers[key] = ['EventApiName', 'channel', 'EventUuid', 'replayId', ...Object.keys(messages[0].payload)];
      });

    logger.log('[PLATFORM EVENT][DOWNLOAD]', output);
    return output;
  }, []);

  return {
    hasPlatformEvents,
    platformEventFetchError,
    platformEvents,
    messagesByChannel: debouncedMessagesByChannel,
    loadingPlatformEvents,
    clearAndUnsubscribeFromAll,
    fetchPlatformEvents,
    prepareDownloadData,
    publish,
    subscribe,
    unsubscribe,
  };
}

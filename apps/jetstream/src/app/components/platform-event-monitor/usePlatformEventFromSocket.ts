import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, SOCKET_EVENTS } from '@jetstream/shared/constants';
import {
  clearCacheForOrg,
  describeGlobal,
  sobjectOperation,
  emit as socketEmit,
  subscribe as socketSubscribe,
} from '@jetstream/shared/data';
import { useDebounce, useRollbar } from '@jetstream/shared/ui-utils';
import { MapOf, Maybe, PlatformEventMessage, PlatformEventMessagePayload, SalesforceOrgUi } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import orderBy from 'lodash/orderBy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useAmplitude } from '../core/analytics';
import { EventMessageUnsuccessful, PlatformEventObject } from './platform-event-monitor.types';

export type MessagesByChannel = MapOf<{ replayId?: number; messages: PlatformEventMessagePayload[] }>;

export function usePlatformEventFromSocket({ selectedOrg }: { selectedOrg: SalesforceOrgUi }): {
  hasPlatformEvents: boolean;
  platformEventFetchError?: Maybe<string>;
  platformEvents: PlatformEventObject[];
  messagesByChannel: MessagesByChannel;
  loadingPlatformEvents: boolean;
  fetchPlatformEvents: (clearCache?: boolean) => void;
  subscribe: (platformEventName: string, replayId?: number) => Promise<any>;
  unsubscribe: (platformEventName: string) => Promise<any>;
  publish: (platformEventName: string, data: any) => Promise<string>;
} {
  const isMounted = useRef(true);
  const socketConnection = useRef<Socket | null>();
  // const cometD = useRef<CometD>();
  const rollbar = useRollbar();
  const { trackEvent } = useAmplitude();
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
        // FIXME: do we need to unsubscribe from all channels? or does server handle this on disconnect?
        if (socketConnection.current && socketConnection.current.connected) {
          socketConnection.current.disconnect();
          socketConnection.current = null;
        }
      };
    }
  }, [selectedOrg]);

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
        setPlatformEventFetchError(ex.message);
        rollbar.error(`Fetch platform event error`, { stack: ex.stack, message: ex.message });
      }
    },
    [selectedOrg]
  );

  useEffect(() => {
    if (selectedOrg) {
      fetchPlatformEvents();
    }
  }, [selectedOrg, fetchPlatformEvents]);

  const onEvent = useCallback(
    (replayId?: number) => (message: PlatformEventMessage) => {
      logger.log('[PLATFORM EVENT][RECEIVED]', message);
      if (isMounted.current) {
        const { data } = message;
        const channel = message.channel;
        setMessagesByChannel((item) => {
          item = { ...item };
          item[channel] = { ...(item[channel] || { messages: [], replayId, channel: message.channel }) };
          item[channel].messages = [data].concat(item[channel].messages);
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
          // TODO: where could errors happen and how to handle them?

          if (!socketConnection.current || !socketConnection.current.connected) {
            socketConnection.current = socketSubscribe(SOCKET_EVENTS.PLATFORM_EVENT_MESSAGE, onEvent(replayId));
          }

          const response = await socketEmit(SOCKET_EVENTS.PLATFORM_EVENT_SUBSCRIBE, {
            orgId: selectedOrg.uniqueId,
            platformEventName: channel,
            replayId,
          });
          logger.log('[PLATFORM EVENT][SUBSCRIBE][RESPONSE]', response);
          if (!response.success) {
            throw new Error(response.error);
          }

          setMessagesByChannel((item) => {
            item = { ...item };
            item[channel] = { messages: [], replayId };
            return item;
          });
          trackEvent(ANALYTICS_KEYS.platform_event_subscribed, { channel, replayId });
        }
      } catch (ex) {
        logger.warn('[PLATFORM EVENT][ERROR]', ex.message);
        fireToast({ type: 'error', message: ex.message || 'Error connecting to Salesforce' });
      }
    },
    [onEvent, selectedOrg, trackEvent]
  );

  const unsubscribe = useCallback(
    async (channel: string) => {
      try {
        if (socketConnection.current) {
          socketConnection.current.emit(SOCKET_EVENTS.PLATFORM_EVENT_UNSUBSCRIBE, {
            orgId: selectedOrg.uniqueId,
            platformEventName: channel,
          });

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
        logger.warn('[PLATFORM EVENT][ERROR] unsubscribing', ex.message);
      }
    },
    [selectedOrg.uniqueId, trackEvent]
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

  return {
    hasPlatformEvents,
    platformEventFetchError,
    platformEvents,
    messagesByChannel: debouncedMessagesByChannel,
    loadingPlatformEvents,
    fetchPlatformEvents,
    publish,
    subscribe,
    unsubscribe,
  };
}
